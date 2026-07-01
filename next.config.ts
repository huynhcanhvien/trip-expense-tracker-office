import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep tesseract.js (WASM worker) out of the server bundle so it loads at runtime.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
