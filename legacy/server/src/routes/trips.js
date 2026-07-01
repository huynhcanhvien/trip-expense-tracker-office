import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth.js";
import { tripBalances, round2 } from "../lib/balances.js";

const router = Router();
router.use(authRequired);

export function isMember(tripId, userId) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?")
      .get(tripId, userId)
  );
}

// Create a trip (creator auto-joins as a member).
router.post("/", (req, res) => {
  const { name, emoji, currency } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Trip needs a name" });
  }
  const info = db
    .prepare("INSERT INTO trips (name, emoji, currency, created_by) VALUES (?, ?, ?, ?)")
    .run(String(name).trim(), emoji || "🌸", currency || "USD", req.user.id);
  db.prepare("INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)").run(
    info.lastInsertRowid,
    req.user.id
  );
  res.json({ id: info.lastInsertRowid });
});

// List the trips I'm part of, with quick stats.
router.get("/", (req, res) => {
  const trips = db
    .prepare(
      `SELECT t.* FROM trips t
         JOIN trip_members tm ON tm.trip_id = t.id
        WHERE tm.user_id = ?
        ORDER BY t.created_at DESC`
    )
    .all(req.user.id);

  const result = trips.map((t) => {
    const total = db
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE trip_id = ?")
      .get(t.id).s;
    const memberCount = db
      .prepare("SELECT COUNT(*) AS c FROM trip_members WHERE trip_id = ?")
      .get(t.id).c;
    const { balances } = tripBalances(t.id);
    const mine = balances.find((b) => b.id === req.user.id);
    return {
      ...t,
      total: round2(total),
      memberCount,
      yourBalance: mine ? mine.balance : 0,
    };
  });
  res.json({ trips: result });
});

// Full detail for one trip.
router.get("/:id", (req, res) => {
  const tripId = Number(req.params.id);
  if (!isMember(tripId, req.user.id)) {
    return res.status(403).json({ error: "You're not part of this trip" });
  }
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const invites = db
    .prepare("SELECT email FROM trip_invites WHERE trip_id = ?")
    .all(tripId)
    .map((r) => r.email);

  const expenses = db
    .prepare(
      `SELECT e.*, u.name AS paid_by_name, u.avatar_color AS paid_by_color
         FROM expenses e JOIN users u ON u.id = e.paid_by
        WHERE e.trip_id = ?
        ORDER BY e.created_at DESC, e.id DESC`
    )
    .all(tripId)
    .map((e) => ({
      ...e,
      splits: db
        .prepare(
          `SELECT es.user_id, es.amount, u.name, u.avatar_color
             FROM expense_splits es JOIN users u ON u.id = es.user_id
            WHERE es.expense_id = ?`
        )
        .all(e.id),
    }));

  const { members, balances, settlements } = tripBalances(tripId);
  const total = round2(expenses.reduce((s, e) => s + e.amount, 0));

  res.json({ trip, members, invites, expenses, balances, settlements, total });
});

const PASTELS = [
  "#f7a8c4", "#f9c5d1", "#ffb5a7", "#fcd5ce",
  "#c8b6ff", "#bde0fe", "#a0e7c4", "#ffd6a5",
];

// DEMO MODE: add a traveler by name. Creates a lightweight person (no account)
// and puts them on the trip so expenses can be split between people.
router.post("/:id/members", (req, res) => {
  const tripId = Number(req.params.id);
  if (!isMember(tripId, req.user.id)) {
    return res.status(403).json({ error: "You're not part of this trip" });
  }
  const name = String((req.body || {}).name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });

  const color = PASTELS[Math.floor(Math.random() * PASTELS.length)];
  const email = `local-${Date.now()}-${Math.round(Math.random() * 1e6)}@petal.local`;
  const info = db
    .prepare(
      "INSERT INTO users (email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?)"
    )
    .run(email, name, "", color);
  db.prepare("INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)").run(
    tripId,
    info.lastInsertRowid
  );
  res.json({ status: "added", name });
});

// Delete a trip (creator only).
router.delete("/:id", (req, res) => {
  const tripId = Number(req.params.id);
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.created_by !== req.user.id) {
    return res.status(403).json({ error: "Only the trip creator can delete it" });
  }
  db.prepare("DELETE FROM trips WHERE id = ?").run(tripId);
  res.json({ status: "deleted" });
});

export default router;
