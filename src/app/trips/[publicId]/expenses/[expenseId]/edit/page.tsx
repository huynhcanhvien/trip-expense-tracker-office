import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTripByPublicId, listTripMembers } from "@/lib/trips";
import { getTripExpenses } from "@/lib/expenses";
import ExpenseForm from "../../../ExpenseForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ publicId: string; expenseId: string }>;
}) {
  const { publicId, expenseId } = await params;
  const trip = await getTripByPublicId(publicId);
  if (!trip) notFound();
  if (trip.status === "closed") redirect(`/trips/${trip.public_id}`); // archived = read-only

  const [members, expenses] = await Promise.all([
    listTripMembers(trip.id),
    getTripExpenses(trip.id),
  ]);
  const expense = expenses.find((e) => e.id === Number(expenseId));
  if (!expense) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <main className="page">
        <h1>Edit expense</h1>
        <ExpenseForm
          publicId={trip.public_id}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          currency={trip.currency}
          today={today}
          editing={{
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            expenseDate: expense.expenseDate,
            payerMemberId: expense.payerMemberId,
            includedMemberIds: expense.includedMemberIds,
            customShares: expense.customShares
              ? Object.fromEntries(expense.customShares)
              : null,
          }}
        />
        <p className="auth-links">
          <Link href={`/trips/${trip.public_id}`}>Cancel</Link>
        </p>
      </main>
    </>
  );
}
