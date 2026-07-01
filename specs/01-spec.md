# 01 — Specification

## 1. Purpose (one paragraph)

A simple tool for a group on a trip to log shared expenses and see, at the end, a single net number per person — how much they owe or are owed (see R3). Avoids the awkward "wait, who paid for dinner Tuesday?" conversation. Beside manually input expense, this tool also has the capability to upload photos and calculate expense from that. This tool should also allows split inequally, as there might be some expenses that not included by all members. Avoid who owes who situation, instead give the overall expense for each people, with -{amount} for they should pay how much and +{amount} for they should receive how much.

## 2. Users

Public users with accounts. A trip's data is visible only to its members.

Members of a trip can be either:
- **Registered users** — have an account, can log in, can be invited via link.
- **Ghost members** — added to a trip by name only by another member. Appear in splits and balances but cannot log in. (Claiming a ghost into a real account is out of scope for v1.)

## 3. Core scenarios

### Scenario A: Adding a simple expense
**Given** Alice, Bob, and Carol are on a trip
**When** Alice records a $60 expense (description: "Dinner", date: today, payer: Alice, included: all three)
**Then** the app records: Bob -$20, Carol -$20, Alice +$40

### Scenario B: Normal login
**Given** User want to login 
**When** User login or register normally
**Then** the app redirects the user to the main dashboard that lists all their trips. If the user has no trips yet, the dashboard shows an empty state with a "Create new trip" button. If the user logged in after receiving an invitation, they are redirected to the trip-preview/accept screen for that invitation instead (see Scenario F).

### Scenario C: Adding expense through screenshot
**Given** Alice, Bob, and Carol are on a trip
**When** Alice uploads a photo of a bill ($60 for dinner)
**Then** the app analyzes the bill. If the photo is too blurry to read, the app asks Alice to re-upload. Otherwise, the app shows a review/edit screen pre-filled with the extracted amount, description, and date; Alice must confirm or correct each field, choose the payer (the app does NOT assume the uploader paid), and choose the included members. After confirmation, the app records the expense as in Scenario A.

### Scenario D: User creates a new trip
**Given** User A wants to create a new trip to share expenses
**When** User A opens the dashboard (which lists all their trips) and clicks **New trip**
**Then** User A is prompted for: trip name (required), optional date range, and currency (required, from the supported list in R6). After saving, User A is redirected to the main page of the new trip.

### Scenario E: Invite people to trip
**Given** X create a new trip
**When** X want to invite friends to the trip
**Then** the app creates an invitation link right after the trip is created, **and** the trip's main page exposes a share button that copies that same link at any time.

### Scenario F: Process after inviting people to trip
**Given** User A receives an invitation link
**When** User A clicks the link
**Then**:
- If User A is already logged in and not yet a member: they see a trip preview (name, member list, expense count) and an explicit **Accept invitation** button. On accept, they are added to the trip and redirected to its main page.
- If User A is logged out but has a verified account: they are prompted to log in, then shown the preview/accept screen above.
- If User A is new: they are prompted to register, then must verify their email (per R8). Once verified and logged in, they are shown the preview/accept screen.
- If User A is already a member of the trip: they are redirected to the trip's main page (no preview, no double-add).

### Scenario G: Payer is excluded from the split
**Given** Alice, Bob, and Carol are on a trip
**When** Alice records a $20 expense (description: "Coffee for Bob & Carol", date: today, payer: Alice, included: Bob and Carol only — Alice excluded)
**Then** the app records: Bob -$10, Carol -$10, Alice +$20

## 4. Requirements

_What MUST the app do? Number them — you'll cite these later (R1, R2, ...)._

- **R1.** Add a person to the trip:
    - **Registered users** are invited via a reusable trip invitation link with no expiry. Clicking the link shows a trip preview (trip name, member list, expense count — *not* expense details) and an explicit Accept step before the user is added. Anyone with the link can accept until the trip is closed. Re-clicking the link once already a member redirects to the trip without re-adding.
    - **Ghost members** are added by name only, by any existing member of the trip.
- **R2.** Record an expense with payer, total amount, the set of people it's shared by (the *included* set), a short description, and a date (defaults to today, editable). Each expense has an include/exclude toggle per member; the total is split equally among the included. The payer is independent of the included set — the payer may be excluded (e.g. Alice pays for Bob and Carol but didn't share; see Scenario G). The included set must contain at least one member.
- **R3.** Show a balance summary as net amount per person: `-$X` means "should pay", `+$X` means "should receive". No who-pays-whom suggestions.
- **R4.** Capture an expense from a receipt photo. After OCR, the user is shown a review/edit screen pre-filled with the extracted amount, description, and date; the user must confirm or correct each field (and choose payer + included members) before saving (see Scenario C). The uploaded image is retained for the trip's lifetime and deleted when the trip is closed (see R9).
- **R5.** Edit or delete an existing expense — permitted only for the original payer or the trip's creator.
- **R6.** Create and manage trips. Each trip has a name (required), an optional date range, and a currency chosen at creation from a fixed supported list: **USD, EUR, CNY** (2 decimal places) and **VND, JPY, KRW** (0 decimal places). The currency is fixed for the trip's lifetime and applies to every expense within it.
- **R7.** Persist accounts, trips, members, expenses, and receipt photos across sessions.
- **R8.** Authenticate users via email + password. Email verification is required before a user can log in or accept a trip invitation.
- **R9.** Trip creator can close (archive) a trip. **Closing is permanent and one-way** — closed trips cannot be re-opened. Closed trips are read-only and live in a separate archive section. Closing a trip deletes its receipt photos (see R4). If any member still has a non-zero balance, the app warns the creator before closing but does not block the action — the app never tracks real-world payment.
- **R10.** Password reset via a one-time emailed link. Users can request a reset from the login page; they receive an email with a single-use link to set a new password.

## 5. Explicitly out of scope

_What you are NOT building. This is the most important section — it stops scope creep._

- [ ] Multi-currency support
- [ ] Mobile app (web only for v1)
- [ ] "Who pays whom" suggested settlement transactions (only net +/- per person is shown)
- [ ] Claiming a ghost member into a registered account
- [ ] Notifications (email, push)
- [ ] Real-time live updates between members (a manual refresh is acceptable for v1)
- [ ] Expense categories or tags
- [ ] Comments on expenses
- [ ] Audit log / change history
- [ ] Removing or kicking members from a trip after they've been added (members stay for the life of the trip)
- [ ] Single-use or expiring invitation links (one reusable link per trip)
- [ ] Currencies outside the supported list of {USD, EUR, CNY, VND, JPY, KRW}
- [ ] Re-opening a closed trip (closure is one-way and permanent)
- [ ] Editing a ghost member's name after creation, and removing/replacing ghosts

## 6. Success criteria

_How do you know v1 is done? List the specific things that must work._

- [ ] All scenarios in section 3 produce the expected output
- [ ] All requirements (R1–R10) are implemented
- [ ] A trip with 3+ members and 5+ expenses (mix of equal-share and include/exclude splits) produces a net-balance summary that sums to zero
- [ ] Trip data survives a logout/login cycle

## 7. Open questions

_Things you don't know yet. Leave them here and resolve them before planning._

_All open questions for v1 resolved across rounds 1–3. The spec is now locked for v1; further details belong in `02-plan.md`._

_Reopen this section if a question surfaces during planning or implementation that the spec genuinely doesn't answer._
