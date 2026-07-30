# 03 — Tasks

Implementation order for v1, derived from `01-spec.md` and `02-plan.md`.

Conventions:

- Each task is small (~1 sitting), testable (ends with a verifiable check), and ends in a committable state.
- Every task cites the spec requirement(s) (R1–R11) or scenario(s) (A–H) it satisfies.
- Implement in numerical order; later tasks assume earlier ones are done.
- Do not bundle. Do not skip the "Done when" check. If a task grows too big, **split it**.

> **Note on history.** This project pivoted from an account-based design (Auth.js, email
> verification, invitation/accept, registered-vs-ghost members, Claude-vision OCR) to the
> account-free, link-shared, on-device-OCR app the specs now describe. The task list below is
> the as-built plan for that app; the auth/email/invite tasks from the original plan were dropped.

---

## Phase 1 — Foundation

Pure logic and infrastructure. No UI yet. Builds the safe core the rest depends on.

### T1. Scaffold the Next.js project

- **Satisfies:** foundational
- **Steps:**
  - `create-next-app` (TypeScript + App Router + ESLint), Next 16 / React 19.
  - Add deps: `@libsql/client`, `big.js`, `zod`, `sharp`. Dev: `vitest`, `@vitest/ui`, `@playwright/test`, `@types/big.js`, `tsx`.
  - Scripts: `dev`, `build`, `start`, `lint`, `migrate`, `test`, `test:watch`, `e2e`.
  - `.env.local.example` listing the (all-optional) dev vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_URL`, `OLLAMA_URL`, `OCR_MODEL`, `STORAGE_ADAPTER`.
- **Done when:** `npm run dev` serves a page; `npm test` runs (zero tests fine); layout matches §4 of the plan.

### T2. Currency module with property tests

- **Satisfies:** R6, R10; foundational for R2/R3
- **Files:** `src/lib/currency.ts`, `tests/currency.test.ts`
- **Implements §3.2:** currency enum + `decimalPlaces` (USD/EUR/CNY → 2, VND/JPY/KRW → 0); `share_of` (even split, highest-id absorbs remainder); `formatAmount` + `formatSignedBalance` via `Intl.NumberFormat`.
- **Done when:** `$10.00 / 3` → `[3.33, 3.33, 3.34]`; `¥500 / 3` → `[166, 166, 168]`; `$0 / N` → all zero; `$X / 1` → `[$X]`; **property test** `sum(share_of(...)) === amount` for random N ≥ 1. `npm test` green.

### T3. Balance computation

- **Satisfies:** R3, R10, scenarios A, G, H
- **Files:** `src/lib/balance.ts`, `tests/balance.test.ts`
- **Implements §3.1.** Pure function over raw expense + share rows → `Map<memberId, Big>` net. Handles both even (via `share_of`) and custom (`customShares`) splits.
- **Done when:** Scenario A (Alice +$40, Bob/Carol −$20); Scenario G (payer excluded: Alice +$20, Bob/Carol −$10); Scenario H (custom: Alice +$50, Bob −$30, Carol −$20) each pass as tests. Property test: `sum(net).eq(Big(0))` for any random trip.

### T4. Database connection, schema, and migrate script

- **Satisfies:** R7
- **Files:** `src/lib/db.ts`, `src/db/schema.sql`, `src/db/migrate.ts`
- **Implements §2.** Tables: trips (with unique `public_id`), trip_members, expenses, expense_shares (+ indexes). `db.ts` uses `@libsql/client`, falling back to a local `local.db` file when `TURSO_DATABASE_URL` is unset. `migrate.ts` is idempotent (`CREATE TABLE IF NOT EXISTS`).
- **Done when:** `npm run migrate` creates all tables (local file and against a Turso URL); a Vitest inserts/reads/deletes a trip round-trip.

---

## Phase 2 — Trips & sharing

### T5. Shareable slug + create a trip (Scenario D)

- **Satisfies:** R6, R9, scenario D; R1 (seed participants)
- **Files:** `src/lib/tokens.ts`, `src/lib/trips.ts` (`createTrip`), `src/app/NewTripForm.tsx` / `NewTripDialog.tsx`, `src/app/trips/actions.ts` (`createTripAction`)
- **Form fields:** name (required), currency (required dropdown of the six), optional starting participant names. On save: generate `public_id`, insert Trip + any TripMembers in one transaction, redirect to `/trips/<publicId>`.
- **Done when:** creating a trip lands on its page showing name + currency; missing name / bad currency / duplicate participant names show clear errors.

### T6. Home page with recent trips (Scenario B, R11)

- **Satisfies:** scenario B, R11
- **Files:** `src/app/page.tsx`, `src/app/RecentTrips.tsx`, `src/lib/recent-trips.ts`, `trips.getTripSummaries` + `fetchTripSummariesAction`
- **Steps:** hero + "Create a trip"; `recent-trips.ts` reads/writes the visited-trips list in `localStorage` (SSR-safe); the home page fetches fresh summaries for those ids.
- **Done when:** a fresh browser shows an empty recent list; after visiting a trip it appears; clicking a card opens the trip.

### T7. Trip page + share link (Scenario E, R9)

- **Satisfies:** scenario E, R9
- **Files:** `src/app/trips/[publicId]/page.tsx`, `ShareButton.tsx`, `src/lib/urls.ts`
- **Steps:** show trip metadata, participants, expenses, balances; a **Share** button copies `<APP_URL>/trips/<publicId>`. Unknown slug → `notFound()` (404, no existence leak).
- **Done when:** the page renders for a valid slug and the Share button copies a working URL; an unknown slug 404s.

### T8. Add participants + "you" (R1, R11, Scenario F)

- **Satisfies:** R1, R11, scenario F
- **Files:** `src/app/trips/[publicId]/PeoplePanel.tsx`, `trips.addParticipant` + `addParticipantAction`
- **Steps:** anyone with the link can add a participant by name (unique per trip, case-insensitive). The browser records which participant is "you" (localStorage) and offers "Which one are you?" on first visit; the roster highlights you.
- **Done when:** adding a name creates a member and refreshes the roster; a duplicate name is rejected; claiming "you" highlights the row and persists across reloads in that browser.

---

## Phase 3 — Expenses

### T9. Add expense form — even + custom split (R2, scenarios A, G, H)

- **Satisfies:** R2, R10, scenarios A, G, H
- **Files:** `src/app/trips/[publicId]/AddExpense*.tsx`, `ExpenseForm.tsx`, `expenses.createExpense` (`prepareExpense`), `expense-actions.ts`
- **Fields:** description (required), date (default today), amount (Big.js-validated, > 0), payer (member dropdown, defaults to "you"), split mode (even → checkbox per member, ≥1; custom → per-member amount, must sum to total).
- **Validations:** amount > 0 and rounded to currency dp; even set non-empty; custom shares sum to total; payer is a member (may be excluded from the split).
- **Done when:** Scenario A / G / H each produce the expected stored rows; empty even set and mismatched custom sums are rejected with clear errors; both insert Expense + ExpenseShare in one transaction.

### T10. Balance summary on the trip page (R3)

- **Satisfies:** R3
- **Files:** trip page, using `balance.ts` (T3)
- **Render:** per-participant net (`+$X` / `-$X`) in the trip currency, sorted descending; show only unsettled people, else "everyone's settled". Load all expenses + shares in **one** pass — never N+1.
- **Done when:** after Scenario A the page shows Alice +$40, Bob/Carol −$20 with correct formatting; adding Scenario G/H updates correctly; reload yields identical numbers (persistence).

### T11. Edit and delete an expense (R5)

- **Satisfies:** R5
- **Files:** edit route `expenses/[expenseId]/edit/page.tsx`, `DeleteExpenseButton.tsx`, `expenses.updateExpense` / `deleteExpense`
- **Rules:** any visitor may edit/delete **while the trip is open** (no per-user authz — there are no accounts); blocked once closed. Delete confirms; edit reuses the T9 form pre-filled.
- **Done when:** editing refreshes balances; deleting removes the expense + its shares; both fail on a closed trip.

---

## Phase 4 — Receipt OCR

### T12. Photo storage adapter (local FS)

- **Satisfies:** R4 prerequisite, R7
- **Files:** `src/lib/storage.ts`
- **Interface:** `save(file) → {path}`, `load(path) → Buffer`, `delete(path)`. Local impl writes `public/uploads/<uuid>.<ext>`. Validates `image/*` and size ≤ 5 MB. Adapter chosen by `STORAGE_ADAPTER` (`local`; `r2`/`s3` stubbed → clear error).
- **Done when:** a unit test round-trips a fake image save → load → delete; non-images and oversize files are rejected.

### T13. OCR + review flow (R4, scenario C)

- **Satisfies:** R4, scenario C
- **Files:** `src/lib/ocr.ts`, `src/app/api/expenses/from-photo/route.ts`, `AddFromPhoto.tsx`
- **Steps (implements §3.4):** upload → resolve trip (404/403 guards) → store → `sharp` normalize (orient, downscale, PNG) → Ollama vision call with JSON schema → `normalizeReceiptFields` guards the output. Unreadable or infra failure → discard the file, prompt re-upload (scenario C) / 502. Readable → return fields + `receiptPath`; UI pre-fills the T9 review form (payer **not** pre-filled). Save via the normal add-expense flow, linking the photo.
- **Done when:** clear receipt → review → confirm → expense appears with its photo viewable; unreadable image → re-upload prompt; Ollama down → clear error, no orphaned file; payer left un-prefilled.

---

## Phase 5 — Closing trips

### T14. Close (archive) a trip (R8)

- **Satisfies:** R8
- **Files:** `CloseTripButton.tsx`, `trips.closeTrip` + `closeTripAction`
- **Steps:** anyone with the link can close. Warn if any balance is non-zero ("X still unsettled — close anyway?"), but never block. On confirm: `status='closed'`, `closed_at=now`, null every `photo_path`, best-effort delete the photo files. **Permanent, one-way.** Closed trip page is read-only (add/edit/delete/close hidden).
- **Done when:** closing a balanced trip takes one confirm; closing an unbalanced one warns then completes; after close, photos are gone from disk and the page is read-only; the recent-trips card reflects the archived status.

---

## Phase 6 — End-to-end coverage

### T15. Playwright e2e for spec scenarios

- **Satisfies:** success criterion "All scenarios produce the expected output"
- **Files:** `tests/e2e/scenario-a.spec.ts` … `scenario-g.spec.ts` (+ `helpers.ts`, `global-setup.ts`)
- **Steps:** drive each scenario through the UI from a fresh state. For Scenario C, mock the OCR endpoint rather than hitting Ollama in CI.
- **Done when:** `npm run e2e` passes locally. Scenarios A–G are covered today; **Scenario H (custom split) still needs an e2e** to match the new spec.

---

## Phase 7 — Production hardening (not required for v1 local use)

### T16. Object-storage adapter (R2/S3)

- **Satisfies:** R7 (prod), R4 (prod)
- **Files:** `src/lib/storage.ts` — implement the stubbed `r2`/`s3` branch behind the same interface; pick via `STORAGE_ADAPTER`. Needed before any serverless/multi-instance deploy (photos currently live on local disk).
- **Done when:** with `STORAGE_ADAPTER=r2` + creds, T12's round-trip passes against a real bucket; `local` is unchanged.

### T17. Hosted OCR fallback (optional)

- **Satisfies:** R4 (GPU-less prod)
- **Files:** `src/lib/ocr.ts` — allow swapping the Ollama backend for a hosted vision API (see `scripts/ocr-compare/`) when no GPU host is available.
- **Done when:** with the hosted provider configured, a clear receipt scans end-to-end; the Ollama path is unchanged.

---

## Progress

- [x] T1 — Scaffold Next.js project
- [x] T2 — Currency module (+ property tests)
- [x] T3 — Balance computation (even + custom)
- [x] T4 — DB connection + schema + migrate (Turso / local.db)
- [x] T5 — Shareable slug + create trip
- [x] T6 — Home page + recent trips (localStorage)
- [x] T7 — Trip page + share link
- [x] T8 — Add participants + "you"
- [x] T9 — Add expense form (even + custom split)
- [x] T10 — Balance summary on trip page
- [x] T11 — Edit / delete expense
- [x] T12 — Photo storage adapter (local)
- [x] T13 — OCR + review flow (Ollama qwen2.5vl)
- [x] T14 — Close trip
- [x] T15 — Playwright e2e for scenarios (A–G; Scenario H pending)
- [ ] T16 — Object-storage adapter (R2/S3) — stubbed only
- [ ] T17 — Hosted OCR fallback — optional
