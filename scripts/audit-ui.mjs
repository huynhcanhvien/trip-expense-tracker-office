import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import lighthouse from "lighthouse";
import { installedChromium } from "./browser.mjs";

// Only isolated local fixtures are allowed. Never load production credentials.
const fixtureEnv = Object.fromEntries(
  readFileSync(".env.test.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const equal = line.indexOf("=");
      return [line.slice(0, equal), line.slice(equal + 1)];
    }),
);
if (
  !/^(localhost|127\.0\.0\.1)$/.test(
    new URL(fixtureEnv.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw new Error("UI audit requires local Supabase; run npm run e2e:prepare.");
const base = "http://localhost:3200";
const env = { ...process.env, ...fixtureEnv, APP_URL: base, E2E_TEST: "" };
const throttlingMethod = process.argv.includes("--simulate")
  ? "simulate"
  : "devtools";
const output = path.resolve("artifacts/ui-audit", throttlingMethod);
mkdirSync(output, { recursive: true });
const admin = createClient(
  fixtureEnv.NEXT_PUBLIC_SUPABASE_URL,
  fixtureEnv.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
let userId, groupId, browser, chrome, server;
async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* process starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
try {
  console.log(
    "Building production UI against local Supabase (credentials hidden).",
  );
  await new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], { env, stdio: "inherit" });
    build.on("error", reject);
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Production build failed.")),
    );
  });
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3200"],
    { env, stdio: "ignore" },
  );
  await ready(base);
  const chromePath = installedChromium();
  if (!chromePath)
    throw new Error(
      "Install Playwright Chromium or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.",
    );
  chrome = spawn(
    chromePath,
    [
      "--headless",
      "--remote-debugging-port=9223",
      `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "office-ui-audit-"))}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  await ready("http://localhost:9223/json/version");
  browser = await chromium.connectOverCDP("http://localhost:9223");
  const context = browser.contexts()[0];
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  const summaries = [];
  async function audit(name, route) {
    const session = await context.newCDPSession(page);
    await session.send("Network.clearBrowserCache");
    await session.detach();
    const result = await lighthouse(base + route, {
      port: 9223,
      throttlingMethod,
      onlyCategories: ["performance", "accessibility"],
      output: ["html", "json"],
      logLevel: "error",
      disableStorageReset: true,
    });
    if (!result || result.lhr.runtimeError)
      throw new Error(
        result?.lhr.runtimeError?.message || "Lighthouse failed.",
      );
    const { lhr, report } = result;
    const scripts = new Set(
      lhr.audits["network-requests"].details.items
        .filter((item) => item.resourceType === "Script")
        .map((item) => new URL(item.url).pathname)
        .filter((url) => url.startsWith("/_next/static/")),
    );
    const jsGzipBytes = [...scripts].reduce(
      (sum, url) =>
        sum +
        gzipSync(readFileSync(path.join(".next", url.slice("/_next/".length))))
          .length,
      0,
    );
    const row = {
      page: name,
      lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
      cls: lhr.audits["cumulative-layout-shift"].numericValue,
      jsGzipBytes,
      performance: lhr.categories.performance.score * 100,
      accessibility: lhr.categories.accessibility.score * 100,
    };
    summaries.push(row);
    writeFileSync(path.join(output, `${name}.html`), report[0]);
    writeFileSync(path.join(output, `${name}.json`), report[1]);
    console.log(JSON.stringify(row));
    await page.goto(base + route);
    await page.getByRole("main").waitFor();
    if (name === "statistics")
      await page.getByTestId("monthly-chart").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(output, `${name}-desktop.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, `${name}-mobile.png`),
      fullPage: true,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator("html.dark").waitFor();
    await page.screenshot({
      path: path.join(output, `${name}-mobile-dark.png`),
      fullPage: true,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await audit("public", "/");
  const email = `${randomUUID()}@example.test`;
  const password = `Audit-${randomUUID()}!`;
  const created = checked(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "UI audit" },
    }),
  );
  userId = created.user.id;
  const member = createClient(
    fixtureEnv.NEXT_PUBLIC_SUPABASE_URL,
    fixtureEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  checked(await member.auth.signInWithPassword({ email, password }));
  groupId = checked(
    await member.rpc("create_group", {
      p_name: "UI audit group",
      p_currency: "VND",
    }),
  );
  for (const month of ["07", "08", "09", "10"]) {
    checked(
      await member.rpc("save_expense", {
        p_expense_id: null,
        p_group_id: groupId,
        p_description: "Team lunch",
        p_amount: "120000",
        p_expense_date: `2026-${month}-01`,
        p_split_mode: "even",
        p_shares: [{ userId, amount: "0" }],
        p_receipt_upload_id: null,
      }),
    );
  }
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .last()
    .click();
  await page.waitForURL(base + "/");
  await audit("dashboard", "/");
  await audit("statistics", "/statistics?from=2026-07-01&to=2026-10-06");
  const summary = {
    measuredAt: new Date().toISOString(),
    profile: `Lighthouse mobile ${throttlingMethod} throttling; browser cache cleared before every page; local production build; isolated Supabase fixtures; gzip of unique JS chunks loaded by each page`,
    targets: { lcpMs: 2500, cls: 0.1, jsGzipBytes: 300_000 },
    pages: summaries,
  };
  writeFileSync(
    path.join(output, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  if (
    summaries.some(
      (row) =>
        row.lcpMs >= 2500 ||
        row.cls >= 0.1 ||
        row.jsGzipBytes >= 300_000 ||
        row.accessibility < 100,
    )
  )
    throw new Error(
      `UI audit did not meet the targets; inspect artifacts/ui-audit/${throttlingMethod}.`,
    );
} finally {
  if (browser) await browser.close();
  chrome?.kill("SIGTERM");
  server?.kill("SIGTERM");
  if (groupId) {
    const expenses = checked(
      await admin.from("office_expenses").select("id").eq("group_id", groupId),
    );
    const ids = expenses.map((expense) => expense.id);
    if (ids.length) {
      checked(
        await admin.from("payment_events").delete().in("expense_id", ids),
      );
      checked(await admin.from("office_shares").delete().in("expense_id", ids));
    }
    checked(await admin.from("notifications").delete().eq("group_id", groupId));
    checked(
      await admin.from("office_expenses").delete().eq("group_id", groupId),
    );
    checked(await admin.from("office_groups").delete().eq("id", groupId));
  }
  if (userId) checked(await admin.auth.admin.deleteUser(userId));
}
