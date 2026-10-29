import { parseVietQr, type VietQrAccount } from "./vietqr";

/**
 * Longest side to scan at. Screenshots are often large with a small QR, so a
 * few sizes are more reliable than one. Small sizes merge the round dots and
 * ring finders some banking apps (e.g. VietinBank) draw into square modules.
 */
const SCAN_SIZES = [1200, 800, 600, 400, 300, 2400];

/** Browser-only: reads a VietQR from an image without sending it anywhere. */
export async function decodeVietQrImage(
  image: Blob,
): Promise<VietQrAccount | null> {
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
      if (!context) return null;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const code = jsQR(pixels.data, width, height, {
        inversionAttempts: "attemptBoth",
      });
      if (code?.data) return parseVietQr(code.data);
    }
    return null;
  } finally {
    bitmap.close();
  }
}
