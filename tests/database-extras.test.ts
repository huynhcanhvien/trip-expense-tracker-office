import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOfficeDb } from "./helpers/officeDb";

const owner = "10000000-0000-4000-8000-0000000000a1";
const member = "20000000-0000-4000-8000-0000000000a2";
const third = "30000000-0000-4000-8000-0000000000a3";
let t: Awaited<ReturnType<typeof createOfficeDb>>;

beforeAll(async () => {
  t = await createOfficeDb([owner, member, third]);
}, 60_000);
afterAll(async () => {
  await t?.db.close();
});

const save = (
  actor: string,
  group: string,
  opts: {
    id?: string | null;
    amount?: string;
    mode?: string;
    shares?: unknown[];
    payer?: string | null;
    category?: string;
    description?: string;
  } = {},
) =>
  t.rpc<string>(actor, "save_expense", [
    opts.id ?? null,
    group,
    opts.description ?? "Ăn trưa",
    opts.amount ?? "300000",
    "2026-10-22",
    opts.mode ?? "even",
    JSON.stringify(
      opts.shares ?? [{ userId: owner }, { userId: member }, { userId: third }],
    ),
    null,
    opts.payer ?? null,
    opts.category ?? "food",
  ]);
const sharesOf = async (expense: string) =>
  (
    await t.asUser<{ user_id: string; amount: string; weight: number | null }>(
      owner,
      "select user_id,amount::text,weight from office_shares where expense_id=$1 order by user_id",
      [expense],
    )
  ).rows;
const changesOf = async (expense: string) =>
  (
    await t.asUser<{ action: string; changes: Record<string, unknown> }>(
      owner,
      "select action,changes from expense_changes where expense_id=$1 order by created_at,id",
      [expense],
    )
  ).rows;
const titles = async (user: string, expense: string) =>
  (
    await t.asUser<{ title: string }>(
      user,
      "select title from notifications where user_id=$1 and expense_id=$2 order by created_at",
      [user, expense],
    )
  ).rows.map((r) => r.title);

describe("categories and weighted splits", () => {
  it("stores the category and splits by weight with the remainder on the last member", async () => {
    const group = await t.group();
    const id = await save(owner, group, {
      amount: "100000",
      mode: "weight",
      shares: [
        { userId: owner, weight: 1 },
        { userId: member, weight: 2 },
        { userId: third, weight: 3 },
      ],
      category: "transport",
    });
    expect(await sharesOf(id)).toEqual([
      { user_id: owner, amount: "16666.00", weight: 1 },
      { user_id: member, amount: "33333.00", weight: 2 },
      { user_id: third, amount: "50001.00", weight: 3 },
    ]);
    const { rows } = await t.asUser<{ category: string }>(
      owner,
      "select category from office_expenses where id=$1",
      [id],
    );
    expect(rows[0].category).toBe("transport");
  });

  it("rejects bad weights and unknown categories", async () => {
    const group = await t.group();
    await expect(
      save(owner, group, {
        mode: "weight",
        shares: [{ userId: owner, weight: 0 }],
      }),
    ).rejects.toThrow(/Invalid share weight/);
    await expect(
      save(owner, group, {
        mode: "weight",
        shares: [{ userId: owner, weight: "1.5" }],
      }),
    ).rejects.toThrow(/Invalid share weight/);
    await expect(save(owner, group, { category: "rent" })).rejects.toThrow(
      /Invalid category/,
    );
  });
});

describe("change log", () => {
  it("records a snapshot on create and only changed fields afterwards", async () => {
    const group = await t.group();
    const id = await save(owner, group);
    await save(owner, group, {
      id,
      amount: "330000",
      description: "Ăn trưa thứ Sáu",
    });
    await t.rpc(owner, "edit_expense_metadata", [id, "Ăn tối", "2026-10-23"]);
    await t.rpc(owner, "cancel_expense", [id, "Nhầm"]);
    const log = await changesOf(id);
    expect(log.map((c) => c.action)).toEqual([
      "create",
      "edit",
      "metadata",
      "cancel",
    ]);
    expect(log[0].changes).toMatchObject({
      description: "Ăn trưa",
      amount: "300000.00",
      category: "food",
    });
    expect(Object.keys(log[1].changes).sort()).toEqual([
      "amount",
      "description",
      "shares",
    ]);
    expect(log[1].changes.amount).toEqual(["300000.00", "330000.00"]);
    expect(log[2].changes).toEqual({
      description: ["Ăn trưa thứ Sáu", "Ăn tối"],
      expense_date: ["2026-10-22", "2026-10-23"],
    });
    expect(log[3].changes).toEqual({ reason: "Nhầm" });
  });

  it("logs approvals and is readable only by group members", async () => {
    const group = await t.group();
    const id = await save(owner, group, { payer: member });
    await t.rpc(member, "approve_expense", [id, true, null, 0]);
    expect((await changesOf(id)).map((c) => c.action)).toEqual([
      "create",
      "approve",
    ]);
    const outsiderGroup = await t.rpc<string>(third, "create_group", [
      "Riêng",
      "VND",
    ]);
    const own = await save(third, outsiderGroup, {
      shares: [{ userId: third }],
    });
    const visible = await t.asUser(
      owner,
      "select 1 from expense_changes where expense_id=$1",
      [own],
    );
    expect(visible.rows).toHaveLength(0);
    await expect(
      t.asUser(
        owner,
        "insert into expense_changes(expense_id,action) values($1,'edit')",
        [id],
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("payment reminders", () => {
  it("lets only the payer remind a pending share once per 20 hours", async () => {
    const group = await t.group();
    const id = await save(owner, group);
    await expect(t.rpc(member, "remind_payment", [id, third])).rejects.toThrow(
      /payer required/i,
    );
    await expect(t.rpc(owner, "remind_payment", [id, owner])).rejects.toThrow(
      /No payable share/,
    );
    await t.rpc(owner, "remind_payment", [id, member]);
    expect(await titles(member, id)).toContain("Nhắc: bạn còn khoản cần trả");
    await expect(t.rpc(owner, "remind_payment", [id, member])).rejects.toThrow(
      /Reminder sent recently/,
    );
    await t.rpc(member, "payment_action", [id, "report", member]);
    await expect(t.rpc(owner, "remind_payment", [id, member])).rejects.toThrow(
      /No payable share/,
    );
  });

  it("auto-reminds shares unpaid for three days, then waits three more days", async () => {
    const group = await t.group();
    const id = await save(owner, group);
    const later = (days: number) =>
      new Date(Date.now() + days * 86_400_000).toISOString();
    expect(await t.service<number>("auto_remind_payments", [later(1)])).toBe(0);
    const first = await t.service<number>("auto_remind_payments", [later(4)]);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(await titles(third, id)).toEqual([
      "Bạn có khoản chia tiền mới",
      "Nhắc: bạn còn khoản cần trả",
    ]);
    await t.service("auto_remind_payments", [later(5)]);
    expect(await titles(third, id)).toHaveLength(2);
    await t.service("auto_remind_payments", [later(8)]);
    expect(await titles(third, id)).toHaveLength(3);
    await expect(
      t.rpc(owner, "auto_remind_payments", [later(9)]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("recurring expenses", () => {
  const recurring = (
    group: string,
    cadence: string,
    start: string,
    mode = "even",
    shares: unknown[] = [{ userId: owner }, { userId: member }],
  ) =>
    t.rpc<string>(owner, "save_recurring", [
      group,
      "Tiền nước",
      "90000",
      "utilities",
      mode,
      JSON.stringify(shares),
      cadence,
      start,
    ]);
  const expensesIn = async (group: string) =>
    (
      await t.asUser<{
        expense_date: string;
        category: string;
        status: string;
      }>(
        owner,
        "select expense_date::text,category,status from office_expenses where group_id=$1 and description='Tiền nước' order by expense_date",
        [group],
      )
    ).rows;

  it("creates monthly occurrences, catches up missed ones and keeps month-end dates", async () => {
    const group = await t.group();
    const today = new Date().toISOString().slice(0, 10);
    await expect(recurring(group, "monthly", "2020-01-01")).rejects.toThrow(
      /past/,
    );
    const id = await recurring(group, "monthly", today);
    // Simulate a template that began on Jan 31 and was missed for months.
    await t.db.query(
      "update recurring_expenses set start_date='2027-01-31',next_date='2027-01-31' where id=$1",
      [id],
    );
    expect(await t.service<number>("run_recurring", ["2027-01-30"])).toBe(0);
    expect(await t.service<number>("run_recurring", ["2027-04-29"])).toBe(3);
    expect(await t.service<number>("run_recurring", ["2027-04-30"])).toBe(1);
    expect((await expensesIn(group)).map((e) => e.expense_date)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
    expect(await t.service<number>("run_recurring", ["2027-04-30"])).toBe(0);
    const [e] = await expensesIn(group);
    expect(e).toMatchObject({ category: "utilities", status: "active" });
    const { rows } = await t.asUser<{ action: string }>(
      owner,
      "select c.action from expense_changes c join office_expenses e on e.id=c.expense_id where e.group_id=$1 and e.description='Tiền nước' limit 1",
      [group],
    );
    expect(rows[0].action).toBe("recurring");
  });

  it("drops members who left and pauses a template that can no longer be saved", async () => {
    const group = await t.group();
    const today = new Date().toISOString().slice(0, 10);
    await recurring(group, "weekly", today, "even", [
      { userId: owner },
      { userId: member },
      { userId: third },
    ]);
    await t.rpc(third, "leave_group", [group]);
    expect(await t.service<number>("run_recurring", [today])).toBe(1);
    const [created] = (
      await t.asUser<{ id: string }>(
        owner,
        "select id from office_expenses where group_id=$1 and description='Tiền nước'",
        [group],
      )
    ).rows;
    expect((await sharesOf(created.id)).map((s) => s.user_id)).toEqual([
      owner,
      member,
    ]);

    const custom = await recurring(group, "weekly", today, "custom", [
      { userId: owner, amount: "45000" },
      { userId: member, amount: "45000" },
    ]);
    await t.db.query("update recurring_expenses set shares=$2 where id=$1", [
      custom,
      JSON.stringify([{ userId: owner, amount: "1" }]),
    ]);
    await t.service("run_recurring", [today]);
    const { rows } = await t.asUser<{ active: boolean; last_error: string }>(
      owner,
      "select active,last_error from recurring_expenses where id=$1",
      [custom],
    );
    expect(rows[0]).toEqual({
      active: false,
      last_error: "Shares must sum to expense amount",
    });
  });

  it("lets only the creator or group owner stop a template", async () => {
    const group = await t.group();
    const today = new Date().toISOString().slice(0, 10);
    const id = await t.rpc<string>(member, "save_recurring", [
      group,
      "Cafe",
      "20000",
      "food",
      "even",
      JSON.stringify([{ userId: member }]),
      "weekly",
      today,
    ]);
    await expect(t.rpc(third, "stop_recurring", [id])).rejects.toThrow(
      /creator required/i,
    );
    await t.rpc(owner, "stop_recurring", [id]);
    await expect(t.rpc(owner, "stop_recurring", [id])).rejects.toThrow(
      /creator required/i,
    );
  });
});

describe("web push and inbox counts", () => {
  const endpoint = "https://push.example.test/abc";
  it("claims each new notification once, only for subscribed users", async () => {
    const group = await t.group();
    await t.db.query("select * from public.claim_push_notifications(500)");
    await t.rpc(member, "save_push_subscription", [endpoint, "key", "auth"]);
    await expect(
      t.rpc(member, "save_push_subscription", ["http://x", "k", "a"]),
    ).rejects.toThrow(/violates check/i);
    await save(owner, group);
    const { rows } = await t.db.query<{ user_id: string; endpoint: string }>(
      "select user_id,endpoint from public.claim_push_notifications(100)",
    );
    expect(rows).toEqual([{ user_id: member, endpoint }]);
    const again = await t.db.query(
      "select * from public.claim_push_notifications(100)",
    );
    expect(again.rows).toHaveLength(0);
    await expect(
      t.rpc(member, "claim_push_notifications", [10]),
    ).rejects.toThrow(/permission denied/i);
    await t.rpc(owner, "delete_push_subscription", [endpoint]);
    expect(
      (await t.db.query("select 1 from push_subscriptions")).rows,
    ).toHaveLength(1);
    await t.rpc(member, "delete_push_subscription", [endpoint]);
    expect(
      (await t.db.query("select 1 from push_subscriptions")).rows,
    ).toHaveLength(0);
  });

  it("counts unread, shares to pay and approvals in one call", async () => {
    const before = await t.rpc<{ toPay: number; approvals: number }>(
      third,
      "inbox_counts",
    );
    const group = await t.group();
    await save(owner, group);
    await save(member, group, { payer: third });
    const after = await t.rpc<{
      unread: number;
      toPay: number;
      approvals: number;
    }>(third, "inbox_counts");
    expect(after.toPay).toBe(before.toPay + 1);
    expect(after.approvals).toBe(before.approvals + 1);
    expect(after.unread).toBeGreaterThan(0);
  });
});
