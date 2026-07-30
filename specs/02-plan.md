# 02 — Plan

## 1. Tech stack — as built

| Concern | Decision | Why (alternatives ruled out) |
| --- | --- | --- |
| Language + framework | **TypeScript + Next.js 16 (App Router, Turbopack) + React 19** | Single-language full-stack; UI, API routes, and server actions ship as one unit. *Ruled out:* Express+React (more glue), separate SPA + API (needless split). |
| Database | **libSQL via `@libsql/client`** — Turso in prod, **local SQLite file (`local.db`) fallback** for offline dev | Same SQL for local file and remote Turso; zero-config offline dev (unset `TURSO_DATABASE_URL` → `local.db`). The client is async, so every DB call uses `await`. *Ruled out:* `better-sqlite3` (sync only, no serverless story), Postgres/Supabase (heavier than needed / lock-in). |
| Access model | **No accounts.** A trip is reached by a secret slug (`trips.public_id`); the link is the credential | Removes all auth/email machinery for a casual, share-a-link tool. *Ruled out:* Auth.js + email verification + invite/accept (the account-based design this project started from — dropped as over-built for the use case). |
| OCR | **On-device vision model — `qwen2.5vl:3b` via Ollama** | Runs on the host; images never leave the machine; no API key or per-call cost; returns structured JSON in one call. *Ruled out:* Claude/Gemini vision (external API, cost, data leaves host — kept as a documented fallback for GPU-less prod), Tesseract/PaddleOCR (need separate field parsing; see the `scripts/ocr-compare/` harness). |
| Image handling | **`sharp`** | Auto-orient (EXIF), downscale huge phone photos, and normalize to PNG (the vision model can't decode WebP/HEIC) before OCR. |
| Photo storage | **Local filesystem** (`public/uploads/`) behind a `StorageAdapter` interface; an `r2`/`s3` branch is **stubbed, not implemented** | Zero-friction dev; the adapter seam means object storage can be added without touching callers. *Ruled out:* DB BLOBs (bloat, row-size limits). |
| Money math | **`big.js`** (decimal) | Amounts stored as TEXT decimal strings; arithmetic via `.plus()`/`.minus()`/`.div()`/`.times()`; comparisons via `.gt()`/`.lt()`/`.eq()`. Tiny, deterministic. *Ruled out:* floats (correctness bug-farm), integer minor units (less readable for a learning project). |
| Validation | **`zod`** | Parse/validate trip + expense input at the server-action boundary; user-facing errors surfaced as typed error classes (`TripError`, `ExpenseError`, `StorageError`, `OcrError`). |
| Test runner | **Vitest** (unit) + **Playwright** (e2e) | Vite-native and fast; Playwright drives the spec scenarios end-to-end. |
| Hosting | **A long-lived Node host** (container/VM, or AWS App Runner / ECS-Fargate) | Needs a Node runtime for `sharp` + local `fs` uploads, and OCR needs Ollama reachable at `OLLAMA_URL` (a GPU host, or swap to a hosted vision API). *Ruled out for now:* pure serverless / Vercel (no persistent disk for uploads, can't host Ollama) — would require the object-storage adapter and a hosted OCR provider first. |

### What this means for the build

- One repo, one language, one deploy unit. No frontend/backend split.
- One dev process (`next dev`). Optionally `ollama serve` alongside for the receipt scanner; everything else works without it.
- Database is a local file by default; point `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at a Turso instance for shared/prod use and run `npm run migrate` against it once.
- No email, no auth secrets, no invite tokens to manage. The only "secret" is each trip's `public_id` slug.

---

## 2. Data model (as built)

Concrete schema lives in `src/db/schema.sql`; `migrate.ts` applies it idempotently (`CREATE TABLE IF NOT EXISTS`).

```text
Trip
  id, public_id (unique secret slug used in URLs),
  name, currency (enum: USD/EUR/CNY/VND/JPY/KRW),
  status (enum: open/closed), closed_at?, created_at

TripMember                          # one row per participant — just a name
  id, trip_id (-> Trip), name, joined_at
  # names unique per trip (case-insensitive) — enforced in the app layer

Expense
  id, trip_id (-> Trip),
  payer_member_id (-> TripMember),
  amount (TEXT, decimal string, e.g. "12.34" — see §3.2),
  description (TEXT),
  expense_date (TEXT 'YYYY-MM-DD'),
  photo_path? (TEXT, NULL when no receipt / after close),
  created_at

ExpenseShare                        # which participants are in the split
  expense_id (-> Expense),
  member_id (-> TripMember),
  share_amount? (TEXT decimal string for a CUSTOM split; NULL for an EVEN split),
  PK (expense_id, member_id)
```

Notes:

- **No `User` table** and none of the account-era tables (`InvitationToken`, `EmailVerificationToken`, `PasswordResetToken`). Trips have **no date range** in v1.
- A **TripMember** is the sole identity for "person-in-trip". Expenses point at TripMembers — the math is uniform and account-free.
- The **split** lives in `ExpenseShare`: for an **even** split, every row's `share_amount` is `NULL` and each share is derived by `share_of` (§3.2); for a **custom** split, each row's `share_amount` is that person's exact amount and the amounts sum to the total. An expense's split mode is inferred on read (any non-null `share_amount` ⇒ custom).
- Photos live on disk at `photo_path` (`/uploads/<uuid>.<ext>`); no BLOBs in the DB.
- The secret slug (`public_id`) is a 16-byte CSPRNG value, URL-safe base64 (`tokens.generateToken`).

---

## 3. Key algorithms

### 3.1 Balance computation (R3) — `src/lib/balance.ts`

```text
for each member m in trip:
  paid     = sum(Big(e.amount)      for e in expenses if e.payer == m)
  consumed = sum(share_of_m(e)      for e in expenses if m in split(e))
  net[m]   = paid.minus(consumed)
```

- `share_of_m(e)` = the member's exact `share_amount` for a **custom** split, else an equal share from `share_of` (§3.2) for an **even** split.
- `net[m].gt(0)` → "should receive"; `net[m].lt(0)` → "should pay"; `eq(0)` → settled.
- The sum of all `net[m]` is always exactly `Big(0)` (each expense credits the payer `amount` and debits shares summing to `amount`). This is the success-criteria check.
- Computed on demand from raw expenses; **never cached** — no stale-state bugs when expenses are edited/deleted (R5). Feed it the result of one SELECT of all expenses + shares; never N+1 (see §5).

### 3.2 Currency, rounding & splitting — `src/lib/currency.ts`

Per R6, every trip has one currency from {USD, EUR, CNY (2dp), VND, JPY, KRW (0dp)}.

- **Library:** `big.js`. All money flows through `Big` at the app layer. Never use `+ - * / ==` on amounts.
- **Storage:** amounts are TEXT decimal strings; wrap with `new Big(row.amount)` on read, `big.toString()` on write.
- **Even split — `share_of(amount, includedMemberIds, dp)`** (the `share_of_m` used in §3.1):
  1. Sort `includedMemberIds` ascending.
  2. `dp` = decimal places for the currency (USD/EUR/CNY = 2, VND/JPY/KRW = 0).
  3. First N-1 members each get `amount.div(N).round(dp, Big.roundDown)`.
  4. The highest-id member absorbs the remainder: `amount.minus(sum of the others)`.
  5. Guarantee: shares sum to `amount` exactly, deterministically. E.g. `10.00 / 3` → `3.33, 3.33, 3.34`; `¥500 / 3` → `166, 166, 168`.
- **Custom split:** the app validates (`prepareExpense` in `src/lib/expenses.ts`) that the positive per-person amounts sum to the (rounded) total; a `$0` share means "not in this expense". Rejected with a clear message otherwise.
- **Display:** `formatAmount` uses `Intl.NumberFormat(locale, { style: "currency", currency })` (locale per currency in `CURRENCY_META`). `formatSignedBalance` prefixes `+` for positives (R3).

Property-based test (recommended): for any random even split with N ≥ 1, `sum(share_of(...)) === amount` exactly.

### 3.3 Shareable slug — `src/lib/tokens.ts`

- `generateToken(bytes = 16)` → CSPRNG, URL-safe base64 (`randomBytes(16).toString("base64url")`, ≈22 chars).
- Used once per trip as `trips.public_id`. **No single-use consumption, no expiry** — the slug lives for the trip's lifetime and is the access credential (R9). (The account-era single-use verification/reset tokens are gone.)

### 3.4 OCR review flow (R4 / Scenario C) — `src/lib/ocr.ts`, `src/app/api/expenses/from-photo/route.ts`

```text
1. Client uploads image to POST /api/expenses/from-photo (+ publicId).
2. Server resolves the trip; rejects if unknown (404) or closed (403).
3. Server stores the file via the storage adapter (validates image/*, ≤ 5 MB).
4. sharp normalizes it: auto-orient (EXIF), downscale to ≤ 2000px, encode PNG.
5. Server POSTs the PNG to Ollama (/api/generate) with a JSON schema, asking for
   { readable, merchant, amount, date }; temperature 0.
6. normalizeReceiptFields() coerces + guards the raw fields (positive decimal
   amount, real YYYY-MM-DD, trimmed merchant). No usable total ⇒ treat as unreadable.
7. If unreadable → delete the stored file, respond { readable: false }; UI prompts re-upload.
   Infra failure (Ollama down / model missing / bad image) → delete file, 502 with a clear message.
8. If readable → respond extracted fields + receiptPath; UI renders the review
   form pre-filled (payer left un-prefilled — NOT assumed to be the uploader).
9. User confirms/edits, picks payer + split, Saves via the normal add-expense action,
   which persists Expense + ExpenseShare rows linked to receiptPath.
```

---

## 4. File / module layout (actual)

```text
trip-expense-tracker/
├── specs/                          # this spec, plan, tasks
├── public/uploads/                 # local-dev photo storage (gitignored)
├── scripts/ocr-compare/            # harness: benchmark Gemini / Ollama VLMs / PaddleOCR
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── page.tsx                # home: hero + "Create a trip" + recent trips
│   │   ├── NewTripDialog.tsx / NewTripForm.tsx / RecentTrips.tsx
│   │   ├── components/             # Avatar, Modal, Select, SubmitButton, FormError, ...
│   │   ├── trips/
│   │   │   ├── actions.ts          # server actions: create trip, add participant, close, summaries
│   │   │   └── [publicId]/         # trip page + AddExpense*, AddFromPhoto, PeoplePanel,
│   │   │                           #   ShareButton, CloseTripButton, expense edit route + actions
│   │   └── api/expenses/from-photo/route.ts   # OCR upload endpoint (§3.4)
│   ├── lib/
│   │   ├── db.ts                   # @libsql/client (Turso URL or local.db fallback)
│   │   ├── trips.ts                # create/close/lookup trips, add participants
│   │   ├── expenses.ts             # create/update/delete/load expenses (even + custom splits)
│   │   ├── balance.ts              # §3.1
│   │   ├── currency.ts             # §3.2 — big.js wrappers, share_of, formatters
│   │   ├── tokens.ts               # §3.3 — slug generation
│   │   ├── ocr.ts                  # §3.4 — Ollama vision client + field normalization
│   │   ├── storage.ts              # photo storage adapter (local; r2/s3 stubbed)
│   │   ├── recent-trips.ts         # browser localStorage: recent trips + "you" (R11)
│   │   └── urls.ts                 # base URL for shareable links (APP_URL)
│   └── db/
│       ├── schema.sql              # tables from §2
│       └── migrate.ts             # one-shot: apply schema.sql (Turso or local.db)
└── tests/                          # Vitest units + Playwright e2e (scenarios A–H)
```

---

## 5. Risks & tradeoffs

- **Anyone with the link has full edit access (R9).** There is no per-user authz — the secret slug is the only gate. Acceptable for a casual trip tool; mitigations are the non-guessable 16-byte slug and 404 (not 403) on unknown slugs so existence doesn't leak. *Not* suitable for sensitive data.
- **Balance bugs from rounding.** Mitigated by `share_of` (§3.2, highest-id absorbs remainder) + the custom-split sum check in `prepareExpense`; property tests assert shares sum to the total and net balances sum to `Big(0)`.
- **OCR needs a reachable Ollama + model.** If down/missing, the endpoint returns a clear 502 and discards the upload; the rest of the app is unaffected. Prod without a GPU should point `OLLAMA_URL` at a dedicated instance or swap to a hosted vision API.
- **Every DB query is a network round-trip to Turso** (when remote). Keep `balance.ts` pure and fed by a single SELECT of all expenses + shares; never N+1.
- **Photos on local disk** don't survive serverless/multi-instance hosts. The `StorageAdapter` seam exists; the `r2`/`s3` branch must be implemented before such a deploy.
- **"Recent trips" + "you" are browser-local (R11).** Clearing storage or switching devices loses them; trip data is unaffected. No cross-device sync by design.
- **Participants can't be renamed or removed, closing is one-way** (out of scope). Typos and premature closes are permanent — flagged for a later revisit.

---

## 6. Mapping to spec

| Spec | Plan / code |
| --- | --- |
| R1 (add participants, unique names) | §2 (TripMember), `trips.addParticipant` / `createTrip` |
| R2 (expense fields, even + custom split) | §2 (Expense, ExpenseShare), §3.1–3.2, `expenses.prepareExpense` |
| R3 (net +/- balance) | §3.1 (`balance.ts`), `currency.formatSignedBalance` |
| R4 (receipt OCR + review) | §3.4 (`ocr.ts`, from-photo route), `storage.ts` |
| R5 (edit/delete while open) | `expenses.updateExpense` / `deleteExpense` (blocked when closed) |
| R6 (trip + currency, seed participants) | §2 (Trip), §3.2, `trips.createTrip` |
| R7 (persistence) | §1 (libSQL/Turso + local FS photos) |
| R8 (close trip, one-way, delete photos) | §2 (Trip.status), `trips.closeTrip` |
| R9 (secret-slug access, 404 on unknown) | §3.3, trip page `notFound()` |
| R10 (exact decimal math) | §3.2 (`big.js`, `share_of`, sum checks) |
| R11 (browser-local recent + "you") | `recent-trips.ts`, `PeoplePanel`, `RecentTrips` |
| Scenarios A, G, H | §3.1 / §3.2 unit tests |
| Scenario C | §3.4 |
| Scenarios B, D, E, F | home page, `trips/actions.ts`, trip page + `ShareButton` + `PeoplePanel` |

---

## 7. Open plan questions

None. The plan reflects the as-built app after the pivot away from the account-based design (see §1). Re-open if a question surfaces that the plan genuinely doesn't answer.
