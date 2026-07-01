import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUser, verifyCredentials, AccountError } from "../src/lib/accounts";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/db/schema.sql",
);

let client: Client;

beforeAll(async () => {
  client = createClient({ url: ":memory:" });
  await client.executeMultiple(readFileSync(schemaPath, "utf8"));
});

afterEach(async () => {
  await client.execute("DELETE FROM users");
});

afterAll(() => client.close());

describe("createUser", () => {
  it("creates a user with a normalized (lowercased, trimmed) email", async () => {
    const user = await createUser("  Alice@Example.COM ", "hunter2!", client);
    expect(user.email).toBe("alice@example.com");
    expect(user.id).toBeGreaterThan(0);
  });

  it("stores a bcrypt hash, not the plaintext password", async () => {
    await createUser("bob@example.com", "supersecret", client);
    const row = await client.execute("SELECT password_hash FROM users WHERE email='bob@example.com'");
    expect(row.rows[0].password_hash).not.toBe("supersecret");
  });

  it("rejects registering an existing email with a clear error", async () => {
    await createUser("dup@example.com", "password1", client);
    await expect(createUser("dup@example.com", "password2", client)).rejects.toThrow(AccountError);
    await expect(createUser("DUP@example.com", "password2", client)).rejects.toThrowError(
      /already registered/i,
    );
  });

  it("rejects a too-short password", async () => {
    await expect(createUser("short@example.com", "abc", client)).rejects.toThrowError(
      /at least 8/i,
    );
  });

  it("rejects an invalid email", async () => {
    await expect(createUser("not-an-email", "password1", client)).rejects.toThrowError(
      /valid email/i,
    );
  });
});

describe("verifyCredentials", () => {
  it("returns the user for a correct email/password", async () => {
    await createUser("carol@example.com", "correct-horse", client);
    const user = await verifyCredentials("carol@example.com", "correct-horse", client);
    expect(user).not.toBeNull();
    expect(user!.email).toBe("carol@example.com");
  });

  it("is case-insensitive on the email", async () => {
    await createUser("dave@example.com", "correct-horse", client);
    const user = await verifyCredentials("DAVE@EXAMPLE.COM", "correct-horse", client);
    expect(user).not.toBeNull();
  });

  it("returns null for a wrong password", async () => {
    await createUser("erin@example.com", "correct-horse", client);
    expect(await verifyCredentials("erin@example.com", "wrong-password", client)).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await verifyCredentials("nobody@example.com", "whatever", client)).toBeNull();
  });
});
