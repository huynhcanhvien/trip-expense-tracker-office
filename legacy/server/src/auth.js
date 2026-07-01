import jwt from "jsonwebtoken";
import db from "./db.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// ⚠️ DEMO MODE: login is currently bypassed so the core features can be tested
//    without signing in. Flip DEMO_MODE to false to re-enable real auth.
const DEMO_MODE = true;

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, {
    expiresIn: "30d",
  });
}

// The stand-in "logged in" user used while DEMO_MODE is on.
export function getDemoUser() {
  let u = db.prepare("SELECT * FROM users WHERE email = ?").get("you@petal.local");
  if (!u) {
    const info = db
      .prepare(
        "INSERT INTO users (email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?)"
      )
      .run("you@petal.local", "You", "", "#f779ab");
    u = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  }
  return u;
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
      return next();
    } catch {
      if (!DEMO_MODE) return res.status(401).json({ error: "Invalid or expired session" });
    }
  }

  if (DEMO_MODE) {
    req.user = getDemoUser();
    return next();
  }
  return res.status(401).json({ error: "Not logged in" });
}
