import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getTripForUser,
  getInvitationToken,
  listTripMembers,
  formatTripDates,
} from "@/lib/trips";
import Big from "big.js";
import { CURRENCY_META, formatAmount, formatSignedBalance } from "@/lib/currency";
import { decimalPlaces } from "@/lib/currency";
import { getTripExpenses } from "@/lib/expenses";
import { computeBalances } from "@/lib/balance";
import { baseUrl } from "@/lib/urls";
import Header from "@/app/components/Header";
import ShareButton from "./ShareButton";
import AddGhostForm from "./AddGhostForm";
import AddExpenseForm from "./AddExpenseForm";

// Trip detail page (T10): metadata + member list + share invite link.
// Expenses + balances arrive in T13–T14; ghost adding in T12.
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentUserId = Number(session.user.id);
  const trip = await getTripForUser(Number(id), currentUserId);
  if (!trip) notFound();

  const [members, token, expenses] = await Promise.all([
    listTripMembers(trip.id),
    getInvitationToken(trip.id),
    getTripExpenses(trip.id),
  ]);
  const dateRange = formatTripDates(trip);
  const inviteUrl = token ? `${baseUrl()}/invite/${token}` : null;
  const memberName = new Map(members.map((m) => [m.id, m.displayName]));
  const today = new Date().toISOString().slice(0, 10);

  // Net balance per member (R3), computed on demand from raw expenses.
  const net = computeBalances(
    expenses.map((e) => ({
      payerMemberId: e.payerMemberId,
      amount: new Big(e.amount),
      includedMemberIds: e.includedMemberIds,
    })),
    members.map((m) => m.id),
    decimalPlaces(trip.currency),
  );
  const balances = members
    .map((m) => ({ ...m, net: net.get(m.id) ?? new Big(0) }))
    .sort((a, b) => b.net.cmp(a.net));

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
          <h2>Balances</h2>
          {expenses.length === 0 ? (
            <p className="muted">No balances yet — add an expense.</p>
          ) : (
            <ul className="balance-list">
              {balances.map((b) => {
                const sign = b.net.gt(0) ? "pos" : b.net.lt(0) ? "neg" : "zero";
                return (
                  <li key={b.id} className="balance-row">
                    <span>
                      {b.displayName}
                      {b.isGhost && <span className="tag">guest</span>}
                    </span>
                    <span className={`balance-amount ${sign}`}>
                      {formatSignedBalance(b.net, trip.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

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
          <h2>Expenses ({expenses.length})</h2>
          {expenses.length === 0 ? (
            <p className="muted">No expenses yet.</p>
          ) : (
            <ul className="expense-list">
              {expenses.map((e) => (
                <li key={e.id} className="expense-row">
                  <div className="expense-main">
                    <span className="expense-desc">{e.description}</span>
                    <span className="expense-amount">
                      {formatAmount(new Big(e.amount), trip.currency)}
                    </span>
                  </div>
                  <span className="expense-meta">
                    {e.expenseDate} · paid by {memberName.get(e.payerMemberId) ?? "—"} · split{" "}
                    {e.includedMemberIds.length}-way
                  </span>
                </li>
              ))}
            </ul>
          )}
          {trip.status === "open" && (
            <AddExpenseForm
              tripId={trip.id}
              members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
              today={today}
            />
          )}
        </section>
      </main>
    </>
  );
}
