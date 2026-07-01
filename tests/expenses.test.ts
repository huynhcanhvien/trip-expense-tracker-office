import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { Client } from "@libsql/client";
import { makeTestDb, type TestDb } from "./helpers/testDb";
import { createUser } from "../src/lib/accounts";
import { createTrip, addTripMember, listTripMembers } from "../src/lib/trips";
import { createExpense, getTripExpenses, ExpenseError } from "../src/lib/expenses";

let testDb: TestDb;
let client: Client;

// Members: Alice (creator), Bob, Carol — as trip_members.id
let aliceUser: number;
let tripId: number;
let alice: number;
let bob: number;
let carol: number;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  for (const t of ["expense_shares", "expenses", "invitation_tokens", "trip_members", "trips", "users"]) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

afterAll(() => testDb.cleanup());

async function seedTrip(currency: "USD" | "JPY" = "USD") {
  aliceUser = (await createUser("alice@example.com", "password123", client)).id;
  const bobUser = (await createUser("bob@example.com", "password123", client)).id;
  const carolUser = (await createUser("carol@example.com", "password123", client)).id;
  tripId = await createTrip({ name: "Trip", currency }, aliceUser, client);
  await addTripMember(tripId, bobUser, client);
  await addTripMember(tripId, carolUser, client);

  const members = await listTripMembers(tripId, client);
  alice = members.find((m) => m.userId === aliceUser)!.id;
  bob = members.find((m) => m.userId === bobUser)!.id;
  carol = members.find((m) => m.userId === carolUser)!.id;
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
      aliceUser,
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
      aliceUser,
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
        aliceUser,
        client,
      ),
    ).rejects.toThrowError(/at least one/i);
  });

  it("rejects amount <= 0", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "0", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice] },
        aliceUser,
        client,
      ),
    ).rejects.toThrowError(/greater than 0/i);
  });

  it("rejects a payer who isn't a trip member", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: 99999, includedMemberIds: [alice] },
        aliceUser,
        client,
      ),
    ).rejects.toThrowError(/payer must be a trip member/i);
  });

  it("rejects an included member who isn't in the trip", async () => {
    await seedTrip();
    await expect(
      createExpense(
        { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, 99999] },
        aliceUser,
        client,
      ),
    ).rejects.toThrowError(/must be a trip member/i);
  });

  it("normalizes amount to the currency precision (no fractional yen)", async () => {
    await seedTrip("JPY");
    const id = await createExpense(
      { tripId, description: "Ramen", amount: "500.7", expenseDate: "2026-07-01", payerMemberId: alice, includedMemberIds: [alice, bob] },
      aliceUser,
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
        aliceUser,
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
      aliceUser,
      client,
    );
    await createExpense(
      { tripId, description: "Coffee", amount: "20", expenseDate: "2026-07-02", payerMemberId: alice, includedMemberIds: [bob, carol] },
      aliceUser,
      client,
    );

    const list = await getTripExpenses(tripId, client);
    expect(list.map((e) => e.description)).toEqual(["Coffee", "Dinner"]); // newest first
    expect(list.find((e) => e.description === "Coffee")!.includedMemberIds.sort()).toEqual(
      [bob, carol].sort(),
    );
  });
});
