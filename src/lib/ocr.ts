// Receipt OCR — spec R4, scenario C. Uses a local vision LLM (qwen2.5vl:3b via
// Ollama) to read a receipt photo and extract the fields in one shot. The model
// runs on your own machine — no external API, images never leave the host.
//
// Set OLLAMA_URL / OCR_MODEL to point at a different server or model.
import Big from "big.js";
import sharp from "sharp";

export interface OcrResult {
  /** false when the image isn't a legible receipt → prompt a re-upload (scenario C). */
  readable: boolean;
  amount: string | null; // decimal string, e.g. "131.78"
  description: string | null; // merchant / business name
  expenseDate: string | null; // 'YYYY-MM-DD'
}

/** Thrown for infrastructure failures (Ollama down, model missing, bad image) —
 *  distinct from an image the model simply can't read (that returns readable:false). */
export class OcrError extends Error {}

const UNREADABLE: OcrResult = { readable: false, amount: null, description: null, expenseDate: null };

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OCR_MODEL = process.env.OCR_MODEL || "qwen2.5vl:3b";

const PROMPT = `You are extracting fields from a photo of a purchase receipt.
Return ONLY these fields:
- readable: true if this is a legible receipt, false if it's blurry, blank, or not a receipt.
- merchant: the store/restaurant/business name (the receipt's header), or null if none is visible.
- amount: the FINAL total the customer paid — the grand total INCLUDING tax, fees, and tip. This is NOT the subtotal. Return a plain decimal string like "131.78" (no currency symbol, no thousands separators), or null if you can't read it.
- date: the purchase date as "YYYY-MM-DD", or null if no date is printed.`;

// Ollama structured-output schema — forces valid JSON back.
const SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    merchant: { type: ["string", "null"] },
    amount: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
  },
  required: ["readable", "merchant", "amount", "date"],
};

/** Normalize a photo to PNG (Ollama can't decode WebP/HEIC) and auto-orient it.
 *  Downscale huge phone photos for speed — receipts stay legible at 2000px. */
async function toPng(image: Buffer): Promise<Buffer> {
  try {
    return await sharp(image)
      .rotate() // honor EXIF orientation from phone cameras
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new OcrError("That image format isn't supported — please upload a JPEG or PNG.");
  }
}

/** Run the receipt image through the vision model and extract its fields. */
export async function scanReceipt(image: Buffer): Promise<OcrResult> {
  const png = await toPng(image);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OCR_MODEL,
        prompt: PROMPT,
        images: [png.toString("base64")],
        stream: false,
        format: SCHEMA,
        options: { temperature: 0 },
      }),
    });
  } catch {
    throw new OcrError("Receipt scanning is temporarily unavailable. Please try again.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new OcrError(`Receipt scanning model '${OCR_MODEL}' isn't available.`);
    }
    throw new OcrError(`Receipt scanning failed (${res.status}). ${detail.slice(0, 120)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { response?: string };
  const parsed = parseModelJson(data.response ?? "");
  if (!parsed) throw new OcrError("Couldn't understand the scan result. Please try again.");
  return normalizeReceiptFields(parsed);
}

/** Pull the JSON object out of the model's text response. */
function parseModelJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/** Coerce the model's raw fields into a validated OcrResult. Pure + unit-tested:
 *  guards against hallucinated amounts/dates and enforces our string shapes. */
export function normalizeReceiptFields(raw: Record<string, unknown>): OcrResult {
  if (raw.readable === false) return { ...UNREADABLE };

  const amount = normalizeAmount(raw.amount);
  // No usable total → nothing to build an expense from; treat as unreadable.
  if (!amount) return { ...UNREADABLE };

  return {
    readable: true,
    amount,
    description: normalizeMerchant(raw.merchant),
    expenseDate: normalizeDate(raw.date),
  };
}

/** Accept a string/number, strip currency symbols and separators, require a
 *  positive finite decimal. Returns the canonical decimal string or null. */
function normalizeAmount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  try {
    const b = new Big(cleaned);
    return b.gt(0) ? b.toString() : null;
  } catch {
    return null;
  }
}

function normalizeMerchant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, 120) : null;
}

/** Require a real 'YYYY-MM-DD' date; reject anything else the model might emit. */
function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = +mo, day = +d;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}
