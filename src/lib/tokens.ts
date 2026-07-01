// Invitation / verification / reset tokens — plan §3.3.
// CSPRNG, URL-safe base64. Verification + reset tokens are single-use (marked
// atomically); invitation tokens (R1) are reusable and handled separately (T10).
import { randomBytes } from "node:crypto";
import type { Client } from "@libsql/client";
import { db } from "./db";

/** A cryptographically-random, URL-safe token (default 32 bytes). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// --- Email verification (spec R8) ---

export async function createEmailVerificationToken(
  userId: number,
  client: Client = db(),
): Promise<string> {
  const token = generateToken();
  await client.execute({
    sql: "INSERT INTO email_verification_tokens (user_id, token) VALUES (?, ?)",
    args: [userId, token],
  });
  return token;
}

/**
 * Consume a verification token and mark the user verified. Single-use: the
 * claim is a single atomic UPDATE guarded by `used_at IS NULL`, so a replay
 * (or a race) finds no unused row and returns null. Returns the user id on
 * success, or null if the token is unknown or already used.
 */
export async function consumeEmailVerificationToken(
  token: string,
  client: Client = db(),
): Promise<number | null> {
  const claim = await client.execute({
    sql: `UPDATE email_verification_tokens
             SET used_at = datetime('now')
           WHERE token = ? AND used_at IS NULL
       RETURNING user_id`,
    args: [token],
  });
  if (claim.rows.length === 0) return null;

  const userId = Number(claim.rows[0].user_id);
  await client.execute({
    sql: "UPDATE users SET email_verified_at = datetime('now') WHERE id = ? AND email_verified_at IS NULL",
    args: [userId],
  });
  return userId;
}
