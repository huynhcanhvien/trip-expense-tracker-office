"use client";

import { closeTripAction } from "@/app/trips/actions";

export default function CloseTripButton({
  tripId,
  unsettledCount,
}: {
  tripId: number;
  unsettledCount: number;
}) {
  const message =
    unsettledCount > 0
      ? `${unsettledCount} member${unsettledCount === 1 ? "" : "s"} still ` +
        `${unsettledCount === 1 ? "has" : "have"} an unsettled balance. ` +
        `Close anyway? This is permanent — a closed trip can't be reopened, and receipt photos are deleted.`
      : "Close this trip? This is permanent — it can't be reopened, and receipt photos are deleted.";

  return (
    <form
      action={closeTripAction}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="tripId" value={tripId} />
      <button type="submit" className="link-danger">
        Close trip
      </button>
    </form>
  );
}
