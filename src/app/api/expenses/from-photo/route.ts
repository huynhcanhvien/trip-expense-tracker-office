import { NextResponse } from "next/server";
import { getTripByPublicId } from "@/lib/trips";
import { storage, StorageError } from "@/lib/storage";
import { scanReceipt, OcrError, type OcrResult } from "@/lib/ocr";

// Upload a receipt photo, store it, and OCR it (spec R4, scenario C).
// Returns extracted fields for the review form; on an unreadable image, prompts
// a re-upload and discards the stored file. Does NOT create the expense — the
// user confirms on the review form (which saves via the normal add-expense flow).
export async function POST(req: Request) {
  const form = await req.formData();
  const publicId = String(form.get("publicId") ?? "");
  const file = form.get("receipt");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }

  const trip = await getTripByPublicId(publicId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (trip.status === "closed") {
    return NextResponse.json({ error: "This trip is archived" }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await storage.save({ buffer, mimeType: file.type, originalName: file.name });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  let ocr: OcrResult;
  try {
    ocr = await scanReceipt(buffer);
  } catch (err) {
    await storage.delete(stored.path); // don't retain a file we couldn't process
    if (err instanceof OcrError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  if (!ocr.readable) {
    await storage.delete(stored.path); // don't retain unreadable uploads
    return NextResponse.json({ readable: false });
  }

  return NextResponse.json({
    readable: true,
    receiptPath: stored.path,
    amount: ocr.amount,
    description: ocr.description,
    expenseDate: ocr.expenseDate,
  });
}
