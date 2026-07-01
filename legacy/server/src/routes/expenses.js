import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "../db.js";
import { authRequired } from "../auth.js";
import { isMember } from "./trips.js";
import { round2 } from "../lib/balances.js";
import { scanReceipt, mediaTypeFor, ocrEnabled } from "../ocr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
});

const router = Router();
router.use(authRequired);

// Tells the UI whether AI scanning is configured.
router.get("/ocr-status", (req, res) => {
  res.json({ enabled: ocrEnabled() });
});

// Upload a receipt photo and try to read it. Returns the stored path + parsed fields.
// (Does NOT create the expense — the user confirms first.)
router.post("/scan-receipt", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const filePath = path.join(uploadDir, req.file.filename);
  const base64 = fs.readFileSync(filePath).toString("base64");
  const mediaType = mediaTypeFor(path.extname(req.file.filename));

  const result = await scanReceipt(base64, mediaType);
  res.json({
    receipt_path: `/uploads/${req.file.filename}`,
    scan: result,
  });
});

// Validate + normalize expense input against a trip. Returns {error} or {data}.
function normalizeExpense(tripId, body) {
  const { description, amount, category, paid_by, receipt_path, splits } = body || {};

  const total = round2(Number(amount));
  if (!description || !String(description).trim()) return { error: "Add a description" };
  if (!total || total <= 0) return { error: "Amount must be greater than 0" };

  const payer = Number(paid_by);
  if (!isMember(tripId, payer)) return { error: "Payer must be a trip member" };
  if (!Array.isArray(splits) || splits.length === 0) {
    return { error: "Choose who shares this expense" };
  }

  const clean = splits
    .map((s) => ({ user_id: Number(s.user_id), amount: round2(Number(s.amount)) }))
    .filter((s) => s.amount > 0);

  for (const s of clean) {
    if (!isMember(tripId, s.user_id)) {
      return { error: "Everyone in the split must be a trip member" };
    }
  }

  const splitSum = round2(clean.reduce((a, s) => a + s.amount, 0));
  if (Math.abs(splitSum - total) > 0.02) {
    return { error: `Splits add up to ${splitSum}, but the total is ${total}` };
  }
  // Absorb any rounding penny into the first share.
  if (clean.length && splitSum !== total) {
    clean[0].amount = round2(clean[0].amount + (total - splitSum));
  }

  return {
    data: {
      total,
      payer,
      description: String(description).trim(),
      category: category || "🧾",
      receipt_path: receipt_path || null,
      clean,
    },
  };
}

// Create an expense.
// Body: { description, amount, category, paid_by, receipt_path?, splits:[{user_id, amount}] }
router.post("/trips/:id/expenses", (req, res) => {
  const tripId = Number(req.params.id);
  if (!isMember(tripId, req.user.id)) {
    return res.status(403).json({ error: "You're not part of this trip" });
  }

  const { error, data } = normalizeExpense(tripId, req.body);
  if (error) return res.status(400).json({ error });

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expenses (trip_id, paid_by, description, amount, category, receipt_path)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(tripId, data.payer, data.description, data.total, data.category, data.receipt_path);
    const insSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)"
    );
    for (const s of data.clean) insSplit.run(info.lastInsertRowid, s.user_id, s.amount);
    return info.lastInsertRowid;
  });

  res.json({ id: tx() });
});

// Update an expense (payer or the trip creator).
router.put("/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  const exp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  if (!exp) return res.status(404).json({ error: "Expense not found" });

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(exp.trip_id);
  if (exp.paid_by !== req.user.id && trip.created_by !== req.user.id) {
    return res.status(403).json({ error: "Only the payer or trip creator can edit this" });
  }

  const { error, data } = normalizeExpense(exp.trip_id, req.body);
  if (error) return res.status(400).json({ error });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE expenses SET paid_by = ?, description = ?, amount = ?, category = ?, receipt_path = ?
         WHERE id = ?`
    ).run(data.payer, data.description, data.total, data.category, data.receipt_path, id);
    db.prepare("DELETE FROM expense_splits WHERE expense_id = ?").run(id);
    const insSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)"
    );
    for (const s of data.clean) insSplit.run(id, s.user_id, s.amount);
  });
  tx();

  res.json({ status: "updated" });
});

// Delete an expense (payer or the trip creator).
router.delete("/expenses/:id", (req, res) => {
  const id = Number(req.params.id);
  const exp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  if (!exp) return res.status(404).json({ error: "Expense not found" });

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(exp.trip_id);
  if (exp.paid_by !== req.user.id && trip.created_by !== req.user.id) {
    return res.status(403).json({ error: "Only the payer or trip creator can delete this" });
  }
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  res.json({ status: "deleted" });
});

export default router;
