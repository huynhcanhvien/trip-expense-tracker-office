# 02 — Plan

## 1. Tech stack — locked

| Concern | Decision | Why (alternatives ruled out) |
|---|---|---|
| Language + framework | **TypeScript + Next.js (App Router)** | Single-language full-stack; biggest ecosystem; fastest path to ship for a first SDD project. *Ruled out:* Express+React (more glue), Django (less polished UX), FastAPI+React (most setup). |
| Database | **Turso (LibSQL) via `@libsql/client`** | SQLite-over-the-network, designed for serverless. Same SQL syntax as SQLite — the data model and queries below are unchanged. Generous free tier (8 GB). **Note:** the client is async (Promise-based), so every DB call uses `await` (unlike the synchronous `better-sqlite3`). *Ruled out:* SQLite-on-disk (incompatible with serverless hosting — see hosting row), Postgres (heavier than needed), Supabase (vendor lock-in). |
| Auth | **Auth.js (NextAuth) credentials provider** | Standard for Next.js; covers sessions, password hashing, verification, and reset flows. *Ruled out:* Lucia (more code), DIY (security risk), Supabase Auth (lock-in). |
| Photo storage | **Local FS in dev → Cloudflare R2 in prod** | Zero-friction dev loop; one-adapter swap to R2 (free egress, 10 GB tier) for prod. *Ruled out:* S3-from-day-1 (dev friction), DB BLOBs (bloats the DB; row-size limits). |
| OCR | **Claude vision (Anthropic API)** | Returns structured JSON in a single call; understands receipt context. *Ruled out:* Cloud Vision/Tesseract (need separate parsing), Textract (more setup). |
| Email | **Mailpit in dev → Resend in prod** | Build R8/R10 fully offline; swap to Resend (3000/mo free) for prod. *Ruled out:* Resend-from-day-1 (test-email risk), Postmark (smaller free tier), Gmail SMTP (rate limits). |
| Money math | **`big.js`** (decimal library) | Amounts stored as TEXT decimal strings; arithmetic via `.plus()` / `.minus()` / `.div()`. Tiny (~6KB), simple API, deterministic. *Ruled out:* integer minor units (more compact but less readable for a learning project), floats (correctness bug-farm), `decimal.js` (more featureful but bigger; can swap in later if needed since APIs are similar). |
| Test runner | **Vitest** + Playwright (e2e) | Vite-native and fast; follows from TS choice. Playwright runs the spec's scenarios A–G end-to-end. |
| Hosting | **AWS Amplify Hosting** | Serverless Next.js SSR on AWS. Builds from git via `amplify.yml`. Drove the Turso choice (Lambda has no persistent disk, so file-based SQLite is incompatible). Prod env vars: Turso URL + auth token, Anthropic API key, Resend API key, R2 credentials, Auth.js secret. |

### What this means for the build

- One repo, one language. No frontend/backend split.
- One dev process (`next dev`) plus a Mailpit container alongside.
- Database is a remote Turso instance — use one DB for dev, a separate DB for prod. Connection details in `.env.local` (gitignored).
- Production deploys via AWS Amplify with all secrets (Turso, R2, Resend, Anthropic, Auth.js) configured as Amplify env vars.

---

## 2. Data model (sketch)

The conceptual model (stack-agnostic). Concrete schema lives in `src/db/schema.sql` once tasks start.

```
User
  id, email (unique), password_hash, email_verified_at?, created_at

Trip
  id, name, date_start?, date_end?, currency (enum: USD/EUR/CNY/VND/JPY/KRW),
  creator_user_id (-> User), status (enum: open/closed),
  closed_at?, created_at

TripMember                          # one row per person-in-trip
  id, trip_id (-> Trip),
  user_id? (-> User, NULL for ghosts),
  ghost_name? (TEXT, NULL for registered),
  joined_at
  CHECK: exactly one of user_id / ghost_name is non-null

Expense
  id, trip_id (-> Trip),
  payer_member_id (-> TripMember),
  amount (TEXT, decimal string e.g. "12.34" — see §3.2),
  description (TEXT),
  expense_date (DATE),
  photo_path? (TEXT, NULL when no receipt photo),
  created_by_user_id (-> User),
  created_at

ExpenseShare                        # which members are "included"
  expense_id (-> Expense),
  member_id (-> TripMember),
  PK (expense_id, member_id)

InvitationToken
  trip_id (-> Trip), token (unique random), created_at
  # one row per trip; reused per R1

EmailVerificationToken
  user_id (-> User), token (unique random), created_at, used_at?

PasswordResetToken
  user_id (-> User), token (unique random), created_at, used_at?
  # single-use per R10
```

Notes:
- A **TripMember** is the domain identity for "person-in-trip", whether registered or ghost. Expenses point at TripMembers, not Users — this lets ghosts participate without contortions, and it makes the math uniform.
- The **`included`** set in R2 maps to rows in `ExpenseShare`. Empty set is forbidden by spec; enforce in the app layer (and as a CHECK / trigger if your DB supports it).
- Photos live on disk/object storage at `photo_path`; no BLOBs in the DB.

---

## 3. Key algorithms

### 3.1 Balance computation (R3)

```
for each member m in trip:
  paid     = sum(Big(e.amount)        for e in expenses if e.payer == m)
  consumed = sum(share_of(e, m)       for e in expenses if m in included(e))
  net[m]   = paid.minus(consumed)
```

…where `share_of(e, m)` is the deterministic split helper defined in §3.2.

`net[m].gt(0)` → "should receive". `net[m].lt(0)` → "should pay". The sum of all `net[m]` values must equal `Big(0)` exactly — this is the success-criteria check in section 6 of the spec.

Compute on-demand from raw expenses; **don't cache balances**. Balance becomes a pure function of the expense table — easy to reason about, no stale-state bugs when expenses are edited (R5).

### 3.2 Currency & rounding

Per R6, every trip has one currency from {USD, EUR, CNY (2dp), VND, JPY, KRW (0dp)}.

- **Library:** `big.js`. All money values flow through `Big` at the app layer. Arithmetic is `.plus()`, `.minus()`, `.div()`, `.times()`; comparisons are `.gt()`, `.lt()`, `.eq()`. Never use `+`, `-`, `*`, `/`, `==` on amounts.
- **Storage:** amounts are TEXT decimal strings in Turso (e.g. `"12.34"`, `"500"`). On read, wrap with `new Big(row.amount)`; on write, store `big.toString()`.
- **Splitting an expense's `amount` across N included members** — the `share_of(e, m)` helper used in §3.1:
  1. Sort `included(e)` by `member_id` ascending.
  2. Look up `dp` = decimal places for the trip's currency (USD/EUR/CNY = 2, JPY/VND/KRW = 0).
  3. For the first N-1 included members, their share = `Big(e.amount).div(N).round(dp, Big.roundDown)`.
  4. The Nth member (last by id) absorbs the rounding remainder: their share = `Big(e.amount).minus(sum of other shares)`.
  5. Guarantee: shares sum to `e.amount` exactly. The "remainder absorber" is always the highest-id included member, so re-running the algorithm yields identical results.

  Example: `Big("10.00")` split among 3 members (ids 7, 12, 19) → 3.33, 3.33, 3.34 (id 19 absorbs the cent). Sum: 10.00. ✓
- **Display formatting:** `new Intl.NumberFormat(locale, { style: "currency", currency })` with the trip's currency code. Pass `Number(big.toString())`. The currency code encodes the decimal places — don't hand-roll.

Property-based test (recommended): for any randomly-generated expense with N ≥ 1 included members, verify `sum(share_of(e, m_i)) === e.amount` exactly. This catches off-by-one rounding bugs early.

### 3.3 Invitation / verification / reset tokens

- 32+ bytes from a CSPRNG (`crypto.randomBytes(32)`), URL-safe base64.
- Verification + reset tokens are single-use; mark `used_at` atomically when consumed.
- Invitation tokens (R1) are reusable until trip closes — no `used_at` column.

### 3.4 OCR review flow (R4 / Scenario C)

```
1. User uploads image.
2. Server validates (mime, max size, e.g. 5MB).
3. Server calls Anthropic vision API with a prompt asking for: total amount,
   merchant/description hint, date — returned as JSON.
4. Server returns extracted fields + readable/unreadable flag to client.
5. Client renders pre-filled review form (NOT auto-saved per Round 4 decision).
6. User picks payer, included members, edits any field, clicks Save.
7. Server creates Expense + ExpenseShare rows; stores photo_path.
8. If OCR returned "unreadable", client shows re-upload prompt (Scenario C).
```

---

## 4. File / module layout

```
trip-expense-splitter/
├── specs/                 # locked spec, plan, tasks
├── public/uploads/        # local-dev photo storage (gitignored)
├── amplify.yml            # AWS Amplify build/deploy config
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # login, register, verify, reset routes
│   │   ├── dashboard/     # list of trips
│   │   ├── trips/[id]/    # trip detail, add expense, balance view
│   │   ├── invite/[token]/# preview + accept screen
│   │   └── api/           # API routes for OCR, photo upload
│   ├── lib/
│   │   ├── auth.ts        # Auth.js config
│   │   ├── db.ts          # @libsql/client connection (Turso)
│   │   ├── balance.ts     # §3.1 algorithm
│   │   ├── currency.ts    # §3.2 helpers — big.js wrappers, share_of, formatter
│   │   ├── tokens.ts      # §3.3 generation/verification
│   │   ├── ocr.ts         # §3.4 vision client (Anthropic SDK)
│   │   ├── storage.ts     # photo storage adapter (local | R2)
│   │   └── email.ts       # email sender adapter (mailpit | resend)
│   └── db/
│       ├── schema.sql     # tables from §2
│       └── migrate.ts     # one-shot script — applies schema.sql to Turso
└── tests/
    ├── balance.test.ts    # exhaustive math: equal split, include/exclude,
    │                      # payer-not-included, rounding remainders
    ├── currency.test.ts   # rounding + display
    └── e2e/               # Playwright: scenarios A–G as integration tests
```

---

## 5. Risks & tradeoffs

- **Risk: balance bugs from rounding.** Mitigation: `share_of` helper in §3.2 has the highest-id member absorb the remainder, guaranteeing share-sum = expense total. Property-based tests assert (a) shares sum to expense amount exactly, and (b) net balances across all members sum to `Big(0)`.
- **Risk: invitation links leak.** Acknowledged in spec (R1 chose reusable, no expiry). Mitigation: trip preview + explicit Accept (Scenario F) at least makes accidental joins less likely.
- **Risk: OCR returns wrong number, user clicks Save without checking.** Mitigation: review screen pre-fills *all* fields and requires explicit confirmation per round-4 decision; emphasize the amount field visually in the UI.
- **Risk: Anthropic OCR cost spirals.** Mitigation: 5MB upload cap; rate-limit per user/day; log every OCR call so usage is visible.
- **Risk: every DB query is a network round-trip to Turso.** Typical latency is sub-10ms but it adds up. Mitigation: keep `balance.ts` pure and feed it results of a single SELECT covering all expenses + shares; never N+1.
- **Risk: Turso / Amplify free-tier quotas (8 GB DB; Amplify build-minutes & SSR invocations).** Fine for v1 use, but worth monitoring before any wider rollout.
- **Risk: serverless cold starts.** First request after idle pays connection-setup cost on Lambda. Mitigation: use `@libsql/client`'s connection caching at module scope so warm Lambdas reuse the connection.
- **Tradeoff: ghost typos are permanent.** Out-of-scope per round-5 decision; flagged in the spec. May want to revisit before public launch.
- **Tradeoff: closing is one-way.** Out-of-scope per round-5 decision; cost is rare-but-possible "discovered missing receipt after close" pain.

---

## 6. Mapping to spec

Confirms every requirement is addressed.

| Spec | Plan section |
|---|---|
| R1 (members + invite) | §2 (User, TripMember, InvitationToken), §3.3 |
| R2 (expense fields, include/excl) | §2 (Expense, ExpenseShare), §3.1 |
| R3 (net +/- balance) | §3.1 |
| R4 (receipt OCR + review) | §1 (Claude vision), §3.4 |
| R5 (edit/delete by payer/creator) | App-layer authz check; no schema change |
| R6 (trip + currency) | §2 (Trip), §3.2 |
| R7 (persistence) | §1 (Turso + photo storage) |
| R8 (email/password + verify) | §1 (Auth.js + email), §3.3 |
| R9 (close trip, one-way) | §2 (Trip.status), app layer |
| R10 (password reset) | §1 (Auth.js + email), §3.3 |
| Scenarios A, G | §3.1 unit tests |
| Scenario C | §3.4 |
| Scenario F | §3.3 + invite preview route |

---

## 7. Open plan questions

None. Plan is locked across §1–§6. Implementation order lives in `specs/03-tasks.md`.

_Re-open this section if a question surfaces during implementation that the plan genuinely doesn't answer._
