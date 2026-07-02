import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Big from "big.js";
import { auth } from "@/lib/auth";
import {
  getTripForUser,
  getInvitationToken,
  listTripMembers,
  formatTripDates,
} from "@/lib/trips";
import { CURRENCY_META, formatAmount, formatSignedBalance, decimalPlaces } from "@/lib/currency";
import { getTripExpenses } from "@/lib/expenses";
import { computeBalances } from "@/lib/balance";
import { baseUrl } from "@/lib/urls";
import Header from "@/app/components/Header";
import Avatar from "@/app/components/Avatar";
import ShareButton from "./ShareButton";
import AddGhostForm from "./AddGhostForm";
import ExpenseForm from "./ExpenseForm";
import DeleteExpenseButton from "./DeleteExpenseButton";
import AddFromPhoto from "./AddFromPhoto";
import CloseTripButton from "./CloseTripButton";

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

  const cur = trip.currency;
  const open = trip.status === "open";
  const isCreator = trip.creator_user_id === currentUserId;
  const dateRange = formatTripDates(trip);
  const inviteUrl = token ? `${baseUrl()}/invite/${token}` : null;
  const memberName = new Map(members.map((m) => [m.id, m.displayName]));
  const memberUserId = new Map(members.map((m) => [m.id, m.userId]));
  const today = new Date().toISOString().slice(0, 10);

  const totalSpent = expenses.reduce((sum, e) => sum.plus(new Big(e.amount)), new Big(0));

  // R5: payer (if registered) or trip creator may edit/delete.
  const canModify = (payerMemberId: number) =>
    isCreator || memberUserId.get(payerMemberId) === currentUserId;

  // Net balance per member (R3), computed on demand from raw expenses.
  const net = computeBalances(
    expenses.map((e) => ({
      payerMemberId: e.payerMemberId,
      amount: new Big(e.amount),
      includedMemberIds: e.includedMemberIds,
    })),
    members.map((m) => m.id),
    decimalPlaces(cur),
  );
  const balances = members
    .map((m) => ({ ...m, net: net.get(m.id) ?? new Big(0) }))
    .sort((a, b) => b.net.cmp(a.net));
  const unsettledCount = balances.filter((b) => !b.net.eq(0)).length;

  const memberOptions = members.map((m) => ({ id: m.id, displayName: m.displayName }));

  function MemberTags({ userId, isGhost }: { userId: number | null; isGhost: boolean }) {
    return (
      <>
        {userId === trip!.creator_user_id && <span className="tag">creator</span>}
        {userId === currentUserId && <span className="tag">you</span>}
        {isGhost && <span className="tag">guest</span>}
      </>
    );
  }

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <Link href="/dashboard" className="back-link">
          ← All trips
        </Link>

        {/* Header */}
        <div className="card trip-header">
          <div className="trip-header-main">
            <h1>{trip.name}</h1>
            <p className="muted">
              {cur} · {CURRENCY_META[cur].label}
              {dateRange ? ` · ${dateRange}` : ""}
              {!open && " · archived"}
            </p>
          </div>
          <div className="trip-total">
            <span className="muted">Total spent</span>
            <strong>{formatAmount(totalSpent, cur)}</strong>
          </div>
        </div>

        {/* Balances */}
        <div className="card">
          <div className="section-title">💖 Balances</div>
          {expenses.length === 0 ? (
            <p className="muted">No balances yet — add an expense.</p>
          ) : (
            <div className="balance-list">
              {balances.map((b) => (
                <div className="balance-row" key={b.id}>
                  <Avatar name={b.displayName} size="sm" />
                  <span className="grow">
                    {b.displayName}
                    <MemberTags userId={b.userId} isGhost={b.isGhost} />
                  </span>
                  {b.net.eq(0) ? (
                    <span className="muted">settled ✨</span>
                  ) : (
                    <span className={b.net.gt(0) ? "pos" : "neg"}>
                      {formatSignedBalance(b.net, cur)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="card">
          <div className="section-title">👯 Members ({members.length})</div>
          <div className="member-chips">
            {members.map((m) => (
              <div className="member-chip" key={m.id}>
                <Avatar name={m.displayName} size="sm" />
                <span>{m.displayName}</span>
                <MemberTags userId={m.userId} isGhost={m.isGhost} />
              </div>
            ))}
          </div>
          {open && <AddGhostForm tripId={trip.id} />}
        </div>

        {/* Invite */}
        {open && inviteUrl && (
          <div className="card">
            <div className="section-title">🔗 Invite</div>
            <p className="muted">Anyone with this link can join the trip.</p>
            <ShareButton url={inviteUrl} />
          </div>
        )}

        {/* Expenses */}
        <div className="card">
          <div className="section-title">🧾 Expenses ({expenses.length})</div>
          {expenses.length === 0 ? (
            <div className="empty">
              <span className="big">🌸</span>
              No expenses yet — add the first one!
            </div>
          ) : (
            <div className="expense-list">
              {expenses.map((e) => {
                const payer = memberName.get(e.payerMemberId) ?? "—";
                return (
                  <div className="expense" key={e.id}>
                    <Avatar name={payer} />
                    <div className="grow">
                      <div className="desc">{e.description}</div>
                      <div className="sub">
                        {payer} paid · {e.expenseDate} · split {e.includedMemberIds.length}-way
                      </div>
                    </div>
                    {e.photoPath && (
                      <a href={e.photoPath} target="_blank" rel="noreferrer" title="View receipt">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="thumb" src={e.photoPath} alt="receipt" />
                      </a>
                    )}
                    <div className="amt">{formatAmount(new Big(e.amount), cur)}</div>
                    {open && canModify(e.payerMemberId) && (
                      <div className="expense-ops">
                        <Link
                          className="icon-btn"
                          href={`/trips/${trip.id}/expenses/${e.id}/edit`}
                          title="Edit expense"
                        >
                          ✏️
                        </Link>
                        <DeleteExpenseButton expenseId={e.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {open && (
            <>
              <ExpenseForm tripId={trip.id} members={memberOptions} today={today} />
              <details className="photo-details">
                <summary>Add from a receipt photo</summary>
                <AddFromPhoto tripId={trip.id} members={memberOptions} today={today} />
              </details>
            </>
          )}
        </div>

        {/* Close trip */}
        {open && isCreator && (
          <div className="card danger-zone">
            <div className="section-title">🗄️ Close trip</div>
            <p className="muted">
              Archives the trip (read-only) and deletes its receipt photos. Permanent — a closed
              trip can&apos;t be reopened.
            </p>
            <CloseTripButton tripId={trip.id} unsettledCount={unsettledCount} />
          </div>
        )}
      </main>
    </>
  );
}
