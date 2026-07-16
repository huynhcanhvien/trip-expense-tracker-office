// Receipt-extraction bake-off: run the same image through three backends and
// print their {merchant, amount, date} + latency side by side.
//
//   node scripts/ocr-compare/compare.mjs [imagePath]
//
// Backends (each is skipped with a note if its dependency isn't available):
//   1. gemini  — Gemini API (needs GEMINI_API_KEY), image -> structured JSON
//   2. ollama  — local VLM via Ollama (qwen2.5-vl:3b, moondream), image -> JSON
//   3. paddle  — PaddleOCR (python) -> raw text -> small text LLM (qwen2.5:1.5b) -> JSON
//
// The extraction contract is identical for every backend so the comparison is fair.

import { readFileSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadEnvLocal } from "./env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- shared extraction contract -------------------------------------------
const PROMPT = `You are extracting fields from a photo of a purchase receipt.
Return ONLY these three fields:
- merchant: the store/restaurant name (the receipt's header/business name), or null if none.
- amount: the FINAL total the customer paid — the grand total INCLUDING tax, fees, and tip. This is NOT the subtotal. Return a plain decimal string like "131.78" with no currency symbol or thousands separators. null if unreadable.
- date: the purchase date as "YYYY-MM-DD", or null if no date is visible.`;

// JSON Schema (Ollama `format`, and adapted for Gemini `responseSchema`).
const JSON_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"] },
    amount: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
  },
  required: ["merchant", "amount", "date"],
};

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic" }[ext] ??
    "application/octet-stream"
  );
}

// Pull the first {...} JSON object out of a model's text response.
function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return null;
  }
}

// ---- backend 1: Gemini -----------------------------------------------------
async function runGemini(imgBase64, mime) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { skipped: "GEMINI_API_KEY not set (add it to .env.local)" };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: mime, data: imgBase64 } }, { text: PROMPT }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          merchant: { type: "STRING", nullable: true },
          amount: { type: "STRING", nullable: true },
          date: { type: "STRING", nullable: true },
        },
        required: ["merchant", "amount", "date"],
      },
    },
  };

  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { fields: parseJsonLoose(text), raw: text };
}

// ---- Ollama helpers --------------------------------------------------------
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";

async function ollamaUp() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return null;
    return (await r.json()).models?.map((m) => m.name) ?? [];
  } catch {
    return null;
  }
}

async function ollamaGenerate({ model, prompt, images }) {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, images, stream: false, format: JSON_SCHEMA, options: { temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).response ?? "";
}

// ---- backend 2: local VLM via Ollama --------------------------------------
async function runOllamaVlm(imgBase64, installed, model) {
  if (installed == null) return { skipped: "Ollama not reachable at " + OLLAMA };
  const has = installed.some((m) => m === model || m.startsWith(model.split(":")[0] + ":"));
  if (!has) return { skipped: `model '${model}' not pulled (ollama pull ${model})` };
  try {
    const text = await ollamaGenerate({ model, prompt: PROMPT, images: [imgBase64] });
    return { fields: parseJsonLoose(text), raw: text };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// ---- backend 3: PaddleOCR -> small text LLM --------------------------------
function runPaddleRawText(imagePath) {
  return new Promise((resolve) => {
    // Prefer the project venv python (Paddle installs there), fall back to system python3.
    const venvPy = path.join(HERE, ".venv", "bin", "python");
    const py = spawn(existsSync(venvPy) ? venvPy : "python3", [path.join(HERE, "paddle_ocr.py"), imagePath]);
    let out = "", err = "";
    py.stdout.on("data", (d) => (out += d));
    py.stderr.on("data", (d) => (err += d));
    py.on("error", (e) => resolve({ error: `spawn failed: ${e.message}` }));
    py.on("close", (code) => {
      if (code !== 0) return resolve({ error: `paddle exited ${code}: ${err.slice(-300)}` });
      const parsed = parseJsonLoose(out);
      if (!parsed) return resolve({ error: `bad paddle output: ${out.slice(0, 200)}` });
      resolve({ text: parsed.text ?? "" });
    });
  });
}

async function runPaddlePipeline(imagePath, installed, model) {
  const paddle = await runPaddleRawText(imagePath);
  if (paddle.error) return { skipped: `PaddleOCR unavailable — ${paddle.error}` };
  if (installed == null) return { error: `got raw text but Ollama down for the extractor LLM`, rawText: paddle.text };
  const has = installed.some((m) => m === model || m.startsWith(model.split(":")[0] + ":"));
  if (!has) return { error: `got raw text but '${model}' not pulled (ollama pull ${model})`, rawText: paddle.text };
  try {
    const text = await ollamaGenerate({
      model,
      prompt: `${PROMPT}\n\nHere is the raw OCR text of the receipt:\n"""\n${paddle.text}\n"""`,
    });
    return { fields: parseJsonLoose(text), raw: text, rawText: paddle.text };
  } catch (e) {
    return { error: String(e.message || e), rawText: paddle.text };
  }
}

// ---- runner ----------------------------------------------------------------
async function timed(fn) {
  const t = Date.now();
  const value = await fn();
  return { ...value, ms: Date.now() - t };
}

function fmt(r) {
  if (r.skipped) return `SKIPPED — ${r.skipped}`;
  if (r.error) return `ERROR — ${r.error}`;
  const f = r.fields || {};
  return `merchant=${JSON.stringify(f.merchant)}  amount=${JSON.stringify(f.amount)}  date=${JSON.stringify(f.date)}  (${r.ms}ms)`;
}

async function main() {
  loadEnvLocal();
  const imagePath = process.argv[2] || path.join(ROOT, "public/uploads/d0f843c9-5704-4b6b-8265-c3d7ca1ef334.webp");
  if (!existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }
  const buf = readFileSync(imagePath);
  const b64 = buf.toString("base64");
  const mime = mimeFor(imagePath);

  // The local backends (Ollama's Go image decoder; Paddle's cv2) don't read
  // WebP/HEIC. Normalize to PNG via macOS `sips` for a fair comparison.
  // Gemini gets the original bytes (it handles WebP natively).
  let localPath = imagePath;
  if (![".png", ".jpg", ".jpeg"].includes(path.extname(imagePath).toLowerCase())) {
    const out = path.join(os.tmpdir(), "ocrcompare_" + path.basename(imagePath, path.extname(imagePath)) + ".png");
    const r = spawnSync("sips", ["-s", "format", "png", imagePath, "--out", out]);
    if (r.status === 0 && existsSync(out)) {
      localPath = out;
      console.log(`(local backends use PNG copy: ${path.relative(ROOT, out) || out})`);
    } else {
      console.log(`(warning: could not convert ${path.extname(imagePath)} to PNG — local backends may fail)`);
    }
  }
  const localB64 = readFileSync(localPath).toString("base64");

  const vlmModel = process.env.OLLAMA_VLM_MODEL || "qwen2.5vl:3b";
  const moondream = process.env.OLLAMA_MOONDREAM_MODEL || "moondream";
  const textModel = process.env.OLLAMA_TEXT_MODEL || "qwen2.5:1.5b";

  console.log(`\nImage: ${path.relative(ROOT, imagePath)} (${(buf.length / 1024).toFixed(0)} KB, ${mime})\n`);

  const installed = await ollamaUp();

  const results = {
    "1. Gemini API": await timed(() => runGemini(b64, mime)),
    [`2a. Ollama VLM (${vlmModel})`]: await timed(() => runOllamaVlm(localB64, installed, vlmModel)),
    [`2b. Ollama VLM (${moondream})`]: await timed(() => runOllamaVlm(localB64, installed, moondream)),
    [`3. PaddleOCR -> ${textModel}`]: await timed(() => runPaddlePipeline(localPath, installed, textModel)),
  };

  const width = Math.max(...Object.keys(results).map((k) => k.length));
  console.log("=".repeat(width + 4 + 60));
  for (const [name, r] of Object.entries(results)) {
    console.log(`${name.padEnd(width)}  ${fmt(r)}`);
  }
  console.log("=".repeat(width + 4 + 60));
  console.log(`\nGround truth for the sample receipt: merchant="RESTAURANT"  amount="131.78"  date=null\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
