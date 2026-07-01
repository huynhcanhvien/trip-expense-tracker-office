import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isMember } from "@/lib/trips";
import { storage, StorageError } from "@/lib/storage";
import { scanReceipt } from "@/lib/ocr";

// Upload a receipt photo, store it, and OCR it (spec R4, scenario C).
// Returns extracted fields for the review form; on an unreadable image, prompts
// a re-upload and discards the stored file. Does NOT create the expense — the
// user confirms on the review form (which saves via the normal add-expense flow).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const tripId = Number(form.get("tripId"));
  const file = form.get("receipt");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }
  if (!(await isMember(tripId, Number(session.user.id)))) {
    return NextResponse.json({ error: "You're not a member of this trip" }, { status: 403 });
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

  const ocr = await scanReceipt(buffer);
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
