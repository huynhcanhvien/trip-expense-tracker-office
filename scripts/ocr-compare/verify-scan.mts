// Exercises the real production scanReceipt() end-to-end (sharp -> Ollama -> normalize).
//   npx tsx scripts/ocr-compare/verify-scan.mts [imagePath]
import { readFileSync } from "node:fs";
import { scanReceipt } from "../../src/lib/ocr.ts";

const img = process.argv[2] || "public/uploads/d0f843c9-5704-4b6b-8265-c3d7ca1ef334.webp";
const buf = readFileSync(img);
console.log(`scanReceipt("${img}", ${(buf.length / 1024).toFixed(0)} KB)...`);
const t = Date.now();
const r = await scanReceipt(buf);
console.log(`-> ${JSON.stringify(r)}  (${Date.now() - t}ms)`);
