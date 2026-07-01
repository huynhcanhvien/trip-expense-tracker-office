// Turso (LibSQL) connection — plan §1, §2, spec R7.
// The client is async (Promise-based); every DB call uses `await`.
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/**
 * Module-scoped singleton so warm serverless invocations reuse the connection
 * (plan §5). Uses the Turso remote DB when TURSO_DATABASE_URL is set; otherwise
 * falls back to a local libSQL file (`file:local.db`) for offline dev/tests —
 * same SQL, so nothing else changes when we point at Turso later.
 */
export function db(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  client = createClient(authToken ? { url, authToken } : { url });
  return client;
}
