// Receipt OCR using Claude's vision API.
// If ANTHROPIC_API_KEY isn't set, we return a "manual" result so the UI
// still lets the user attach the photo and type the amount themselves.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const MEDIA_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function mediaTypeFor(ext) {
  return MEDIA_TYPES[ext.toLowerCase()] || "image/jpeg";
}

export function ocrEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function scanReceipt(base64, mediaType) {
  if (!ocrEnabled()) {
    return { ok: false, reason: "no_api_key" };
  }

  const body = {
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text:
              "This is a photo of a receipt. Extract the details and respond " +
              "with ONLY a JSON object (no markdown, no prose) shaped exactly like:\n" +
              '{"merchant": string, "total": number, "category_emoji": string, "summary": string}\n' +
              "- total is the final grand total as a plain number (no currency symbol).\n" +
              "- category_emoji is a single emoji best matching the purchase " +
              "(🍜 food, 🛒 groceries, 🏨 lodging, 🚕 transport, 🎟️ activity, 🛍️ shopping, 🧾 other).\n" +
              "- summary is a short human label like 'Dinner at Sakura Ramen'.\n" +
              "If you cannot read a total, use 0.",
          },
        ],
      },
    ],
  };

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("OCR API error:", resp.status, detail);
      return { ok: false, reason: "api_error" };
    }

    const data = await resp.json();
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, reason: "parse_error" };

    const parsed = JSON.parse(match[0]);
    return {
      ok: true,
      merchant: parsed.merchant || "",
      total: Number(parsed.total) || 0,
      category_emoji: parsed.category_emoji || "🧾",
      summary: parsed.summary || parsed.merchant || "",
    };
  } catch (err) {
    console.error("OCR failed:", err);
    return { ok: false, reason: "exception" };
  }
}
