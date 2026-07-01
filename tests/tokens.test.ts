import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
} from "../src/lib/tokens";
import { createUser, verifyCredentials } from "../src/lib/accounts";

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
  await client.execute("DELETE FROM email_verification_tokens");
  await client.execute("DELETE FROM users");
});

afterAll(() => client.close());

describe("generateToken", () => {
  it("returns URL-safe, unpredictable tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no +/= padding
    expect(a.length).toBeGreaterThanOrEqual(40);
  });
});

describe("email verification tokens", () => {
  it("verifies a user on first use and flips email_verified_at", async () => {
    const user = await createUser("v@example.com", "password123", client);
    expect((await verifyCredentials("v@example.com", "password123", client))!.emailVerified).toBe(
      false,
    );

    const token = await createEmailVerificationToken(user.id, client);
    const verifiedUserId = await consumeEmailVerificationToken(token, client);
    expect(verifiedUserId).toBe(user.id);

    expect((await verifyCredentials("v@example.com", "password123", client))!.emailVerified).toBe(
      true,
    );
  });

  it("is single-use: reusing a token is rejected", async () => {
    const user = await createUser("reuse@example.com", "password123", client);
    const token = await createEmailVerificationToken(user.id, client);

    expect(await consumeEmailVerificationToken(token, client)).toBe(user.id);
    expect(await consumeEmailVerificationToken(token, client)).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    expect(await consumeEmailVerificationToken("does-not-exist", client)).toBeNull();
  });
});
