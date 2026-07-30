"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/app/components/Avatar";
import { useRecentTripIds, forgetTrip } from "@/lib/recent-trips";
import { fetchTripSummariesAction } from "@/app/trips/actions";

interface Summary {
  public_id: string;
  name: string;
  currency: string;
  status: "open" | "closed";
  memberCount: number;
}

// The home page's "recent trips" list. The set of trips lives in this browser's
// localStorage; we fetch fresh names/counts from the server for the ones that
// still exist (a deleted/unknown trip simply drops off). `trips === null` means
// "not resolved yet" — we render nothing until we have some to show.
export default function RecentTrips() {
  const recentIds = useRecentTripIds();
  const [trips, setTrips] = useState<Summary[] | null>(null);

  useEffect(() => {
    if (recentIds.length === 0) return;
    let active = true;
    fetchTripSummariesAction(recentIds)
      .then((summaries) => {
        if (active) setTrips(summaries);
      })
      .catch(() => {
        if (active) setTrips([]);
      });
    return () => {
      active = false;
    };
  }, [recentIds]);

  // Nothing in this browser, still loading, or all trips gone → render nothing,
  // so the home page shows only the hero.
  if (recentIds.length === 0 || !trips || trips.length === 0) return null;

  const active = trips.filter((t) => t.status === "open");
  const archived = trips.filter((t) => t.status === "closed");

  return (
    <>
      <div className="page-head">
        <h2>🧳 Your trips</h2>
      </div>
      {active.length > 0 && <TripSection title="🌴 Active" trips={active} />}
      {archived.length > 0 && <TripSection title="🗄️ Archived" trips={archived} />}
    </>
  );
}

function TripSection({ title, trips }: { title: string; trips: Summary[] }) {
  return (
    <section className="trip-section">
      <h2>{title}</h2>
      <ul className="trip-list">
        {trips.map((t) => (
          <li key={t.public_id}>
            <Link href={`/trips/${t.public_id}`} className="trip-card">
              <div className="trip-card-top">
                <Avatar name={t.name} />
                <span className="trip-card-name">{t.name}</span>
                {t.status === "closed" && <span className="trip-badge">archived</span>}
              </div>
              <div className="trip-card-meta">
                <span>💱 {t.currency}</span>
                <span>
                  👥 {t.memberCount} {t.memberCount === 1 ? "person" : "people"}
                </span>
              </div>
            </Link>
            <button
              type="button"
              className="trip-forget"
              title="Remove from this list"
              aria-label={`Remove ${t.name} from recent`}
              onClick={() => {
                forgetTrip(t.public_id);
                setTimeout(() => window.location.reload(), 0);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
