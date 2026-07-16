// Shared e2e environment. Imported first by the config, global-setup, and helpers
// so every process (main, workers, webServer inherits) targets the same isolated
// file DB + local storage.
import path from "node:path";

export const E2E_PORT = 3100;

process.env.TURSO_DATABASE_URL ||= `file:${path.join(process.cwd(), "e2e.db")}`;
process.env.APP_URL ||= `http://localhost:${E2E_PORT}`;
process.env.STORAGE_ADAPTER ||= "local";
process.env.UPLOADS_DIR ||= path.join(process.cwd(), ".e2e-uploads");
