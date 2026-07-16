-- Schema — no-auth, spliit-style. A trip lives at a shareable secret URL
-- (trips.public_id); anyone with the link can view and edit it. No accounts.
-- Idempotent (CREATE ... IF NOT EXISTS) so migrate.ts is re-runnable.
PRAGMA foreign_keys = ON;

-- Trips. `public_id` is the non-guessable slug used in URLs (the shareable
-- secret). Currency fixed to the supported list; status one-way open -> closed.
CREATE TABLE IF NOT EXISTS trips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  currency    TEXT NOT NULL CHECK (currency IN ('USD','EUR','CNY','VND','JPY','KRW')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per participant in a trip. Just a name — there are no user accounts.
CREATE TABLE IF NOT EXISTS trip_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id   INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Expenses. amount is a decimal string (plan §3.2); expense_date is 'YYYY-MM-DD'.
CREATE TABLE IF NOT EXISTS expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  payer_member_id INTEGER NOT NULL REFERENCES trip_members(id),
  amount          TEXT NOT NULL,
  description     TEXT NOT NULL,
  expense_date    TEXT NOT NULL,
  photo_path      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The "included" set for an expense. For an even split, share_amount is NULL
-- and each member's share is derived (see currency.share_of). For a custom
-- split, share_amount holds that member's exact amount (a decimal string) and
-- the amounts across the expense sum to its total.
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id   INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES trip_members(id),
  share_amount TEXT,
  PRIMARY KEY (expense_id, member_id)
);

-- Indexes (keep balance queries cheap, avoid N+1).
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_member ON expense_shares(member_id);
