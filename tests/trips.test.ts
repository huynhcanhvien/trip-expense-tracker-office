import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { Client } from "@libsql/client";
import { makeTestDb, type TestDb } from "./helpers/testDb";
import { createTrip, getTripForUser, TripError } from "../src/lib/trips";
import { createUser } from "../src/lib/accounts";

let testDb: TestDb;
let client: Client;
let creatorId: number;
let outsiderId: number;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  await client.execute("DELETE FROM invitation_tokens");
  await client.execute("DELETE FROM expense_shares");
  await client.execute("DELETE FROM expenses");
  await client.execute("DELETE FROM trip_members");
  await client.execute("DELETE FROM trips");
  await client.execute("DELETE FROM users");
});

afterAll(() => testDb.cleanup());

async function seedUsers() {
  creatorId = (await createUser("creator@example.com", "password123", client)).id;
  outsiderId = (await createUser("outsider@example.com", "password123", client)).id;
}

describe("createTrip", () => {
  it("creates the trip, the creator membership, and one invitation token", async () => {
    await seedUsers();
    const tripId = await createTrip(
      { name: "Tokyo 2026", currency: "JPY", dateStart: "2026-04-01", dateEnd: "2026-04-10" },
      creatorId,
      client,
    );

    const trip = await client.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [tripId] });
    expect(trip.rows[0].name).toBe("Tokyo 2026");
    expect(trip.rows[0].currency).toBe("JPY");
    expect(trip.rows[0].status).toBe("open");
    expect(trip.rows[0].creator_user_id).toBe(creatorId);

    const members = await client.execute({
      sql: "SELECT user_id FROM trip_members WHERE trip_id = ?",
      args: [tripId],
    });
    expect(members.rows.map((r) => r.user_id)).toEqual([creatorId]);

    const tokens = await client.execute({
      sql: "SELECT token FROM invitation_tokens WHERE trip_id = ?",
      args: [tripId],
    });
    expect(tokens.rows.length).toBe(1);
    expect(String(tokens.rows[0].token).length).toBeGreaterThanOrEqual(40);
  });

  it("allows optional dates to be omitted", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Weekend", currency: "USD" }, creatorId, client);
    const trip = await client.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [tripId] });
    expect(trip.rows[0].date_start).toBeNull();
    expect(trip.rows[0].date_end).toBeNull();
  });

  it("rejects a missing name", async () => {
    await seedUsers();
    await expect(createTrip({ name: "  ", currency: "USD" }, creatorId, client)).rejects.toThrowError(
      /name is required/i,
    );
  });

  it("rejects end date before start date", async () => {
    await seedUsers();
    await expect(
      createTrip(
        { name: "Bad dates", currency: "USD", dateStart: "2026-05-10", dateEnd: "2026-05-01" },
        creatorId,
        client,
      ),
    ).rejects.toThrowError(/before the start date/i);
  });

  it("rejects an unsupported currency", async () => {
    await seedUsers();
    await expect(
      // @ts-expect-error deliberately passing an unsupported currency
      createTrip({ name: "Nope", currency: "CNY" }, creatorId, client),
    ).rejects.toThrow(TripError);
  });
});

describe("getTripForUser", () => {
  it("returns the trip for a member, null for a non-member", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    expect((await getTripForUser(tripId, creatorId, client))?.name).toBe("Trip");
    expect(await getTripForUser(tripId, outsiderId, client)).toBeNull();
  });

  it("returns null for a non-existent trip", async () => {
    await seedUsers();
    expect(await getTripForUser(99999, creatorId, client)).toBeNull();
  });
});
