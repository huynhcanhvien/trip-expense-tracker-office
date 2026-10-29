import QRCode from "qrcode";
import sharp from "sharp";

const FINDER = 7;
const QUIET = 4;

/**
 * A phone screenshot of a bank-app VietQR drawn with round dots and round
 * finder patterns (like VietinBank's), which full-size scans cannot read.
 */
export async function stylizedQrScreenshot(payload: string): Promise<Buffer> {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const inFinder = (r: number, c: number) =>
    (r < FINDER && c < FINDER) ||
    (r < FINDER && c >= n - FINDER) ||
    (r >= n - FINDER && c < FINDER);
  const shapes: string[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (modules.get(r, c) && !inFinder(r, c))
        shapes.push(
          `<circle cx="${c + QUIET + 0.5}" cy="${r + QUIET + 0.5}" r="0.34"/>`,
        );
  for (const [r, c] of [
    [0, 0],
    [0, n - FINDER],
    [n - FINDER, 0],
  ]) {
    const cx = c + QUIET + FINDER / 2;
    const cy = r + QUIET + FINDER / 2;
    shapes.push(
      `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="#000" stroke-width="1"/>`,
      `<circle cx="${cx}" cy="${cy}" r="1.5"/>`,
    );
  }
  const side = n + QUIET * 2;
  const qr = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="560" height="560"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${shapes.join("")}</g></svg>`,
    ),
  )
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: 1166,
      height: 2048,
      channels: 3,
      background: "#d6e8f7",
    },
  })
    .composite([{ input: qr, left: 303, top: 640 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** A faded screenshot: dark modules barely darker than the background. */
export async function lowContrastQr(payload: string): Promise<Buffer> {
  return sharp(await QRCode.toBuffer(payload, { width: 600, margin: 4 }))
    .linear(0.12, 200)
    .jpeg()
    .toBuffer();
}

/** One image holding several codes side by side, e.g. a wallet QR and a bank QR. */
export async function qrSheet(payloads: string[]): Promise<Buffer> {
  const codes = await Promise.all(
    payloads.map((payload) => QRCode.toBuffer(payload, { width: 600 })),
  );
  return sharp({
    create: {
      width: 640 * codes.length,
      height: 700,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(codes.map((input, i) => ({ input, left: i * 640, top: 50 })))
    .jpeg()
    .toBuffer();
}
