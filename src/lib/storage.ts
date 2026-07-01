// Photo storage adapter — plan §1, spec R4/R7.
// Local FS impl for dev (T16); R2 impl added behind the same interface in T19.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

export class StorageError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (spec R4 / plan §3.4)

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export interface UploadFile {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}

export interface StoredFile {
  /** Public path stored on the expense, e.g. "/uploads/<uuid>.jpg". */
  path: string;
}

export interface StorageAdapter {
  save(file: UploadFile): Promise<StoredFile>;
  load(storedPath: string): Promise<Buffer>;
  delete(storedPath: string): Promise<void>;
}

/** Local filesystem base dir (overridable via UPLOADS_DIR for tests). */
function baseDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
}

function fsPathFor(storedPath: string): string {
  // Map a stored public path back to disk by its filename only.
  return path.join(baseDir(), path.basename(storedPath));
}

function extFor(file: UploadFile): string {
  const byMime = EXT_BY_MIME[file.mimeType.toLowerCase()];
  if (byMime) return byMime;
  const byName = file.originalName ? path.extname(file.originalName).slice(1).toLowerCase() : "";
  return byName || "img";
}

function localAdapter(): StorageAdapter {
  return {
    async save(file) {
      if (!file.mimeType?.toLowerCase().startsWith("image/")) {
        throw new StorageError("Only image uploads are allowed");
      }
      if (file.buffer.length === 0) throw new StorageError("The file is empty");
      if (file.buffer.length > MAX_BYTES) {
        throw new StorageError("Image must be 5 MB or smaller");
      }

      const name = `${randomUUID()}.${extFor(file)}`;
      const dir = baseDir();
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), file.buffer);
      return { path: `/uploads/${name}` };
    },

    async load(storedPath) {
      return readFile(fsPathFor(storedPath));
    },

    async delete(storedPath) {
      try {
        await unlink(fsPathFor(storedPath));
      } catch (err: unknown) {
        // Ignore "already gone"; rethrow anything else.
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
      }
    },
  };
}

function createStorage(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER || "local";
  switch (adapter) {
    case "local":
      return localAdapter();
    case "r2":
      // Implemented in T19.
      throw new StorageError("STORAGE_ADAPTER=r2 is not configured yet (T19)");
    default:
      throw new StorageError(`Unknown STORAGE_ADAPTER: ${adapter}`);
  }
}

export const storage: StorageAdapter = createStorage();
