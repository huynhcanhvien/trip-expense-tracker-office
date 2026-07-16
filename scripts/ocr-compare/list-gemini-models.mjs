// Lists Gemini models your key can use for generateContent.
//   node scripts/ocr-compare/list-gemini-models.mjs
// Reads GEMINI_API_KEY from .env.local (or the environment).

import { loadEnvLocal } from "./env.mjs";

loadEnvLocal();

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY not found in .env.local or environment.");
  process.exit(1);
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1000`);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { models = [] } = await res.json();
const usable = models.filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"));

console.log(`\n${usable.length} models support generateContent:\n`);
for (const m of usable) {
  const flash = /flash/i.test(m.name) ? "  <- flash (good for this)" : "";
  console.log(`  ${m.name.replace("models/", "")}${flash}`);
}
console.log();
