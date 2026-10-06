import { chromium } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function installedChromium() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (override) {
    if (!existsSync(override))
      throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE does not exist.");
    return override;
  }
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "darwin"
      ? path.join(homedir(), "Library", "Caches", "ms-playwright")
      : path.join(homedir(), ".cache", "ms-playwright"));
  if (!existsSync(cache)) return undefined;
  const versions = readdirSync(cache)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const version of versions) {
    for (const binary of [
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-linux/chrome",
      "chrome-linux64/chrome",
      "chrome-win/chrome.exe",
    ]) {
      const candidate = path.join(cache, version, binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
