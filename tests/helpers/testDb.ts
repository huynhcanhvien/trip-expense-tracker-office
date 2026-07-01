// Test DB helper. Uses a unique temp FILE (not bare ":memory:") so code paths
// that open a transaction work — libsql's transaction() uses a fresh connection,
// and each ":memory:" connection is a separate empty database.
import { createClient, type Client } from "@libsql/client";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/db/schema.sql",
);

export interface TestDb {
  client: Client;
  cleanup: () => void;
}

export async function makeTestDb(): Promise<TestDb> {
  const file = path.join(
    tmpdir(),
    `tet-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`,
  );
  const client = createClient({ url: `file:${file}` });
  await client.executeMultiple(readFileSync(schemaPath, "utf8"));

  return {
    client,
    cleanup: () => {
      client.close();
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          unlinkSync(file + suffix);
        } catch {
          // already gone
        }
      }
    },
  };
}
