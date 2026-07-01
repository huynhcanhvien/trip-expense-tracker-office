import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPasswordResetToken, consumePasswordResetToken } from "../src/lib/tokens";
import { createUser, verifyCredentials, resetPassword, getUserByEmail, AccountError } from "../src/lib/accounts";

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
  await client.execute("DELETE FROM password_reset_tokens");
  await client.execute("DELETE FROM users");
});

afterAll(() => client.close());

describe("password reset tokens", () => {
  it("is single-use", async () => {
    const user = await createUser("t@example.com", "password123", client);
    const token = await createPasswordResetToken(user.id, client);
    expect(await consumePasswordResetToken(token, client)).toBe(user.id);
    expect(await consumePasswordResetToken(token, client)).toBeNull();
  });
});

describe("getUserByEmail", () => {
  it("returns null for an unknown email (no enumeration signal)", async () => {
    expect(await getUserByEmail("ghost@example.com", client)).toBeNull();
  });
  it("finds a known user case-insensitively", async () => {
    await createUser("known@example.com", "password123", client);
    const u = await getUserByEmail("KNOWN@EXAMPLE.COM", client);
    expect(u?.email).toBe("known@example.com");
  });
});

describe("resetPassword", () => {
  it("changes the password; old fails, new works", async () => {
    await createUser("r@example.com", "oldpassword", client);
    const { id } = (await getUserByEmail("r@example.com", client))!;
    const token = await createPasswordResetToken(id, client);

    expect(await resetPassword(token, "newpassword", client)).toBe(true);

    expect(await verifyCredentials("r@example.com", "oldpassword", client)).toBeNull();
    expect(await verifyCredentials("r@example.com", "newpassword", client)).not.toBeNull();
  });

  it("rejects reuse of the same token", async () => {
    const user = await createUser("r2@example.com", "oldpassword", client);
    const token = await createPasswordResetToken(user.id, client);
    expect(await resetPassword(token, "newpassword", client)).toBe(true);
    expect(await resetPassword(token, "another-pass", client)).toBe(false);
  });

  it("returns false for an unknown token", async () => {
    expect(await resetPassword("nope", "newpassword", client)).toBe(false);
  });

  it("rejects a too-short password WITHOUT burning the token", async () => {
    const user = await createUser("r3@example.com", "oldpassword", client);
    const token = await createPasswordResetToken(user.id, client);

    await expect(resetPassword(token, "short", client)).rejects.toThrow(AccountError);
    // token survived → a valid password still works
    expect(await resetPassword(token, "properlength", client)).toBe(true);
  });
});
