// `next dev` against local Supabase: .env.test.local (from `npm run e2e:prepare`)
// overrides .env.local, which may point at a hosted project.
import { spawn } from "node:child_process";

process.loadEnvFile(".env.test.local");
if (
  !/^(127\.0\.0\.1|localhost)$/.test(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw new Error(".env.test.local must point at local Supabase.");
spawn("node_modules/.bin/next", ["dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, APP_URL: "http://localhost:3000" },
}).on("exit", (code) => process.exit(code ?? 0));
