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
  it("creates all 8 tables", async () => {
    const res = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = res.rows.map((r) => r.name as string).sort();
    expect(names).toEqual(
      [
        "email_verification_tokens",
        "expense_shares",
        "expenses",
        "invitation_tokens",
        "password_reset_tokens",
        "trip_members",
        "trips",
        "users",
      ].sort(),
    );
  });

  it("round-trips a User row (insert → read → delete)", async () => {
    await client.execute({
      sql: "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      args: ["smoke@test.local", "hash"],
    });

    const read = await client.execute({
      sql: "SELECT id, email, email_verified_at FROM users WHERE email = ?",
      args: ["smoke@test.local"],
    });
    expect(read.rows.length).toBe(1);
    expect(read.rows[0].email).toBe("smoke@test.local");
    expect(read.rows[0].email_verified_at).toBeNull();

    const id = read.rows[0].id as number;
    await client.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });

    const gone = await client.execute({ sql: "SELECT 1 FROM users WHERE id = ?", args: [id] });
    expect(gone.rows.length).toBe(0);
  });

  it("rejects an unsupported currency (R6)", async () => {
    const uid = await seedUser("cur@test.local");
    await expect(
      client.execute({
        sql: "INSERT INTO trips (name, currency, creator_user_id) VALUES (?, ?, ?)",
        args: ["Bad", "GBP", uid], // GBP is no longer supported
      }),
    ).rejects.toThrow();
  });

  it("enforces the TripMember user_id XOR ghost_name CHECK (plan §2)", async () => {
    const uid = await seedUser("member@test.local");
    const tripId = await seedTrip(uid);

    // A registered member and a ghost are both valid.
    await expect(
      client.execute({
        sql: "INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)",
        args: [tripId, uid],
      }),
    ).resolves.toBeTruthy();
    await expect(
      client.execute({
        sql: "INSERT INTO trip_members (trip_id, ghost_name) VALUES (?, ?)",
        args: [tripId, "Ghosty"],
      }),
    ).resolves.toBeTruthy();

    // Both set → rejected.
    await expect(
      client.execute({
        sql: "INSERT INTO trip_members (trip_id, user_id, ghost_name) VALUES (?, ?, ?)",
        args: [tripId, uid, "Nope"],
      }),
    ).rejects.toThrow();

    // Neither set → rejected.
    await expect(
      client.execute({ sql: "INSERT INTO trip_members (trip_id) VALUES (?)", args: [tripId] }),
    ).rejects.toThrow();
  });
});

async function seedUser(email: string): Promise<number> {
  const r = await client.execute({
    sql: "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
    args: [email, "hash"],
  });
  return r.rows[0].id as number;
}

async function seedTrip(uid: number): Promise<number> {
  const r = await client.execute({
    sql: "INSERT INTO trips (name, currency, creator_user_id) VALUES (?, ?, ?) RETURNING id",
    args: ["Trip", "USD", uid],
  });
  return r.rows[0].id as number;
}
