import { parseVietQr, type VietQrAccount } from "./vietqr";

export type BankQrRead =
  | { status: "found"; account: VietQrAccount }
  /** Codes were read, but none is a bank VietQR (e.g. a wallet or a link). */
  | { status: "notVietQr" }
  | { status: "notFound" };

/** An image can hold several codes (say a wallet QR next to the bank QR). */
export function pickVietQr(texts: string[]): BankQrRead {
  const codes = texts.filter((text) => text.trim());
  for (const text of codes) {
    const account = parseVietQr(text);
    if (account) return { status: "found", account };
  }
  return { status: codes.length ? "notVietQr" : "notFound" };
}

/** Served from our domain by scripts/copy-zxing-wasm.mjs. */
const ZXING_WASM_URL = "/vendor/zxing_reader.wasm";
let zxingPrepared = false;

/**
 * ZXing-C++ handles low contrast, rotation, inversion, noise and several codes
 * per image, which jsQR misses.
 */
async function readWithZxing(image: Blob): Promise<string[]> {
  const { prepareZXingModule, readBarcodes } =
    await import("zxing-wasm/reader");
  if (!zxingPrepared) {
    prepareZXingModule({
      overrides: {
        locateFile: (path, prefix) =>
          path.endsWith(".wasm") ? ZXING_WASM_URL : prefix + path,
      },
    });
    zxingPrepared = true;
  }
  const results = await readBarcodes(image, {
    formats: ["QRCode"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    tryDenoise: true,
    maxNumberOfSymbols: 4,
  });
  return results.filter((r) => r.isValid).map((r) => r.text);
}

/**
 * Longest side to scan at with jsQR. Small sizes merge the round dots and ring
 * finders some banking apps (e.g. VietinBank) draw into square modules.
 */
const SCAN_SIZES = [1200, 800, 600, 400, 300, 2400];

/** Fallback when the WebAssembly reader cannot load; finds one code at most. */
async function readWithJsQr(image: Blob): Promise<string[]> {
  const { default: jsQR } = await import("jsqr");
  const bitmap = await createImageBitmap(image);
  try {
    let scannedFullSize = false;
    for (const size of SCAN_SIZES) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      // Every size at or above the image's own size scans the same pixels.
      if (scale === 1 && scannedFullSize) continue;
      scannedFullSize ||= scale === 1;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [];
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const code = jsQR(pixels.data, width, height, {
        inversionAttempts: "attemptBoth",
      });
      if (code?.data) return [code.data];
    }
    return [];
  } finally {
    bitmap.close();
  }
}

/** Browser-only: reads a bank VietQR from an image without sending it anywhere. */
export async function readBankQrImage(image: Blob): Promise<BankQrRead> {
  const primary = pickVietQr(await readWithZxing(image).catch(() => []));
  if (primary.status === "found") return primary;
  const fallback = pickVietQr(await readWithJsQr(image).catch(() => []));
  if (fallback.status === "found") return fallback;
  return primary.status === "notVietQr" ? primary : fallback;
}
