import { copyFileSync, mkdirSync } from "node:fs";

/**
 * Serves the ZXing QR reader's WebAssembly from our own domain instead of the
 * package's default jsDelivr URL. Runs before `dev` and `build`.
 */
mkdirSync("public/vendor", { recursive: true });
copyFileSync(
  "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
  "public/vendor/zxing_reader.wasm",
);
