import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { Client } from "@libsql/client";
import { makeTestDb, type TestDb } from "./helpers/testDb";
import {
  createTrip,
  getTripByPublicId,
  getTripById,
  getTripSummaries,
  listTripMembers,
  countExpenses,
  addParticipant,
  TripError,
} from "../src/lib/trips";

let testDb: TestDb;
let client: Client;

beforeAll(async () => {
  testDb = await makeTestDb();
  client = testDb.client;
});

afterEach(async () => {
  await client.execute("DELETE FROM expense_shares");
  await client.execute("DELETE FROM expenses");
  await client.execute("DELETE FROM trip_members");
  await client.execute("DELETE FROM trips");
});

afterAll(() => testDb.cleanup());

describe("createTrip", () => {
  it("creates the trip with a unique public_id and returns it", async () => {
    const publicId = await createTrip({ name: "Tokyo 2026", currency: "JPY" }, client);
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{10,}$/);

    const trip = await getTripByPublicId(publicId, client);
    expect(trip?.name).toBe("Tokyo 2026");
    expect(trip?.currency).toBe("JPY");
    expect(trip?.status).toBe("open");
  });

  it("seeds any participant names given on the create form", async () => {
    const publicId = await createTrip(
      { name: "Roadtrip", currency: "USD", participants: ["  Alice  ", "Bob"] },
      client,
    );
    const trip = (await getTripByPublicId(publicId, client))!;
    const members = await listTripMembers(trip.id, client);
    expect(members.map((m) => m.displayName)).toEqual(["Alice", "Bob"]);
  });

  it("creates a trip with no participants (added later on the trip page)", async () => {
    const publicId = await createTrip({ name: "Solo", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;
    expect(await listTripMembers(trip.id, client)).toEqual([]);
  });

  it("rejects a missing name", async () => {
    await expect(createTrip({ name: "  ", currency: "USD" }, client)).rejects.toThrowError(
      /name is required/i,
    );
  });

  it("rejects an unsupported currency", async () => {
    await expect(
      // @ts-expect-error deliberately passing an unsupported currency
      createTrip({ name: "Nope", currency: "GBP" }, client),
    ).rejects.toThrow(TripError);
  });

  it("rejects duplicate participant names (case-insensitive)", async () => {
    await expect(
      createTrip({ name: "Trip", currency: "USD", participants: ["Alice", "alice"] }, client),
    ).rejects.toThrowError(/unique/i);
  });
});

describe("getTripByPublicId / getTripById", () => {
  it("resolves a trip by its public slug and by internal id", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const byPublic = await getTripByPublicId(publicId, client);
    expect(byPublic?.name).toBe("Trip");
    const byId = await getTripById(byPublic!.id, client);
    expect(byId?.public_id).toBe(publicId);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getTripByPublicId("does-not-exist", client)).toBeNull();
  });
});

describe("getTripSummaries", () => {
  it("returns summaries with member counts, in the order requested", async () => {
    const a = await createTrip({ name: "A", currency: "USD", participants: ["x", "y"] }, client);
    const b = await createTrip({ name: "B", currency: "EUR" }, client);

    const summaries = await getTripSummaries([b, a], client);
    expect(summaries.map((s) => s.name)).toEqual(["B", "A"]);
    expect(summaries.find((s) => s.public_id === a)!.memberCount).toBe(2);
    expect(summaries.find((s) => s.public_id === b)!.memberCount).toBe(0);
  });

  it("silently drops unknown ids", async () => {
    const a = await createTrip({ name: "A", currency: "USD" }, client);
    const summaries = await getTripSummaries(["ghost", a], client);
    expect(summaries.map((s) => s.public_id)).toEqual([a]);
  });

  it("returns an empty array for no ids", async () => {
    expect(await getTripSummaries([], client)).toEqual([]);
  });
});

describe("addParticipant", () => {
  it("adds a participant by name (trimmed) and returns its id", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;

    const id = await addParticipant(trip.id, "  Grandma  ", client);
    const members = await listTripMembers(trip.id, client);
    expect(members).toEqual([{ id, displayName: "Grandma" }]);
  });

  it("rejects an empty name", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;
    await expect(addParticipant(trip.id, "   ", client)).rejects.toThrowError(/name is required/i);
  });

  it("rejects adding to an archived trip", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;
    await client.execute({ sql: "UPDATE trips SET status='closed' WHERE id = ?", args: [trip.id] });
    await expect(addParticipant(trip.id, "Late", client)).rejects.toThrowError(/archived/i);
  });

  it("rejects a missing trip", async () => {
    await expect(addParticipant(99999, "X", client)).rejects.toThrowError(/not found/i);
  });

  it("rejects a name already on the trip (case-insensitive)", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;
    await addParticipant(trip.id, "Grandma", client);
    await expect(addParticipant(trip.id, "  grandma  ", client)).rejects.toThrowError(
      /already called/i,
    );
    // A different name is still fine.
    await expect(addParticipant(trip.id, "Grandpa", client)).resolves.toBeTypeOf("number");
  });
});

describe("countExpenses", () => {
  it("counts a trip's expenses", async () => {
    const publicId = await createTrip({ name: "Trip", currency: "USD" }, client);
    const trip = (await getTripByPublicId(publicId, client))!;
    expect(await countExpenses(trip.id, client)).toBe(0);
  });
});
