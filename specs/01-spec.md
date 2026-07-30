# 01 — Specification

## 1. Purpose (one paragraph)

A simple, no-sign-up tool for a group on a trip to log shared expenses and see, at the end, a single net number per person — how much they owe or are owed (see R3). Avoids the awkward "wait, who paid for dinner Tuesday?" conversation. A trip lives at a shareable secret link; anyone with the link can view and edit it — no accounts, no login. Besides manually entering an expense, the tool can read a receipt photo and pre-fill the expense from it. Expenses can be split **evenly** among the people it covers, or by **custom** amounts when the split isn't equal (some expenses don't include everyone). We avoid the "who owes who" web of transactions; instead we show one overall figure per person: `-{amount}` = they should pay, `+{amount}` = they should receive.

## 2. Users

There are **no accounts**. A trip is reached through a non-guessable secret slug in its URL (`/trips/<publicId>`); knowing the link is the only credential. Anyone with the link can view the trip and edit it (add people, add/edit/delete expenses, close the trip). The link is the secret — treat sharing it as granting full access.

Within a trip, a **participant** is just a name. Everyone in the split — including the person who entered it — is a name-only participant; there is no "registered" vs "guest" distinction. Because the browser has no identity, each browser can optionally claim which participant is **"you"** (stored locally, see R11) so the UI can highlight your balance and default the payer to you.

## 3. Core scenarios

### Scenario A: Adding a simple (even) expense

**Given** a trip with Alice, Bob, and Carol
**When** someone records a $60 expense (description: "Dinner", date: today, payer: Alice, split: even among all three)
**Then** the app records: Bob -$20, Carol -$20, Alice +$40

### Scenario B: Opening the app

**Given** someone opens the home page
**When** the page loads
**Then** they see a hero with a **Create a trip** button, and below it the list of trips this browser has recently visited (remembered locally, see R11). If the browser has visited no trips, the recent-trips list is simply empty.

### Scenario C: Adding an expense from a receipt photo

**Given** a trip with Alice, Bob, and Carol
**When** someone uploads a photo of a bill ($60 for dinner)
**Then** the app scans the bill with an on-device vision model. If the photo is too blurry or isn't a legible receipt, the app discards the upload and asks for a re-upload. Otherwise, the app shows a review/edit screen pre-filled with the extracted amount, description (merchant), and date; the user must confirm or correct each field, choose the payer (the app does **not** assume the uploader paid), and choose the split. After confirmation, the expense is recorded as in Scenario A, with the receipt photo attached.

### Scenario D: Creating a new trip

**Given** someone wants a place to share expenses
**When** they click **Create a trip** and fill the form
**Then** they are prompted for: trip name (required), currency (required, from the supported list in R6), and an optional starting list of participant names. After saving, they are redirected to the new trip's page, which shows a shareable link.

### Scenario E: Sharing a trip

**Given** a trip exists
**When** someone wants others to join
**Then** the trip page exposes a **Share** button that copies the trip's link (`/trips/<publicId>`). There is no invitation/accept flow — the link *is* the access.

### Scenario F: Opening a shared link

**Given** someone receives a trip link
**When** they open it
**Then** the trip page loads directly (no login, no accept step). The browser records the visit into its recent-trips list (R11) and prompts "Which one are you?" so they can add themselves as a participant or pick an existing one as "you". If the trip's slug is unknown, the app shows a 404.

### Scenario G: Payer is excluded from the split

**Given** a trip with Alice, Bob, and Carol
**When** someone records a $20 expense (description: "Coffee for Bob & Carol", date: today, payer: Alice, split: even among Bob and Carol only — Alice excluded)
**Then** the app records: Bob -$10, Carol -$10, Alice +$20

### Scenario H: Custom (unequal) split

**Given** a trip with Alice, Bob, and Carol
**When** someone records a $100 expense (payer: Alice, split: custom — Alice $50, Bob $30, Carol $20)
**Then** the shares must sum to the total (else the app rejects the entry), and the app records: Alice +$50, Bob -$30, Carol -$20. A person given a $0 custom share is simply not part of that expense.

## 4. Requirements

*What MUST the app do? Number them — you'll cite these later (R1, R2, ...).*

- **R1.** Add a person to a trip by name. Any visitor to the trip (anyone with the link) can add participants. Names must be unique within a trip (case-insensitive) — balances are read by name, so duplicates would be ambiguous. A starting set of participants may also be entered on the create-trip form (R6).
- **R2.** Record an expense with a payer, a total amount, a short description, a date (defaults to today, editable), and a split. Two split modes:
  - **Even** — the total is divided equally among an *included* set of participants (at least one). Any subset may be included; the payer is independent of the included set and may be excluded (see Scenario G).
  - **Custom** — each participant is given an exact amount; the amounts must sum to the total. A participant with a $0 share is not part of the expense (see Scenario H).
  The payer must be a participant of the trip. The amount must be greater than zero and is rounded to the trip currency's precision (R6).
- **R3.** Show a balance summary as a net amount per person: `-$X` means "should pay", `+$X` means "should receive", `$0`/absent means "settled". No who-pays-whom suggestions. Balances are computed on demand from the raw expenses (never cached) and the net across all participants always sums to exactly zero.
- **R4.** Capture an expense from a receipt photo. The image is normalized and read by an **on-device vision model** (via Ollama; no external API). After scanning, the user is shown a review/edit screen pre-filled with the extracted amount, description, and date; the user must confirm or correct each field (and choose payer + split) before saving (see Scenario C). Readable uploads are stored and attached to the expense; unreadable or unprocessable uploads are discarded and a re-upload is requested. Stored receipt photos are retained for the trip's lifetime and deleted when the trip is closed (see R8).
- **R5.** Edit or delete an existing expense. Permitted for any visitor while the trip is open (there are no accounts to scope this to). Editing or deleting is blocked once the trip is closed (read-only).
- **R6.** Create and manage trips. Each trip has a name (required) and a currency chosen at creation from a fixed supported list: **USD, EUR, CNY** (2 decimal places) and **VND, JPY, KRW** (0 decimal places). The currency is fixed for the trip's lifetime and applies to every expense within it. The create form may also seed an initial list of participants (R1).
- **R7.** Persist trips, participants, expenses, receipt-photo references, and the shareable slug across sessions and devices, so any browser opening the link sees the same data.
- **R8.** Any visitor can close (archive) a trip. **Closing is permanent and one-way** — closed trips cannot be re-opened. Closed trips are read-only. Closing a trip deletes its receipt photos (see R4). If any participant still has a non-zero balance, the app warns before closing but does not block the action — the app never tracks real-world payment.
- **R9.** A trip is reached only by its non-guessable secret slug. There is no directory or search of trips; an unknown slug returns a 404 (does not leak existence). No authentication beyond possession of the link.
- **R10.** Split-amount arithmetic must be exact (decimal, not floating point). For an even split, the shares sum to the expense total exactly (the highest-id participant absorbs any rounding remainder). For a custom split, the app rejects the entry unless the shares sum to the total.
- **R11.** The browser remembers, locally (no server state), the trips it has visited (for the home page's recent list) and, per trip, which participant is "you". These are conveniences only; clearing them never affects trip data, and they are scoped to that one browser.

## 5. Explicitly out of scope

*What you are NOT building. This is the most important section — it stops scope creep.*

- [ ] User accounts, login/registration, passwords, email verification, or password reset (the app is deliberately account-free)
- [ ] Email of any kind (invitations, verification, receipts, notifications)
- [ ] An invitation/accept flow or per-recipient invite tokens (one shareable link per trip *is* the access)
- [ ] "Registered vs ghost member" distinction (all participants are name-only)
- [ ] Multi-currency within a single trip (one fixed currency per trip)
- [ ] Currencies outside the supported list of {USD, EUR, CNY, VND, JPY, KRW}
- [ ] Cross-device sync of the "recent trips" list or the "you" identity (these live only in the local browser)
- [ ] Mobile app (web only for v1)
- [ ] "Who pays whom" suggested settlement transactions (only net +/- per person is shown)
- [ ] Notifications (email, push, in-app)
- [ ] Real-time live updates between viewers (a manual refresh is acceptable for v1)
- [ ] Expense categories or tags, comments on expenses, audit log / change history
- [ ] Removing or renaming a participant after they've been added
- [ ] Re-opening a closed trip (closure is one-way and permanent)
- [ ] A trip date range (a trip has no start/end dates in v1)

## 6. Success criteria

*How do you know v1 is done? List the specific things that must work.*

- [ ] All scenarios in section 3 (A–H) produce the expected output
- [ ] All requirements (R1–R11) are implemented
- [ ] A trip with 3+ participants and 5+ expenses (mix of even and custom / include-exclude splits) produces a net-balance summary that sums to zero
- [ ] Trip data survives a full page reload and is identical when the same link is opened from another browser
- [ ] Closing a trip makes it read-only and removes its receipt photos from storage

## 7. Open questions

*All open questions for v1 are resolved. The app pivoted from an account-based design (Auth.js, email verification, invitation/accept, registered-vs-ghost members, Claude-vision OCR) to the account-free, link-shared, on-device-OCR design captured above; the spec now reflects the as-built app.*

*Reopen this section if a question surfaces during further work that the spec genuinely doesn't answer.*
