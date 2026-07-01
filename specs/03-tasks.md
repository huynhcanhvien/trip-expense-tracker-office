# 03 — Tasks

Implementation order for v1, derived from `01-spec.md` (locked) and `02-plan.md` (locked).

Conventions:
- Each task is small (~1 sitting), testable (ends with a verifiable check), and ends in a committable state — make a commit when done.
- Every task cites the spec requirement(s) (R1–R10) or scenario(s) (A–G) it satisfies.
- Implement in numerical order. Later tasks assume earlier ones are done.
- Do not bundle. Do not skip the "Done when" check.
- If a task ends up bigger than expected, **split it** rather than ploughing through.

---

## Phase 1 — Foundation

Pure logic and infrastructure. No UI yet, no auth yet. Builds the safe core the rest of the app depends on.

### T1. Scaffold the Next.js project
- **Satisfies:** foundational (no spec requirement)
- **Prereqs (manual, do these first):**
  - Sign up for [Turso](https://turso.tech) — create one DB for dev, one for prod. Note the URL + auth token for each.
  - Install Docker Desktop or have a way to run [Mailpit](https://github.com/axllent/mailpit) locally (used by T6).
- **Steps:**
  - `npx create-next-app@latest .` in the project root, accepting TypeScript + App Router + ESLint defaults.
  - Add deps: `npm i @libsql/client big.js zod`. Dev deps: `npm i -D vitest @vitest/ui playwright @types/big.js`.
  - Add `npm test` (vitest) and `npm run e2e` (playwright) scripts.
  - Add `.env.local.example` listing required env vars (Turso URL/token, Anthropic key, Auth.js secret, R2 creds, Resend key) — empty values committed; real values in `.env.local` (gitignored).
- **Done when:**
  - `npm run dev` shows a "hello" page on localhost.
  - `npm test` runs (zero tests is fine).
  - Files committed match §4 of the plan (with empty stubs for `lib/*.ts`).

### T2. Currency module with property tests
- **Satisfies:** R6, foundational for R2/R3
- **Files:** `src/lib/currency.ts`, `tests/currency.test.ts`
- **Implements §3.2 of the plan:**
  - Currency enum + decimal-places lookup (`USD/EUR/GBP → 2`, `VND/JPY → 0`).
  - `share_of(amount: Big, includedMembers: number[], dp: number): Map<memberId, Big>` — sorts ids ascending, gives first N-1 the floor share, last absorbs remainder.
  - `formatAmount(amount: Big, currency): string` using `Intl.NumberFormat`.
- **Done when:**
  - Unit tests for `share_of`: `$10.00 / 3` → `[3.33, 3.33, 3.34]`; `¥500 / 3` → `[166, 166, 168]`; `$0 / N` → all zero; `$X / 1` → `[$X]`.
  - **Property test:** for any random expense and any N ≥ 1, `sum(share_of(...)) === amount` exactly.
  - All tests pass: `npm test`.

### T3. Balance computation
- **Satisfies:** R3, scenarios A and G
- **Files:** `src/lib/balance.ts`, `tests/balance.test.ts`
- **Implements §3.1 of the plan.** Pure function: takes plain expense + share rows, returns a `Map<memberId, Big>` of net balances.
- **Done when:**
  - Scenario A from `01-spec.md` passes as a test (Alice +$40, Bob –$20, Carol –$20).
  - Scenario G passes (payer excluded: Alice +$20, Bob –$10, Carol –$10).
  - Property test: for any random trip with N expenses, `sum(net values).eq(Big(0))`.

### T4. Database connection, schema, and migrate script
- **Satisfies:** R7
- **Files:** `src/lib/db.ts`, `src/db/schema.sql`, `src/db/migrate.ts`
- **Implements §2 of the plan.** Tables: User, Trip, TripMember (with CHECK constraint), Expense, ExpenseShare, InvitationToken, EmailVerificationToken, PasswordResetToken. Add appropriate indexes.
- **`migrate.ts`** is a one-shot Node script: read `schema.sql`, run via `@libsql/client`. Idempotent (use `CREATE TABLE IF NOT EXISTS`).
- **Done when:**
  - `npx tsx src/db/migrate.ts` against the dev Turso DB succeeds and creates all tables.
  - Smoke test: a Vitest that connects, inserts a row into `User`, reads it back, deletes it. Passes.

---

## Phase 2 — Authentication

Implements R8 and R10. Once this phase is done, the app has working accounts but nothing else.

### T5. Auth.js setup with credentials provider and libsql adapter
- **Satisfies:** R8 (login + register, sans verification)
- **Files:** `src/lib/auth.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/api/auth/[...nextauth]/route.ts`
- **Steps:**
  - Install `next-auth@beta` (Auth.js v5) + `@auth/libsql-adapter` + `bcryptjs`.
  - Wire credentials provider with bcrypt password hashing.
  - Register page: email + password (with confirm) → POST creates User row, redirects to login.
  - Login page: email + password → session cookie set on success.
  - Logout button in a minimal header.
- **Done when:**
  - Can register a new user, log in, see a placeholder dashboard, log out.
  - Session survives a full-page reload (Vitest or manual). 
  - Vitest: registering with an existing email returns a clear error; wrong password returns a clear error.
- **Note:** Email is *not* verified yet — that's T6. Until then, allow login with `email_verified_at = NULL`.

### T6. Email verification flow with Mailpit
- **Satisfies:** R8 (the verification half)
- **Files:** `src/lib/email.ts` (Mailpit adapter), `src/lib/tokens.ts`, `src/app/(auth)/verify/[token]/page.tsx`, registration handler updates
- **Steps:**
  - `tokens.ts`: implements §3.3 of the plan (CSPRNG, URL-safe base64, atomic single-use mark).
  - `email.ts` exposes `sendEmail(to, subject, html)` with a Mailpit (SMTP localhost:1025) impl.
  - Registration now creates an `EmailVerificationToken` and emails a verification link.
  - Login is **blocked** if `email_verified_at IS NULL` — show "check your email" message.
  - Verify route consumes the token (single-use) and sets `email_verified_at`.
- **Done when:**
  - Register a fresh user → check Mailpit at `http://localhost:8025` → click the link → can now log in.
  - Trying to log in pre-verification fails with the right error.
  - Reusing a verification token is rejected.

### T7. Password reset flow
- **Satisfies:** R10
- **Files:** `src/app/(auth)/forgot/page.tsx`, `src/app/(auth)/reset/[token]/page.tsx`, supporting handlers
- **Steps:**
  - "Forgot password?" link on login page.
  - Forgot page: enter email → if user exists, create `PasswordResetToken` and email a reset link. (Always show the same success message regardless of whether the email is known — don't leak existence.)
  - Reset page: new password + confirm → consume token (single-use) → update `password_hash` → redirect to login.
- **Done when:**
  - Full happy-path works against Mailpit.
  - Reusing a reset token is rejected.
  - Submitting the forgot form for an unknown email shows the same UI as a known one.

---

## Phase 3 — Trips and invitations

### T8. Create a new trip (Scenario D)
- **Satisfies:** R6, scenario D
- **Files:** `src/app/dashboard/new/page.tsx` (or modal), trip-creation handler, `src/app/trips/[id]/page.tsx` (skeleton)
- **Form fields:** name (required), date_start (optional), date_end (optional), currency (required, dropdown of {USD, EUR, GBP, VND, JPY}).
- **On save:** create Trip row, create a TripMember row for the creator (with `user_id` set), generate the InvitationToken row, redirect to trip page.
- **Done when:**
  - Logged-in user can fill the form, save, and lands on a trip page showing the trip's name + currency. No expenses yet.
  - Validation: missing name shows error; date_end before date_start shows error.

### T9. Dashboard listing user's trips (Scenario B)
- **Satisfies:** scenario B (the "after login" half)
- **Files:** `src/app/dashboard/page.tsx`
- **Steps:**
  - List trips where the current user has a TripMember row, split into **Active** and **Archived** sections.
  - If user has zero trips: empty state with a "Create new trip" button.
  - Each trip card shows: name, date range, currency, member count.
- **Done when:**
  - New user sees the empty state.
  - After T8, dashboard shows the new trip in Active.
  - Click on a trip → goes to its main page.

### T10. Trip detail page + share invitation link (Scenario E)
- **Satisfies:** scenario E
- **Files:** `src/app/trips/[id]/page.tsx`
- **Steps:**
  - Show trip metadata, member list, and a **Share** button.
  - Share button copies `https://<host>/invite/<token>` to clipboard and shows a toast.
  - Only members of the trip can view the page; non-members get a 404 (not 403 — don't leak existence).
- **Done when:**
  - Creator sees the trip page with their own membership and a Share button that copies a working URL.
  - A non-member visiting `/trips/<id>` gets a 404.

### T11. Invitation preview + accept (Scenario F)
- **Satisfies:** scenario F, R1 (registered user path)
- **Files:** `src/app/invite/[token]/page.tsx`
- **Implements all four sub-cases from Scenario F:** logged-in not-yet-member, logged-out verified, brand-new, already-member.
- **Preview shows:** trip name, member list, expense count. **Not** expense details.
- **Accept** creates a TripMember row pointing at the User; redirects to trip page.
- **Done when:**
  - All four sub-cases produce the expected redirect outcome.
  - Re-clicking the link as an existing member redirects to the trip without creating a duplicate row.
  - Invalid/expired (closed-trip) tokens show a friendly error.

### T12. Add ghost members (R1, ghost path)
- **Satisfies:** R1 (ghost half)
- **Files:** trip page UI for adding a ghost; backend handler.
- **Any trip member** can add a ghost (per round-3 decision). Ghost is a TripMember with `ghost_name` set and `user_id = NULL`.
- **Done when:**
  - Form on trip page accepts a name and creates a ghost.
  - Ghost appears in the member list, distinguishable from registered members (e.g. a small "(guest)" tag).
  - The CHECK constraint from §2 is enforced (rejects rows with both or neither set).

---

## Phase 4 — Expenses

### T13. Add expense form (R2, scenarios A and G)
- **Satisfies:** R2, scenarios A and G
- **Files:** trip page → "Add expense" form/modal, handler.
- **Form fields:** description (required), date (default today), amount (string input, validated via Big.js), payer (dropdown of trip members), included (checkbox per member, default all checked).
- **Validations:** amount > 0; included set non-empty; payer must be a trip member; payer **may or may not** be in included (Scenario G).
- **On save:** insert Expense + ExpenseShare rows in a single transaction.
- **Done when:**
  - Scenario A's example produces the expected stored rows.
  - Scenario G's example (payer excluded) is accepted and stored.
  - Submitting with empty included set is rejected with a clear error.

### T14. Trip page balance summary (R3)
- **Satisfies:** R3
- **Files:** trip page component, uses `lib/balance.ts` from T3.
- **Render:** member list with formatted amount (`+$X` / `-$X` / `$0`) per member, in the trip's currency. Sort by amount descending.
- **Performance:** load all expenses + shares in **one** query and pass to `balance.ts` — never N+1.
- **Done when:**
  - After adding the Scenario A expense, the page shows Alice +$40, Bob -$20, Carol -$20 with proper currency formatting.
  - Adding the Scenario G expense updates the balances correctly.
  - Page reload yields the same numbers (proving persistence; covers part of R7's success criterion).

### T15. Edit and delete expense (R5)
- **Satisfies:** R5
- **Files:** edit/delete UI on each expense row + handlers.
- **Authz:** only the original payer **or** the trip's creator can edit or delete. Enforce on the server, not just the UI.
- **UX:** delete asks for confirmation; edit reuses the form from T13 pre-filled.
- **Done when:**
  - Payer can edit their expense; balances refresh correctly.
  - Trip creator can edit/delete any expense.
  - A non-payer non-creator member's edit/delete attempt is rejected (server-side test).

---

## Phase 5 — Receipt OCR

### T16. Photo storage adapter (local FS)
- **Satisfies:** R4 prerequisite, R7
- **Files:** `src/lib/storage.ts`
- **Interface:** `save(file): Promise<{path: string}>`, `load(path): Promise<Buffer>`, `delete(path): Promise<void>`.
- **Local impl:** writes under `public/uploads/<random-uuid>.<ext>`, returns `path`.
- **Validations:** mime type is `image/*`, size ≤ 5 MB.
- **Done when:**
  - Unit test round-trips a fake image through save → load → delete.
  - Rejecting non-images and oversize files is verified.

### T17. OCR + review flow (R4, scenario C)
- **Satisfies:** R4, scenario C
- **Files:** `src/lib/ocr.ts`, `src/app/api/expenses/from-photo/route.ts`, "Add from photo" UI on trip page.
- **Steps:**
  - Upload image → server validates → stores via T16 → calls Anthropic vision with a prompt asking for `{ amount, description, expense_date, readable: bool }` JSON.
  - If `readable: false`, return a "re-upload please" response; UI shows the prompt (Scenario C).
  - Otherwise, return extracted fields; UI renders the same review form as T13 with values pre-filled. **Save is not automatic** — user must confirm (round-4 decision).
  - On save, create the Expense + ExpenseShare rows linked to the saved photo path.
- **Done when:**
  - Happy path: upload a clear receipt → review → confirm → expense appears with the photo path stored and the photo viewable on the expense.
  - Blurry path: upload an unreadable image (or mock the API to return `readable: false`) → reupload prompt appears.
  - Payer is **not** assumed to be the uploader — review form has the payer dropdown un-prefilled.

---

## Phase 6 — Closing trips

### T18. Close (archive) a trip (R9)
- **Satisfies:** R9
- **Files:** trip page "Close trip" UI (creator only), handler.
- **Steps:**
  - Only the trip creator sees the button.
  - On click, compute current balances. If any are non-zero, show a confirmation dialog: "X members still have unsettled balances. Close anyway?" (per round-4 decision). Otherwise, simpler "Are you sure?".
  - On confirm: set `status='closed'`, `closed_at=now`, delete all photo files for the trip via T16, set every Expense's `photo_path = NULL`. **Permanent and one-way** (round-5 decision).
  - Closed trip page is read-only (forms hidden, edit/delete disabled).
  - Dashboard's Archive section (from T9) now shows it.
- **Done when:**
  - Creator can close a balanced trip with a single confirmation.
  - Closing an unbalanced trip shows the warning and still completes.
  - After closing: photos are deleted from disk; trip page reflects read-only mode; dashboard moves the trip to Archive.

---

## Phase 7 — Production wiring

### T19. R2 photo storage adapter
- **Satisfies:** R7 (prod), R4 (prod)
- **Files:** `src/lib/storage.ts` extended with R2 impl behind the same interface.
- **Steps:**
  - Pick adapter at module init based on `process.env.STORAGE_ADAPTER` (`local` | `r2`).
  - R2 impl uses the AWS SDK `S3Client` pointed at R2's S3-compatible endpoint.
  - Update `.env.local.example` with R2 vars.
- **Done when:**
  - Setting `STORAGE_ADAPTER=r2` and valid creds, T16's round-trip test passes against a real R2 bucket.
  - With `STORAGE_ADAPTER=local`, behavior is unchanged.

### T20. Resend email adapter
- **Satisfies:** R8 (prod), R10 (prod)
- **Files:** `src/lib/email.ts` extended with Resend impl.
- **Steps:**
  - Adapter switch on `EMAIL_ADAPTER` (`mailpit` | `resend`).
  - Resend impl uses the official `resend` package.
- **Done when:**
  - In prod-like env, registration sends a verification email via Resend that arrives at a real inbox.
  - In dev, Mailpit still works as before.

### T21. Amplify deploy
- **Satisfies:** all of the above, in production.
- **Files:** `amplify.yml`, env vars set in Amplify Console.
- **Steps:**
  - Push the repo to GitHub (creating a remote is its own one-time setup).
  - Connect the repo to AWS Amplify Hosting; configure Next.js SSR build.
  - Set all env vars in Amplify console (Turso prod URL/token, Anthropic key, Auth.js secret, R2 creds, Resend key, `STORAGE_ADAPTER=r2`, `EMAIL_ADAPTER=resend`).
  - Run `npx tsx src/db/migrate.ts` against the **prod** Turso DB once.
- **Done when:**
  - First Amplify deploy succeeds; logging in / registering on the deployed URL works end-to-end.
  - A receipt photo uploaded in prod lands in R2.
  - A verification email is delivered via Resend.

---

## Phase 8 — End-to-end coverage

### T22. Playwright e2e for spec scenarios
- **Satisfies:** success criterion "All scenarios produce the expected output"
- **Files:** `tests/e2e/scenario-a.spec.ts` … `scenario-g.spec.ts`
- **Steps:** translate each spec scenario (A–G) into a Playwright test that drives the UI from a fresh state. For Scenario C, mock the Anthropic vision API rather than hitting it from CI.
- **Done when:**
  - `npm run e2e` passes all 7 scenarios locally.
  - Spec success criteria can be ticked off: "All scenarios in section 3 produce the expected output."

---

## Progress

- [x] T1 — Scaffold Next.js project
- [x] T2 — Currency module
- [x] T3 — Balance computation
- [x] T4 — Database connection + schema + migrate
- [x] T5 — Auth.js (register / login / logout)
- [x] T6 — Email verification (console fallback; Mailpit adapter ready)
- [x] T7 — Password reset
- [x] T8 — Create trip
- [x] T9 — Dashboard listing
- [x] T10 — Trip page + share invite
- [x] T11 — Invitation preview + accept
- [x] T12 — Add ghost members
- [ ] T13 — Add expense form
- [ ] T14 — Balance summary on trip page
- [ ] T15 — Edit / delete expense
- [ ] T16 — Photo storage adapter (local)
- [ ] T17 — OCR + review flow
- [ ] T18 — Close trip
- [ ] T19 — R2 storage adapter
- [ ] T20 — Resend email adapter
- [ ] T21 — Amplify deploy
- [ ] T22 — Playwright e2e for scenarios A–G
