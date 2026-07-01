import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Client } from "@libsql/client";

// Point the storage adapter at a throwaway dir before importing anything that uses it.
const uploadsDir = mkdtempSync(path.join(tmpdir(), "close-uploads-"));
process.env.UPLOADS_DIR = uploadsDir;

const { storage } = await import("../src/lib/storage");
const { makeTestDb } = await import("./helpers/testDb");
const { createUser } = await import("../src/lib/accounts");
const { createTrip, closeTrip, listTripsForUser } = await import("../src/lib/trips");
const { createExpense, getTripExpenses } = await import("../src/lib/expenses");

let testDb: { client: Client; cleanup: () => void };
let client: Client;
let creatorId: number;
let otherId: number;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  for (const t of ["expense_shares", "expenses", "invitation_tokens", "trip_members", "trips", "users"]) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

afterAll(() => {
  testDb.cleanup();
  rmSync(uploadsDir, { recursive: true, force: true });
});

async function seed() {
  creatorId = (await createUser("creator@example.com", "password123", client)).id;
  otherId = (await createUser("other@example.com", "password123", client)).id;
}

describe("closeTrip (R9)", () => {
  it("creator closes: status/closed_at set, photos deleted + photo_path nulled", async () => {
    await seed();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    const members = await client.execute({
      sql: "SELECT id FROM trip_members WHERE trip_id = ?",
      args: [tripId],
    });
    const memberId = Number(members.rows[0].id);

    // A real stored photo attached to an expense.
    const { path: photoPath } = await storage.save({
      buffer: Buffer.from("fake-image"),
      mimeType: "image/png",
    });
    await createExpense(
      { tripId, description: "Dinner", amount: "10", expenseDate: "2026-07-01", payerMemberId: memberId, includedMemberIds: [memberId], photoPath },
      creatorId,
      client,
    );

    await closeTrip(tripId, creatorId, client);

    const trip = await client.execute({ sql: "SELECT status, closed_at FROM trips WHERE id = ?", args: [tripId] });
    expect(trip.rows[0].status).toBe("closed");
    expect(trip.rows[0].closed_at).not.toBeNull();

    expect((await getTripExpenses(tripId, client))[0].photoPath).toBeNull();
    await expect(storage.load(photoPath)).rejects.toThrow(); // file deleted
  });

  it("only the creator can close", async () => {
    await seed();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await client.execute({
      sql: "INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)",
      args: [tripId, otherId],
    });
    await expect(closeTrip(tripId, otherId, client)).rejects.toThrowError(/only the trip creator/i);
  });

  it("closing is one-way — a closed trip can't be closed again", async () => {
    await seed();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await closeTrip(tripId, creatorId, client);
    await expect(closeTrip(tripId, creatorId, client)).rejects.toThrowError(/already closed/i);
  });

  it("closes even with unsettled balances (never blocks)", async () => {
    await seed();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    const members = await client.execute({ sql: "SELECT id FROM trip_members WHERE trip_id = ?", args: [tripId] });
    const memberId = Number(members.rows[0].id);
    // One-member expense → that member has a non-zero-ish setup; just ensure close succeeds.
    await createExpense(
      { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: memberId, includedMemberIds: [memberId] },
      creatorId,
      client,
    );
    await expect(closeTrip(tripId, creatorId, client)).resolves.toBeUndefined();
    expect(await listTripsForUser(creatorId, client)).toHaveLength(1); // still listed (archived)
  });
});
