// Account creation + credential verification — spec R8 (login/register half).
// Pure-ish helpers so they can be unit-tested against any libSQL client.
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Client } from "@libsql/client";
import { db } from "./db";

const BCRYPT_ROUNDS = 10;

/** A user-facing error (safe to show in the UI). */
export class AccountError extends Error {}

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface PublicUser {
  id: number;
  email: string;
}

export interface AuthUser extends PublicUser {
  /** Whether the account's email has been verified (spec R8). */
  emailVerified: boolean;
}

/**
 * Create a new account. Throws AccountError on invalid input or duplicate email.
 * Email is not verified here — that's T6 (login is allowed with email_verified_at NULL until then).
 */
export async function createUser(
  email: string,
  password: string,
  client: Client = db(),
): Promise<PublicUser> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new AccountError(parsed.error.issues[0]?.message ?? "Invalid email or password");
  }
  const clean = parsed.data;

  const existing = await client.execute({
    sql: "SELECT 1 FROM users WHERE email = ?",
    args: [clean.email],
  });
  if (existing.rows.length > 0) {
    throw new AccountError("That email is already registered");
  }

  const hash = bcrypt.hashSync(clean.password, BCRYPT_ROUNDS);
  const inserted = await client.execute({
    sql: "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email",
    args: [clean.email, hash],
  });

  const row = inserted.rows[0];
  return { id: Number(row.id), email: String(row.email) };
}

/**
 * Verify an email/password pair. Returns the user on success, or null on any
 * failure (unknown email or wrong password) — callers must not distinguish.
 */
export async function verifyCredentials(
  email: string,
  password: string,
  client: Client = db(),
): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const res = await client.execute({
    sql: "SELECT id, email, password_hash, email_verified_at FROM users WHERE email = ?",
    args: [normalizedEmail],
  });
  const row = res.rows[0];
  if (!row) return null;

  const ok = bcrypt.compareSync(password, String(row.password_hash));
  if (!ok) return null;

  return {
    id: Number(row.id),
    email: String(row.email),
    emailVerified: row.email_verified_at != null,
  };
}
