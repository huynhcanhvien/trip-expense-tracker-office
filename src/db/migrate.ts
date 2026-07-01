// One-shot migration: read schema.sql and apply it to the DB — plan §2, spec R7.
// Run: npm run migrate  (npx tsx src/db/migrate.ts)
//
// Uses the Turso DB when TURSO_DATABASE_URL is set in .env.local; otherwise
// applies to the local fallback file (see src/lib/db.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../lib/db";

// tsx doesn't auto-load .env.local; load it if present (ignored for the local fallback).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to the local libSQL file
}

async function main() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const sql = readFileSync(schemaPath, "utf8");

  const client = db();
  await client.executeMultiple(sql);

  const target = process.env.TURSO_DATABASE_URL ?? "file:local.db (local fallback)";
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log(`migrate: applied schema to ${target}`);
  console.log(`tables (${tables.rows.length}): ${tables.rows.map((r) => r.name).join(", ")}`);
}

main().catch((err) => {
  console.error("migrate failed:", err);
  process.exit(1);
});
