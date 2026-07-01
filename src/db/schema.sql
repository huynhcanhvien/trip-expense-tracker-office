-- Schema — plan §2, spec R7. Idempotent (CREATE ... IF NOT EXISTS) so migrate.ts is re-runnable.
PRAGMA foreign_keys = ON;

-- Accounts (spec R8). email_verified_at NULL until the user verifies (T6).
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  email_verified_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trips (spec R6). Currency fixed to the supported list; status one-way open -> closed (R9).
CREATE TABLE IF NOT EXISTS trips (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  date_start      TEXT,
  date_end        TEXT,
  currency        TEXT NOT NULL CHECK (currency IN ('USD','EUR','CNY','VND','JPY','KRW')),
  creator_user_id INTEGER NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per person-in-trip, registered OR ghost (plan §2, spec R1).
CREATE TABLE IF NOT EXISTS trip_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id),
  ghost_name TEXT,
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  -- exactly one of user_id / ghost_name is non-null
  CHECK ((user_id IS NULL) <> (ghost_name IS NULL))
);

-- Expenses (spec R2). amount is a decimal string (plan §3.2); expense_date is 'YYYY-MM-DD'.
CREATE TABLE IF NOT EXISTS expenses (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id            INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  payer_member_id    INTEGER NOT NULL REFERENCES trip_members(id),
  amount             TEXT NOT NULL,
  description        TEXT NOT NULL,
  expense_date       TEXT NOT NULL,
  photo_path         TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The "included" set for an expense (spec R2). Equal split is derived, not stored.
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES trip_members(id),
  PRIMARY KEY (expense_id, member_id)
);

-- One reusable invitation token per trip, no expiry (spec R1).
CREATE TABLE IF NOT EXISTS invitation_tokens (
  trip_id    INTEGER NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single-use email verification tokens (spec R8, plan §3.3).
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at    TEXT
);

-- Single-use password reset tokens (spec R10, plan §3.3).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at    TEXT
);

-- Indexes (plan §5: keep balance queries cheap, avoid N+1).
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id);
-- A registered user joins a trip at most once; ghosts (NULL user_id) are exempt (NULLs distinct in SQLite).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_trip_members_trip_user ON trip_members(trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_member ON expense_shares(member_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_tokens(user_id);
