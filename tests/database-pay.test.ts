import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOfficeDb } from "./helpers/officeDb";

const owner = "10000000-0000-4000-8000-0000000000b1";
const member = "20000000-0000-4000-8000-0000000000b2";
const third = "30000000-0000-4000-8000-0000000000b3";
let t: Awaited<ReturnType<typeof createOfficeDb>>;

beforeAll(async () => {
  t = await createOfficeDb([owner, member, third]);
}, 60_000);
afterAll(async () => {
  await t?.db.close();
});

type Batch = {
  batch_id: string;
  code: string;
  receiver_id: string;
  currency: string;
  amount: string;
};
const save = (
  actor: string,
  group: string,
  amount: string,
  shares: unknown[],
  description = "Ăn trưa",
) =>
  t.rpc<string>(actor, "save_expense", [
    null,
    group,
    description,
    amount,
    "2026-11-05",
    "even",
    JSON.stringify(shares),
    null,
    null,
    "food",
  ]);
const open = async (user: string) =>
  (
    await t.asUser<Batch>(
      user,
      "select batch_id,code,receiver_id,currency,amount::text from public.open_payment_batches()",
    )
  ).rows;
const statusOf = async (expense: string, user: string) =>
  (
    await t.asUser<{ payment_status: string }>(
      owner,
      "select payment_status from office_shares where expense_id=$1 and user_id=$2",
      [expense, user],
    )
  ).rows[0].payment_status;
const batchStatus = async (user: string, id: string) =>
  (
    await t.asUser<{ status: string }>(
      user,
      "select status from payment_batches where id=$1",
      [id],
    )
  ).rows[0]?.status;

describe("payment batches", () => {
  it("groups pending shares by payer and currency and keeps the code while nothing changes", async () => {
    const vnd = await t.group("VND");
    const usd = await t.group("USD");
    const lunch = await save(owner, vnd, "200000", [
      { userId: owner },
      { userId: member },
    ]);
    const taxi = await save(owner, vnd, "100000", [
      { userId: owner },
      { userId: member },
    ]);
    await save(owner, usd, "10", [{ userId: owner }, { userId: member }]);
    // A share the member paid for themselves is not owed to anyone.
    await save(member, vnd, "50000", [{ userId: member }, { userId: owner }]);

    const first = await open(member);
    expect(first.map((b) => [b.receiver_id, b.currency, b.amount])).toEqual([
      [owner, "USD", "5.00"],
      [owner, "VND", "150000.00"],
    ]);
    expect(first[1].code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const items = await t.asUser<{ expense_id: string; amount: string }>(
      member,
      "select expense_id,amount::text from payment_batch_items where batch_id=$1 order by expense_id",
      [first[1].batch_id],
    );
    expect(items.rows.map((r) => r.expense_id).sort()).toEqual(
      [lunch, taxi].sort(),
    );
    expect(await open(member)).toEqual(first);
  });

  it("issues a new code when what is owed changes and retires the old batch", async () => {
    const group = await t.group("VND");
    await save(third, group, "90000", [{ userId: third }, { userId: member }]);
    const [before] = (await open(member)).filter(
      (b) => b.receiver_id === third,
    );
    await save(third, group, "30000", [{ userId: third }, { userId: member }]);
    const [after] = (await open(member)).filter((b) => b.receiver_id === third);
    expect(after.code).not.toBe(before.code);
    expect(after.amount).toBe("60000.00");
    expect(await batchStatus(member, before.batch_id)).toBe("superseded");
  });

  it("reports every share at once, notifies the payer once and cannot be reported by others", async () => {
    const group = await t.group("VND");
    const a = await save(third, group, "40000", [
      { userId: third },
      { userId: owner },
    ]);
    const b = await save(third, group, "60000", [
      { userId: third },
      { userId: owner },
    ]);
    const [batch] = (await open(owner)).filter((x) => x.receiver_id === third);
    await expect(
      t.rpc(member, "report_payment_batch", [batch.batch_id]),
    ).rejects.toThrow(/Payment batch not found/);

    expect(await t.rpc(owner, "report_payment_batch", [batch.batch_id])).toBe(
      2,
    );
    expect(await statusOf(a, owner)).toBe("reported");
    expect(await statusOf(b, owner)).toBe("reported");
    expect(await t.rpc(owner, "report_payment_batch", [batch.batch_id])).toBe(
      0,
    );
    const notes = await t.asUser<{ title: string }>(
      third,
      "select title from notifications where payment_batch_id=$1",
      [batch.batch_id],
    );
    expect(notes.rows).toEqual([
      { title: "Thành viên đã báo chuyển tiền cho nhiều khoản" },
    ]);
    expect((await open(owner)).filter((x) => x.receiver_id === third)).toEqual(
      [],
    );
    // The payer confirms each share as before.
    await t.rpc(third, "payment_action", [a, "confirm", owner]);
    expect(await statusOf(a, owner)).toBe("confirmed");
  });

  it("refuses stale batches and hides batches from outsiders", async () => {
    const group = await t.group("VND");
    const expense = await save(owner, group, "80000", [
      { userId: owner },
      { userId: third },
    ]);
    const [batch] = (await open(third)).filter((x) => x.receiver_id === owner);
    expect(await batchStatus(member, batch.batch_id)).toBeUndefined();
    expect(await batchStatus(owner, batch.batch_id)).toBe("open");
    await t.rpc(owner, "cancel_expense", [expense, "Nhầm"]);
    await open(third);
    expect(await batchStatus(third, batch.batch_id)).toBe("superseded");
    await expect(
      t.rpc(third, "report_payment_batch", [batch.batch_id]),
    ).rejects.toThrow(/out of date/);
  });

  it("blocks anonymous calls and direct writes", async () => {
    await expect(
      t.db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select public.open_payment_batches()");
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(
        member,
        "insert into payment_batches(code,member_id,receiver_id,currency,amount) values('ABCDEF',$1,$1,'VND',1)",
        [member],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
