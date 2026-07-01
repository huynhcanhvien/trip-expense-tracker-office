// Turso (LibSQL) connection — see plan §1, §2. Filled in by T4.
// NOTE: the client is async (Promise-based); every DB call uses `await`.
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/** Module-scoped singleton so warm serverless invocations reuse the connection (plan §5). */
export function db(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  client = createClient({ url, authToken });
  return client;
}
