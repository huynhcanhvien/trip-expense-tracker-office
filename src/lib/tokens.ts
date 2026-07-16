// Random slugs for shareable trip URLs (trips.public_id).
import { randomBytes } from "node:crypto";

/** A cryptographically-random, URL-safe token (default 16 bytes ≈ 22 chars). */
export function generateToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
