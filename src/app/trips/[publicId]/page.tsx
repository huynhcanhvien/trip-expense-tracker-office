import { notFound } from "next/navigation";
import Link from "next/link";
import Big from "big.js";
import { getTripByPublicId, listTripMembers } from "@/lib/trips";
import { CURRENCY_META, formatAmount, formatSignedBalance, decimalPlaces } from "@/lib/currency";
import { getTripExpenses } from "@/lib/expenses";
import { computeBalances } from "@/lib/balance";
import { baseUrl } from "@/lib/urls";
import Avatar from "@/app/components/Avatar";
import ShareButton from "./ShareButton";
import PeoplePanel from "./PeoplePanel";
import DeleteExpenseButton from "./DeleteExpenseButton";
import AddExpenseModal from "./AddExpenseModal";
import AddExpenseButton from "./AddExpenseButton";
import CloseTripButton from "./CloseTripButton";

export default async function TripPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const trip = await getTripByPublicId(publicId);
  if (!trip) notFound();

  const [members, expenses] = await Promise.all([
    listTripMembers(trip.id),
    getTripExpenses(trip.id),
  ]);

  const cur = trip.currency;
  const open = trip.status === "open";
  const shareUrl = `${baseUrl()}/trips/${trip.public_id}`;
  const memberName = new Map(members.map((m) => [m.id, m.displayName]));
  const today = new Date().toISOString().slice(0, 10);

  const totalSpent = expenses.reduce((sum, e) => sum.plus(new Big(e.amount)), new Big(0));

  // Net balance per member (R3), computed on demand from raw expenses.
  const net = computeBalances(
    expenses.map((e) => ({
      payerMemberId: e.payerMemberId,
      amount: new Big(e.amount),
      includedMemberIds: e.includedMemberIds,
      customShares: e.customShares
        ? new Map([...e.customShares].map(([id, amt]) => [id, new Big(amt)]))
        : undefined,
    })),
    members.map((m) => m.id),
    decimalPlaces(cur),
  );
  const balances = members
    .map((m) => ({ ...m, net: net.get(m.id) ?? new Big(0) }))
    .sort((a, b) => b.net.cmp(a.net));
  // Balances stays compact: show only who's not settled (or a one-line "all settled").
  const unsettled = balances.filter((b) => !b.net.eq(0));
  const unsettledCount = unsettled.length;

  const memberOptions = members.map((m) => ({ id: m.id, displayName: m.displayName }));

  return (
    <>
      <main className="page page-wide">
        <Link href="/" className="back-link">
          ← Trips
        </Link>

        {/* Header */}
        <div className="card trip-header">
          <div className="trip-header-main">
            <h1>{trip.name}</h1>
            <p className="muted">
              {CURRENCY_META[cur].flag} {cur}
              {!open && " · archived"}
            </p>
          </div>
          <div className="trip-total">
            <span className="muted">Total spent</span>
            <strong>{formatAmount(totalSpent, cur)}</strong>
          </div>
        </div>

        {/* Even 2×2 grid on md+: Expenses | Balances / People | Share.
            Header and Close sit outside the grid and stay full-width. */}
        <div className="trip-grid">
          {/* Expenses — the primary content + main action (full width when empty) */}
          <div className={expenses.length === 0 ? "card span-2" : "card"}>
            <div className="card-head">
              <div className="section-title">🧾 Expenses ({expenses.length})</div>
              {open && expenses.length > 0 && <AddExpenseButton />}
            </div>

            {expenses.length === 0 ? (
              <div className="empty">
                <span className="big">🌸</span>
                No expenses yet — add the first one! 🌈
                {open && members.length > 0 && (
                  <div className="empty-cta">
                    <AddExpenseButton className="" />
                  </div>
                )}
                {open && members.length === 0 && (
                  <p className="muted">Add a person first, then record expenses.</p>
                )}
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
                          {payer} paid · {e.expenseDate} ·{" "}
                          {e.customShares
                            ? `custom split · ${e.includedMemberIds.length} ${
                                e.includedMemberIds.length === 1 ? "person" : "people"
                              }`
                            : `split ${e.includedMemberIds.length}-way`}
                        </div>
                      </div>
                      {e.photoPath && (
                        <a href={e.photoPath} target="_blank" rel="noreferrer" title="View receipt">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="thumb" src={e.photoPath} alt="receipt" />
                        </a>
                      )}
                      <div className="amt">{formatAmount(new Big(e.amount), cur)}</div>
                      {open && (
                        <div className="expense-ops">
                          <Link
                            className="icon-btn"
                            href={`/trips/${trip.public_id}/expenses/${e.id}/edit`}
                            title="Edit expense"
                          >
                            ✏️
                          </Link>
                          <DeleteExpenseButton publicId={trip.public_id} expenseId={e.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Balances — compact: a one-line summary when settled, else only the
              members who still owe / are owed. */}
          {expenses.length > 0 && (
            <div className="card balances-card">
              <div className="section-title">💖 Balances</div>
              {unsettled.length === 0 ? (
                <p className="all-settled">Everyone&apos;s settled up ✨</p>
              ) : (
                <div className="balance-list">
                  {unsettled.map((b) => (
                    <div className="balance-row" key={b.id}>
                      <Avatar name={b.displayName} size="sm" />
                      <span className="grow">{b.displayName}</span>
                      <span className={b.net.gt(0) ? "pos" : "neg"}>
                        {formatSignedBalance(b.net, cur)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* People + Share — one full-width card, split by a vertical divider:
              the roster on the left, the shareable link on the right. */}
          <div className={open ? "card people-invite span-2" : "card people-invite people-only span-2"}>
            <div className="pi-people">
              <PeoplePanel
                publicId={trip.public_id}
                name={trip.name}
                currency={cur}
                members={memberOptions}
                open={open}
              />
            </div>

            {open && (
              <div className="pi-invite">
                <div className="section-title">🔗 Share this trip</div>
                <p className="muted">Anyone with the link can view and add expenses — no sign-up.</p>
                <ShareButton url={shareUrl} />
              </div>
            )}
          </div>
        </div>

        {/* Close trip */}
        {open && (
          <div className="card danger-zone">
            <div className="section-title">🗄️ Close trip</div>
            <p className="muted">
              Archives the trip (read-only) and deletes its receipt photos. Permanent — a closed
              trip can&apos;t be reopened.
            </p>
            <CloseTripButton publicId={trip.public_id} unsettledCount={unsettledCount} />
          </div>
        )}

        {/* Single shared Add-expense dialog, opened by the buttons above. */}
        {open && members.length > 0 && (
          <AddExpenseModal
            publicId={trip.public_id}
            members={memberOptions}
            currency={cur}
            today={today}
          />
        )}
      </main>
    </>
  );
}
