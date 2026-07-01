// Receipt OCR — spec R4, scenario C. Uses Tesseract.js (open-source, offline,
// no external API) for text recognition, then receipt-parsing heuristics
// (total-first amount, first date, merchant line) inspired by
// github.com/danschultzer/receipt-scanner.
import Big from "big.js";
import type { Worker } from "tesseract.js";

export interface OcrResult {
  /** false when the image is too blurry/empty to read → prompt a re-upload (scenario C). */
  readable: boolean;
  amount: string | null; // decimal string
  description: string | null; // merchant / first meaningful line
  expenseDate: string | null; // 'YYYY-MM-DD'
  rawText: string;
}

const UNREADABLE: OcrResult = {
  readable: false,
  amount: null,
  description: null,
  expenseDate: null,
  rawText: "",
};

/** Run OCR over an image buffer and extract receipt fields. Never throws. */
export async function scanReceipt(image: Buffer): Promise<OcrResult> {
  let worker: Worker | undefined;
  try {
    const { createWorker } = await import("tesseract.js");
    // errorHandler prevents tesseract.js from rethrowing a rejected job globally
    // (an uncaught throw on nextTick) — a corrupt image would otherwise crash the
    // process instead of just rejecting recognize().
    worker = await createWorker("eng", undefined, { errorHandler: () => {} });
    const { data } = await worker.recognize(image);
    return parseReceiptText(data.text ?? "");
  } catch {
    return { ...UNREADABLE };
  } finally {
    if (worker) await worker.terminate();
  }
}

/** Pure receipt-text parser — the deterministic, unit-tested core. */
export function parseReceiptText(rawText: string): OcrResult {
  const text = rawText ?? "";
  const alnum = (text.match(/[a-z0-9]/gi) ?? []).length;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // "Too blurry to read" heuristic: almost no alphanumeric content.
  if (alnum < 8 || lines.length === 0) return { ...UNREADABLE, rawText: text };

  return {
    readable: true,
    amount: extractAmount(lines),
    description: extractDescription(lines),
    expenseDate: extractDate(text),
    rawText: text,
  };
}

function toBig(token: string): Big | null {
  try {
    return new Big(token.replace(/,/g, ""));
  } catch {
    return null;
  }
}

function maxBig(tokens: string[]): Big | null {
  let best: Big | null = null;
  for (const t of tokens) {
    const b = toBig(t);
    if (b && (best === null || b.gt(best))) best = b;
  }
  return best;
}

const TOTAL_RE = /(grand\s*total|total|amount\s*due|balance\s*due)/i;
const SUBTOTAL_RE = /sub\s*-?\s*total/i;

function extractAmount(lines: string[]): string | null {
  // Prefer amounts on a "total" line (but never "subtotal").
  const totalLines = lines.filter((l) => TOTAL_RE.test(l) && !SUBTOTAL_RE.test(l));
  const totalTokenRe = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+/g;
  let best: Big | null = null;
  for (const l of totalLines) {
    const b = maxBig(l.match(totalTokenRe) ?? []);
    if (b && (best === null || b.gt(best))) best = b;
  }
  if (best) return best.toString();

  // Fallback: the largest decimal amount anywhere (avoids picking phone numbers etc.).
  const decimals: string[] = [];
  for (const l of lines) {
    for (const m of l.matchAll(/\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2}/g)) decimals.push(m[0]);
  }
  best = maxBig(decimals);
  return best ? best.toString() : null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}`;
}

function extractDate(text: string): string | null {
  const isoMatch = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  const slash = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (slash) {
    let mo = +slash[1];
    let d = +slash[2];
    const y = slash[3].length === 2 ? 2000 + +slash[3] : +slash[3];
    if (mo > 12 && d <= 12) [mo, d] = [d, mo]; // looks like DD/MM
    return iso(y, mo, d);
  }
  return null;
}

function extractDescription(lines: string[]): string | null {
  for (const l of lines) {
    const letters = (l.match(/[a-z]/gi) ?? []).length;
    if (letters >= 3 && !/^\d/.test(l)) return l.slice(0, 120);
  }
  return lines[0]?.slice(0, 120) ?? null;
}
