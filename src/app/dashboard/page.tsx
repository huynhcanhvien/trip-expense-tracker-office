import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Header from "@/app/components/Header";
import { listTripsForUser, formatTripDates, type TripListItem } from "@/lib/trips";
import { CURRENCY_META } from "@/lib/currency";
import NewTripModal from "./NewTripModal";
import NewTripButton from "./NewTripButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const trips = await listTripsForUser(Number(session.user.id));
  const active = trips.filter((t) => t.status === "open");
  const archived = trips.filter((t) => t.status === "closed");

  return (
    <>
      <Header email={session.user.email} />
      <main className="page">
        <div className="page-head">
          <h1>Your trips</h1>
          {/* One trigger visible at a time; both open the single shared dialog below. */}
          {trips.length > 0 && <NewTripButton />}
        </div>

        {trips.length === 0 ? (
          <div className="empty-state">
            <p className="muted">You don&apos;t have any trips yet.</p>
            <NewTripButton label="Create new trip" />
          </div>
        ) : (
          <>
            <TripSection title="Active" trips={active} emptyLabel="No active trips." />
            {archived.length > 0 && <TripSection title="Archived" trips={archived} />}
          </>
        )}
      </main>

      {/* Single shared New-trip dialog, opened by any NewTripButton above. */}
      <NewTripModal />
    </>
  );
}

function TripSection({
  title,
  trips,
  emptyLabel,
}: {
  title: string;
  trips: TripListItem[];
  emptyLabel?: string;
}) {
  return (
    <section className="trip-section">
      <h2>{title}</h2>
      {trips.length === 0 ? (
        emptyLabel ? <p className="muted">{emptyLabel}</p> : null
      ) : (
        <ul className="trip-list">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`} className="trip-card">
                <span className="trip-card-name">{t.name}</span>
                <span className="trip-card-meta">
                  {t.currency} · {CURRENCY_META[t.currency].label} ·{" "}
                  {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                </span>
                {formatTripDates(t) && (
                  <span className="trip-card-meta">{formatTripDates(t)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
