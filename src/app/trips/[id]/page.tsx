import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTripForUser, formatTripDates } from "@/lib/trips";
import { CURRENCY_META } from "@/lib/currency";
import Header from "@/app/components/Header";

// Trip detail skeleton (T8). Members list + share + expenses arrive in T10–T14.
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const trip = await getTripForUser(Number(id), Number(session.user.id));
  if (!trip) notFound();

  const dateRange = formatTripDates(trip);

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
        <p className="muted">No expenses yet.</p>
      </main>
    </>
  );
}
