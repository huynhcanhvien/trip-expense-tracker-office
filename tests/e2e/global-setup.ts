import "./env";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { db } from "../../src/lib/db";

// Fresh, migrated e2e DB before the suite runs.
export default async function globalSetup() {
  const file = (process.env.TURSO_DATABASE_URL ?? "").replace(/^file:/, "");
  if (file) {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        rmSync(file + suffix);
      } catch {
        // not there yet
      }
    }
  }
  const schema = readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await db().executeMultiple(schema);
}
