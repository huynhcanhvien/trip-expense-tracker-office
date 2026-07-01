// Shared e2e environment. Imported first by the config, global-setup, and helpers
// so every process (main, workers, webServer inherits) targets the same isolated
// file DB + console email + local storage.
import path from "node:path";

export const E2E_PORT = 3100;

process.env.TURSO_DATABASE_URL ||= `file:${path.join(process.cwd(), "e2e.db")}`;
process.env.AUTH_SECRET ||= "e2e-secret-e2e-secret-e2e-secret-1234567890";
process.env.AUTH_URL ||= `http://localhost:${E2E_PORT}`;
process.env.EMAIL_ADAPTER ||= "console";
process.env.STORAGE_ADAPTER ||= "local";
process.env.UPLOADS_DIR ||= path.join(process.cwd(), ".e2e-uploads");
