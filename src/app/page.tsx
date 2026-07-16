import NewTripDialog from "./NewTripDialog";
import RecentTrips from "./RecentTrips";

// Home / welcome page — no accounts. A cute hero + "Create a trip", followed by
// the trips this browser has visited (remembered in localStorage).
export default function Home() {
  return (
    <>
      <main className="page page-wide">
        <section className="hero">
          <span className="hero-eyebrow">Trip Splitter</span>
          <h1>Split trip expenses</h1>
          <p className="muted">
            Create a trip, share the link with friends, and let everyone add what they paid. No
            sign-up, no fuss — we&apos;ll tally who owes whom.
          </p>
          <NewTripDialog label="Create a trip" />
        </section>

        <RecentTrips />
      </main>
    </>
  );
}
