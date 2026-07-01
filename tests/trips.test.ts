import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { Client } from "@libsql/client";
import { makeTestDb, type TestDb } from "./helpers/testDb";
import {
  createTrip,
  getTripForUser,
  listTripsForUser,
  listTripMembers,
  getInvitationToken,
  getTripByInviteToken,
  isMember,
  countExpenses,
  addTripMember,
  addGhostMember,
  TripError,
} from "../src/lib/trips";
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

describe("listTripsForUser", () => {
  it("lists only the user's trips with member counts", async () => {
    await seedUsers();
    const t1 = await createTrip({ name: "Mine A", currency: "USD" }, creatorId, client);
    await createTrip({ name: "Mine B", currency: "EUR" }, creatorId, client);
    // A trip the creator is NOT part of.
    await createTrip({ name: "Not mine", currency: "GBP" }, outsiderId, client);
    // Add the outsider to trip 1 → member count 2.
    await client.execute({
      sql: "INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)",
      args: [t1, outsiderId],
    });

    const trips = await listTripsForUser(creatorId, client);
    expect(trips.map((t) => t.name).sort()).toEqual(["Mine A", "Mine B"]);
    expect(trips.find((t) => t.id === t1)!.memberCount).toBe(2);
  });

  it("separates active from archived by status", async () => {
    await seedUsers();
    const openId = await createTrip({ name: "Open", currency: "USD" }, creatorId, client);
    const closedId = await createTrip({ name: "Closed", currency: "USD" }, creatorId, client);
    await client.execute({
      sql: "UPDATE trips SET status='closed', closed_at=datetime('now') WHERE id = ?",
      args: [closedId],
    });

    const trips = await listTripsForUser(creatorId, client);
    expect(trips.find((t) => t.id === openId)!.status).toBe("open");
    expect(trips.find((t) => t.id === closedId)!.status).toBe("closed");
  });

  it("returns an empty array for a user with no trips", async () => {
    await seedUsers();
    expect(await listTripsForUser(outsiderId, client)).toEqual([]);
  });
});

describe("listTripMembers + getInvitationToken", () => {
  it("lists the creator as a registered member and exposes the invite token", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);

    const members = await listTripMembers(tripId, client);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: creatorId,
      isGhost: false,
      displayName: "creator@example.com",
    });

    const token = await getInvitationToken(tripId, client);
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThanOrEqual(40);
  });

  it("renders ghost members by their name", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await client.execute({
      sql: "INSERT INTO trip_members (trip_id, ghost_name) VALUES (?, ?)",
      args: [tripId, "Grandma"],
    });

    const members = await listTripMembers(tripId, client);
    const ghost = members.find((m) => m.isGhost);
    expect(ghost).toMatchObject({ userId: null, isGhost: true, displayName: "Grandma" });
  });
});

describe("invitation accept (scenario F, R1)", () => {
  it("resolves a trip from its invite token", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Invite Trip", currency: "USD" }, creatorId, client);
    const token = (await getInvitationToken(tripId, client))!;

    expect((await getTripByInviteToken(token, client))?.id).toBe(tripId);
    expect(await getTripByInviteToken("bogus-token", client)).toBeNull();
  });

  it("addTripMember is idempotent — re-accepting never duplicates", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);

    expect(await isMember(tripId, outsiderId, client)).toBe(false);
    await addTripMember(tripId, outsiderId, client);
    await addTripMember(tripId, outsiderId, client); // repeat
    expect(await isMember(tripId, outsiderId, client)).toBe(true);

    const members = await listTripMembers(tripId, client);
    expect(members.filter((m) => m.userId === outsiderId)).toHaveLength(1);
  });

  it("counts expenses for the preview", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    expect(await countExpenses(tripId, client)).toBe(0);
  });
});

describe("addGhostMember (R1 ghost path)", () => {
  it("lets any member add a ghost, who appears as a guest", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    // Outsider joins, then adds a ghost (any member can).
    await addTripMember(tripId, outsiderId, client);

    await addGhostMember(tripId, "  Grandpa  ", outsiderId, client);
    const members = await listTripMembers(tripId, client);
    const ghost = members.find((m) => m.isGhost);
    expect(ghost).toMatchObject({ userId: null, isGhost: true, displayName: "Grandpa" });
  });

  it("rejects a non-member", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await expect(addGhostMember(tripId, "X", outsiderId, client)).rejects.toThrowError(
      /not a member/i,
    );
  });

  it("rejects an empty name", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await expect(addGhostMember(tripId, "   ", creatorId, client)).rejects.toThrowError(
      /name is required/i,
    );
  });

  it("rejects adding to an archived trip", async () => {
    await seedUsers();
    const tripId = await createTrip({ name: "Trip", currency: "USD" }, creatorId, client);
    await client.execute({ sql: "UPDATE trips SET status='closed' WHERE id = ?", args: [tripId] });
    await expect(addGhostMember(tripId, "Late", creatorId, client)).rejects.toThrowError(
      /archived/i,
    );
  });
});
