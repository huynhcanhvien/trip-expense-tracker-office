import { parseVietQr, type VietQrAccount } from "./vietqr";

/** Screenshots are often large with a small QR; scanning a few sizes is more reliable than one. */
const SCAN_SIZES = [1200, 800, 2400];

/** Browser-only: reads a VietQR from an image without sending it anywhere. */
export async function decodeVietQrImage(
  image: Blob,
): Promise<VietQrAccount | null> {
  const { default: jsQR } = await import("jsqr");
  const bitmap = await createImageBitmap(image);
  try {
    for (const size of SCAN_SIZES) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const code = jsQR(pixels.data, width, height, {
        inversionAttempts: "attemptBoth",
      });
      if (code?.data) return parseVietQr(code.data);
      if (scale === 1) break;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
