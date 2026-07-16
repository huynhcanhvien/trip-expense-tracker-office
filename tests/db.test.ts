import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Hermetic: apply schema.sql to a fresh in-memory DB (no Turso creds, no local file).
const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/db/schema.sql",
);

let client: Client;

beforeAll(async () => {
  client = createClient({ url: ":memory:" });
  await client.executeMultiple(readFileSync(schemaPath, "utf8"));
});

afterAll(() => client.close());

describe("schema.sql", () => {
  it("creates the four core tables (no accounts)", async () => {
    const res = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = res.rows.map((r) => r.name as string).sort();
    expect(names).toEqual(["expense_shares", "expenses", "trip_members", "trips"].sort());
  });

  it("round-trips a Trip row and enforces a unique public_id", async () => {
    await client.execute({
      sql: "INSERT INTO trips (public_id, name, currency) VALUES (?, ?, ?)",
      args: ["slug-1", "Smoke", "USD"],
    });

    const read = await client.execute({
      sql: "SELECT public_id, name, status FROM trips WHERE public_id = ?",
      args: ["slug-1"],
    });
    expect(read.rows.length).toBe(1);
    expect(read.rows[0].name).toBe("Smoke");
    expect(read.rows[0].status).toBe("open");

    // Duplicate public_id → rejected by the UNIQUE constraint.
    await expect(
      client.execute({
        sql: "INSERT INTO trips (public_id, name, currency) VALUES (?, ?, ?)",
        args: ["slug-1", "Dup", "USD"],
      }),
    ).rejects.toThrow();
  });

  it("rejects an unsupported currency (R6)", async () => {
    await expect(
      client.execute({
        sql: "INSERT INTO trips (public_id, name, currency) VALUES (?, ?, ?)",
        args: ["slug-cur", "Bad", "GBP"], // GBP is not supported
      }),
    ).rejects.toThrow();
  });

  it("requires a participant to have a name", async () => {
    const tripId = await seedTrip("slug-mem");
    await expect(
      client.execute({
        sql: "INSERT INTO trip_members (trip_id, name) VALUES (?, ?)",
        args: [tripId, "Alice"],
      }),
    ).resolves.toBeTruthy();
    // NULL name → rejected (NOT NULL).
    await expect(
      client.execute({ sql: "INSERT INTO trip_members (trip_id) VALUES (?)", args: [tripId] }),
    ).rejects.toThrow();
  });
});

async function seedTrip(publicId: string): Promise<number> {
  const r = await client.execute({
    sql: "INSERT INTO trips (public_id, name, currency) VALUES (?, ?, ?) RETURNING id",
    args: [publicId, "Trip", "USD"],
  });
  return r.rows[0].id as number;
}
