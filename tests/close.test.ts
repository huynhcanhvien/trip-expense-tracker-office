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
const { createTrip, getTripByPublicId, addParticipant, closeTrip } = await import("../src/lib/trips");
const { createExpense, getTripExpenses } = await import("../src/lib/expenses");

let testDb: { client: Client; cleanup: () => void };
let client: Client;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  for (const t of ["expense_shares", "expenses", "trip_members", "trips"]) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

afterAll(() => {
  testDb.cleanup();
  rmSync(uploadsDir, { recursive: true, force: true });
});

async function seedTrip(): Promise<{ tripId: number; memberId: number }> {
  const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
  const trip = (await getTripByPublicId(publicId, client))!;
  const memberId = await addParticipant(trip.id, "Alice", client);
  return { tripId: trip.id, memberId };
}

describe("closeTrip (R9)", () => {
  it("closes: status/closed_at set, photos deleted + photo_path nulled", async () => {
    const { tripId, memberId } = await seedTrip();

    // A real stored photo attached to an expense.
    const { path: photoPath } = await storage.save({
      buffer: Buffer.from("fake-image"),
      mimeType: "image/png",
    });
    await createExpense(
      { tripId, description: "Dinner", amount: "10", expenseDate: "2026-07-01", payerMemberId: memberId, includedMemberIds: [memberId], photoPath },
      client,
    );

    await closeTrip(tripId, client);

    const trip = await client.execute({ sql: "SELECT status, closed_at FROM trips WHERE id = ?", args: [tripId] });
    expect(trip.rows[0].status).toBe("closed");
    expect(trip.rows[0].closed_at).not.toBeNull();

    expect((await getTripExpenses(tripId, client))[0].photoPath).toBeNull();
    await expect(storage.load(photoPath)).rejects.toThrow(); // file deleted
  });

  it("closing is one-way — a closed trip can't be closed again", async () => {
    const { tripId } = await seedTrip();
    await closeTrip(tripId, client);
    await expect(closeTrip(tripId, client)).rejects.toThrowError(/already closed/i);
  });

  it("rejects a missing trip", async () => {
    await expect(closeTrip(99999, client)).rejects.toThrowError(/not found/i);
  });

  it("closes even with unsettled balances (never blocks)", async () => {
    const { tripId, memberId } = await seedTrip();
    await createExpense(
      { tripId, description: "x", amount: "10", expenseDate: "2026-07-01", payerMemberId: memberId, includedMemberIds: [memberId] },
      client,
    );
    await expect(closeTrip(tripId, client)).resolves.toBeUndefined();
    const trip = await client.execute({ sql: "SELECT status FROM trips WHERE id = ?", args: [tripId] });
    expect(trip.rows[0].status).toBe("closed");
  });
});
