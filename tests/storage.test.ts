import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the local adapter at a throwaway dir before importing it.
const dir = mkdtempSync(path.join(tmpdir(), "uploads-test-"));
process.env.UPLOADS_DIR = dir;

const { storage, StorageError } = await import("../src/lib/storage");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const PNG = Buffer.from("fake-png-bytes");

describe("local storage adapter", () => {
  it("round-trips save → load → delete", async () => {
    const { path: stored } = await storage.save({ buffer: PNG, mimeType: "image/png" });
    expect(stored).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    const loaded = await storage.load(stored);
    expect(loaded.equals(PNG)).toBe(true);

    await storage.delete(stored);
    await expect(storage.load(stored)).rejects.toThrow(); // gone
  });

  it("delete is a no-op for a missing file", async () => {
    await expect(storage.delete("/uploads/does-not-exist.png")).resolves.toBeUndefined();
  });

  it("rejects non-image uploads", async () => {
    await expect(
      storage.save({ buffer: Buffer.from("hi"), mimeType: "text/plain" }),
    ).rejects.toThrow(StorageError);
  });

  it("rejects an empty file", async () => {
    await expect(
      storage.save({ buffer: Buffer.alloc(0), mimeType: "image/png" }),
    ).rejects.toThrowError(/empty/i);
  });

  it("rejects files larger than 5 MB", async () => {
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(
      storage.save({ buffer: tooBig, mimeType: "image/jpeg" }),
    ).rejects.toThrowError(/5 MB/i);
  });

  it("derives the extension from the mime type", async () => {
    const { path: stored } = await storage.save({ buffer: PNG, mimeType: "image/jpeg" });
    expect(stored.endsWith(".jpg")).toBe(true);
    await storage.delete(stored);
  });
});
