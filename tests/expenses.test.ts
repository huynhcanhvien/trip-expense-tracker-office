import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { Client } from "@libsql/client";
import { makeTestDb, type TestDb } from "./helpers/testDb";
import { createTrip, getTripByPublicId, addParticipant, listTripMembers } from "../src/lib/trips";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getTripExpenses,
} from "../src/lib/expenses";
import { computeBalances } from "../src/lib/balance";
import Big from "big.js";

let testDb: TestDb;
let client: Client;

// Members: Alice, Bob, Carol — as trip_members.id
let tripId: number;
let alice: number;
let bob: number;
let carol: number;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  for (const t of ["expense_shares", "expenses", "trip_members", "trips"]) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

afterAll(() => testDb.cleanup());

async function seedTrip(currency: "USD" | "JPY" = "USD") {
  const publicId = await createTrip(
    { name: "Trip", currency, participants: ["Alice", "Bob", "Carol"] },
    client,
  );
  const trip = (await getTripByPublicId(publicId, client))!;
  tripId = trip.id;
  const members = await listTripMembers(tripId, client);
  alice = members.find((m) => m.displayName === "Alice")!.id;
  bob = members.find((m) => m.displayName === "Bob")!.id;
  carol = members.find((m) => m.displayName === "Carol")!.id;
}

async function makeExpense(payerMember = alice, included = [alice, bob, carol]) {
  return createExpense(
    { tripId, description: "Dinner", amount: "60", expenseDate: "2026-07-01", payerMemberId: payerMember, includedMemberIds: included },
    client,
  );
}

describe("createExpense", () => {
  it("Scenario A: $60 dinner, payer Alice, split all three → stored + 3 shares", async () => {
    await seedTrip();
    const id = await createExpense(
      {
        tripId,
        description: "Dinner",
        amount: "60.00",
        expenseDate: "2026-07-01",
        payerMemberId: alice,
        includedMemberIds: [alice, bob, carol],
      },
      client,
    );

    const exp = await client.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
    expect(exp.rows[0].amount).toBe("60");
    expect(exp.rows[0].payer_member_id).toBe(alice);
    expect(exp.rows[0].description).toBe("Dinner");

    const shares = await client.execute({
      sql: "SELECT member_id FROM expense_shares WHERE expense_id = ?",
      args: [id],
    });
    expect(shares.rows.map((r) => Number(r.member_id)).sort()).toEqual([alice, bob, carol].sort());
  });

  it("Scenario G: payer Alice excluded — split Bob & Carol only", async () => {
    await seedTrip();
    const id = await createExpense(
      {
        tripId,
        description: "Coffee for Bob & Carol",
        amount: "20",
        expenseDate: "2026-07-01",
        payerMemberId: alice,
        includedMemberIds: [bob, carol],
      },
      client,
    );

    const shares = await client.execute({
      sql: "SELECT member_id FROM expense_shares WHERE expense_id = ?",
      args: [id],
    });
    expect(shares.rows.map((r) => Number(r.member_id)).sort()).toEqual([bob, carol].sort());
    // Payer is not in the included set.
    expect(shares.rows.map((r) => Number(r.member_id))).not.toContain(alice);
  });

  it("rejects an empty included set", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [] },
        client,
      ),
    ).rejects.toThrowError(/at least one/i);
  });

  it("rejects amount <= 0", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "0", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice] },
        client,
      ),
    ).rejects.toThrowError(/greater than 0/i);
  });

  it("rejects a payer who isn't a trip member", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: 99999, includedMemberIds: [alice] },
        client,
      ),
    ).rejects.toThrowError(/payer must be a trip member/i);
  });

  it("rejects an included member who isn't in the trip", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, 99999] },
        client,
      ),
    ).rejects.toThrowError(/must be a trip member/i);
  });

  it("normalizes amount to the currency precision (no fractional yen)", async () => {
    await seedTrip("JPY");
    const id = await createExpense(
      { tripId, description: "Ramen", amount: "500.7", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, bob] },
      client,
    );
    const exp = await client.execute({ sql: "SELECT amount FROM expenses WHERE id = ?", args: [id] });
    expect(exp.rows[0].amount).toBe("501"); // 500.7 rounded to 0dp
  });

  it("rejects adding to an archived trip", async () => {
    await seedTrip();
    await client.execute({ sql: "UPDATE trips SET status='closed' WHERE id = ?", args: [tripId] });
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice] },
        client,
      ),
    ).rejects.toThrowError(/archived/i);
  });
});

describe("getTripExpenses", () => {
  it("returns expenses with their included member ids, newest first", async () => {
    await seedTrip();
    await createExpense(
      { tripId, description: "Dinner", amount: "60", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, bob, carol] },
      client,
    );
    await createExpense(
      { tripId, description: "Coffee", amount: "20", expenseDate: "2026-07-02", payerMemberId: alice, includedMemberIds: [bob, carol] },
      client,
    );

    const list = await getTripExpenses(tripId, client);
    expect(list.map((e) => e.description)).toEqual(["Coffee", "Dinner"]); // newest first
    expect(list.find((e) => e.description === "Coffee")!.includedMemberIds.sort()).toEqual(
      [bob, carol].sort(),
    );
  });
});

describe("balances wired from stored expenses (R3)", () => {
  it("Scenario A + G together → Alice +60, Bob -30, Carol -30, sum 0", async () => {
    await seedTrip();
    // A: $60 dinner split three ways (Alice paid).
    await createExpense(
      { tripId, description: "Dinner", amount: "60", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, bob, carol] },
      client,
    );
    // G: $20 for Bob & Carol only (Alice paid, excluded).
    await createExpense(
      { tripId, description: "Coffee", amount: "20", expenseDate: "2026-07-02", payerMemberId: alice, includedMemberIds: [bob, carol] },
      client,
    );

    const expenses = await getTripExpenses(tripId, client);
    const net = computeBalances(
      expenses.map((e) => ({
        payerMemberId: e.payerMemberId,
        amount: new Big(e.amount),
        includedMemberIds: e.includedMemberIds,
      })),
      [alice, bob, carol],
      2,
    );

    expect(net.get(alice)!.toString()).toBe("60");
    expect(net.get(bob)!.toString()).toBe("-30");
    expect(net.get(carol)!.toString()).toBe("-30");

    let sum = new Big(0);
    for (const v of net.values()) sum = sum.plus(v);
    expect(sum.eq(0)).toBe(true);
  });
});

describe("custom split (per-person amounts)", () => {
  it("stores each person's exact amount and reports a custom split", async () => {
    await seedTrip();
    const id = await createExpense(
      {
        tripId,
        description: "Dinner (uneven)",
        amount: "60",
        expenseDate: "2026-07-01",
        payerMemberId: alice,
        splitMode: "custom",
        includedMemberIds: [],
        customShares: [
          { memberId: alice, amount: "10" },
          { memberId: bob, amount: "20" },
          { memberId: carol, amount: "30" },
        ],
      },
      client,
    );

    const [exp] = await getTripExpenses(tripId, client);
    expect(exp.id).toBe(id);
    expect(exp.customShares).not.toBeNull();
    expect(exp.customShares!.get(alice)).toBe("10");
    expect(exp.customShares!.get(bob)).toBe("20");
    expect(exp.customShares!.get(carol)).toBe("30");
  });

  it("debits each member their exact share in the balance", async () => {
    await seedTrip();
    await createExpense(
      {
        tripId,
        description: "Dinner (uneven)",
        amount: "60",
        expenseDate: "2026-07-01",
        payerMemberId: alice,
        splitMode: "custom",
        includedMemberIds: [],
        customShares: [
          { memberId: alice, amount: "10" },
          { memberId: bob, amount: "20" },
          { memberId: carol, amount: "30" },
        ],
      },
      client,
    );

    const expenses = await getTripExpenses(tripId, client);
    const net = computeBalances(
      expenses.map((e) => ({
        payerMemberId: e.payerMemberId,
        amount: new Big(e.amount),
        includedMemberIds: e.includedMemberIds,
        customShares: e.customShares
          ? new Map([...e.customShares].map(([k, v]) => [k, new Big(v)]))
          : undefined,
      })),
      [alice, bob, carol],
      2,
    );
    // Alice paid 60, owes 10 → +50; Bob −20; Carol −30.
    expect(net.get(alice)!.toString()).toBe("50");
    expect(net.get(bob)!.toString()).toBe("-20");
    expect(net.get(carol)!.toString()).toBe("-30");
  });

  it("drops zero shares (a person with 0 isn't in the split)", async () => {
    await seedTrip();
    await createExpense(
      {
        tripId,
        description: "Bob & Carol only",
        amount: "50",
        expenseDate: "2026-07-01",
        payerMemberId: alice,
        splitMode: "custom",
        includedMemberIds: [],
        customShares: [
          { memberId: alice, amount: "0" },
          { memberId: bob, amount: "20" },
          { memberId: carol, amount: "30" },
        ],
      },
      client,
    );
    const [exp] = await getTripExpenses(tripId, client);
    expect(exp.includedMemberIds.sort()).toEqual([bob, carol].sort());
    expect(exp.customShares!.has(alice)).toBe(false);
  });

  it("rejects shares that don't add up to the total", async () => {
    await seedTrip();
    await expect(
      createExpense(
        {
          tripId,
          description: "Off by a bit",
          amount: "60",
          expenseDate: "2026-07-01",
          payerMemberId: alice,
          splitMode: "custom",
          includedMemberIds: [],
          customShares: [
            { memberId: alice, amount: "10" },
            { memberId: bob, amount: "20" },
            { memberId: carol, amount: "25" }, // sums to 55, not 60
          ],
        },
        client,
      ),
    ).rejects.toThrowError(/add up|total/i);
  });

  it("rejects an all-zero custom split", async () => {
    await seedTrip();
    await expect(
      createExpense(
        {
          tripId,
          description: "Nothing",
          amount: "10",
          expenseDate: "2026-07-01",
          payerMemberId: alice,
          splitMode: "custom",
          includedMemberIds: [],
          customShares: [{ memberId: alice, amount: "0" }],
        },
        client,
      ),
    ).rejects.toThrowError(/at least one/i);
  });
});

describe("edit / delete (no-auth: anyone with the link)", () => {
  it("edits an expense's fields and split", async () => {
    await seedTrip();
    const id = await makeExpense(bob, [alice, bob, carol]);
    await updateExpense(
      id,
      { description: "Lunch", amount: "30", expenseDate: "2026-07-03", payerMemberId: bob, includedMemberIds: [bob, carol] },
      client,
    );
    const list = await getTripExpenses(tripId, client);
    expect(list[0]).toMatchObject({ description: "Lunch", amount: "30" });
    expect(list[0].includedMemberIds.sort()).toEqual([bob, carol].sort());
  });

  it("delete removes the expense and its shares", async () => {
    await seedTrip();
    const id = await makeExpense();
    await deleteExpense(id, client);
    expect(await getTripExpenses(tripId, client)).toHaveLength(0);
    const shares = await client.execute({
      sql: "SELECT COUNT(*) c FROM expense_shares WHERE expense_id = ?",
      args: [id],
    });
    expect(Number(shares.rows[0].c)).toBe(0);
  });

  it("cannot edit/delete on an archived trip", async () => {
    await seedTrip();
    const id = await makeExpense();
    await client.execute({ sql: "UPDATE trips SET status='closed' WHERE id = ?", args: [tripId] });
    await expect(deleteExpense(id, client)).rejects.toThrowError(/archived/i);
    await expect(
      updateExpense(
        id,
        { description: "x", amount: "1", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice] },
        client,
      ),
    ).rejects.toThrowError(/archived/i);
  });
});
