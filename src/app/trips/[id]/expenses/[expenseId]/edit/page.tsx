import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTripForUser, listTripMembers } from "@/lib/trips";
import { getTripExpenses } from "@/lib/expenses";
import Header from "@/app/components/Header";
import ExpenseForm from "../../../ExpenseForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentUserId = Number(session.user.id);
  const trip = await getTripForUser(Number(id), currentUserId);
  if (!trip) notFound();
  if (trip.status === "closed") redirect(`/trips/${trip.id}`); // archived = read-only

  const [members, expenses] = await Promise.all([
    listTripMembers(trip.id),
    getTripExpenses(trip.id),
  ]);
  const expense = expenses.find((e) => e.id === Number(expenseId));
  if (!expense) notFound();

  // R5 authz: payer (if registered) or trip creator.
  const payer = members.find((m) => m.id === expense.payerMemberId);
  const canModify = trip.creator_user_id === currentUserId || payer?.userId === currentUserId;
  if (!canModify) redirect(`/trips/${trip.id}`);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <h1>Edit expense</h1>
        <ExpenseForm
          tripId={trip.id}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          today={today}
          editing={{
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            expenseDate: expense.expenseDate,
            payerMemberId: expense.payerMemberId,
            includedMemberIds: expense.includedMemberIds,
          }}
        />
        <p className="auth-links">
          <Link href={`/trips/${trip.id}`}>Cancel</Link>
        </p>
      </main>
    </>
  );
}
