import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getTripByInviteToken,
  isMember,
  listTripMembers,
  countExpenses,
  formatTripDates,
} from "@/lib/trips";
import { CURRENCY_META } from "@/lib/currency";
import { acceptInviteAction } from "@/app/trips/actions";

// Invitation preview + accept (scenario F, R1). Handles all four sub-cases:
//  - invalid/closed token → friendly error
//  - logged-out → prompt login (which routes back here after auth)
//  - already a member → straight to the trip (no double-add)
//  - logged-in non-member → preview + explicit Accept
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const trip = await getTripByInviteToken(token);
  if (!trip) return <InviteError title="Invalid invitation" message="This invite link isn't valid." />;
  if (trip.status === "closed") {
    return (
      <InviteError title="Trip closed" message="This trip has been archived and can't be joined." />
    );
  }

  const session = await auth();
  if (!session?.user) {
    // Logged-out (verified account) or brand-new: send to login, which returns here.
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const userId = Number(session.user.id);
  if (await isMember(trip.id, userId)) {
    redirect(`/trips/${trip.id}`);
  }

  const [members, expenseCount] = await Promise.all([
    listTripMembers(trip.id),
    countExpenses(trip.id),
  ]);
  const dateRange = formatTripDates(trip);

  return (
    <main className="auth-page">
      <h1>Join “{trip.name}”</h1>
      <p className="muted">
        {trip.currency} — {CURRENCY_META[trip.currency].label}
        {dateRange ? ` · ${dateRange}` : ""}
      </p>

      <section className="trip-section">
        <h2>Members ({members.length})</h2>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id}>
              {m.displayName}
              {m.isGhost && <span className="tag">guest</span>}
            </li>
          ))}
        </ul>
      </section>

      <p className="muted">
        {expenseCount} {expenseCount === 1 ? "expense" : "expenses"} recorded.
      </p>

      <form action={acceptInviteAction}>
        <input type="hidden" name="token" value={token} />
        <button type="submit">Accept invitation</button>
      </form>
      <p className="auth-links">
        <Link href="/dashboard">Not now</Link>
      </p>
    </main>
  );
}

function InviteError({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-page">
      <h1>{title}</h1>
      <p className="form-error">{message}</p>
      <p className="auth-links">
        <Link href="/dashboard">Go to your trips</Link>
      </p>
    </main>
  );
}
