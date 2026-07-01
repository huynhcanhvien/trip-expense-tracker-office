import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { signToken, authRequired } from "../auth.js";

const router = Router();

const PASTELS = [
  "#f7a8c4", "#f9c5d1", "#ffb5a7", "#fcd5ce",
  "#c8b6ff", "#bde0fe", "#a0e7c4", "#ffd6a5",
];

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, avatar_color: u.avatar_color };
}

// When someone signs up, auto-join any trips they were invited to by email.
function resolveInvites(user) {
  const invites = db
    .prepare("SELECT * FROM trip_invites WHERE lower(email) = lower(?)")
    .all(user.email);
  const join = db.prepare(
    "INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)"
  );
  const drop = db.prepare("DELETE FROM trip_invites WHERE id = ?");
  for (const inv of invites) {
    join.run(inv.trip_id, user.id);
    drop.run(inv.id);
  }
}

router.post("/signup", (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
    .get(email);
  if (existing) return res.status(409).json({ error: "That email is already registered" });

  const hash = bcrypt.hashSync(String(password), 10);
  const color = PASTELS[Math.floor(Math.random() * PASTELS.length)];
  const info = db
    .prepare(
      "INSERT INTO users (email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?)"
    )
    .run(String(email).trim(), String(name).trim(), hash, color);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  resolveInvites(user);

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(email || "");
  if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash)) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", authRequired, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

export default router;
