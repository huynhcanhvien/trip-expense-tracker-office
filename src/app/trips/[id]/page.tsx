import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getTripForUser,
  getInvitationToken,
  listTripMembers,
  formatTripDates,
} from "@/lib/trips";
import { CURRENCY_META } from "@/lib/currency";
import { baseUrl } from "@/lib/urls";
import Header from "@/app/components/Header";
import ShareButton from "./ShareButton";
import AddGhostForm from "./AddGhostForm";

// Trip detail page (T10): metadata + member list + share invite link.
// Expenses + balances arrive in T13–T14; ghost adding in T12.
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentUserId = Number(session.user.id);
  const trip = await getTripForUser(Number(id), currentUserId);
  if (!trip) notFound();

  const [members, token] = await Promise.all([
    listTripMembers(trip.id),
    getInvitationToken(trip.id),
  ]);
  const dateRange = formatTripDates(trip);
  const inviteUrl = token ? `${baseUrl()}/invite/${token}` : null;

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <h1>{trip.name}</h1>
        <p className="muted">
          {trip.currency} — {CURRENCY_META[trip.currency].label}
          {trip.status === "closed" && " · archived"}
        </p>
        {dateRange && <p className="muted">{dateRange}</p>}

        <section className="trip-section">
          <h2>Members ({members.length})</h2>
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id}>
                {m.displayName}
                {m.userId === trip.creator_user_id && <span className="tag">creator</span>}
                {m.userId === currentUserId && <span className="tag">you</span>}
                {m.isGhost && <span className="tag">guest</span>}
              </li>
            ))}
          </ul>
          {trip.status === "open" && <AddGhostForm tripId={trip.id} />}
        </section>

        {trip.status === "open" && inviteUrl && (
          <section className="trip-section">
            <h2>Invite</h2>
            <p className="muted">Anyone with this link can join the trip.</p>
            <ShareButton url={inviteUrl} />
          </section>
        )}

        <section className="trip-section">
          <h2>Expenses</h2>
          <p className="muted">No expenses yet.</p>
        </section>
      </main>
    </>
  );
}
