"use client";

import { useActionState, useEffect, useRef } from "react";
import { addGhostAction, type TripFormState } from "@/app/trips/actions";

const initial: TripFormState = {};

export default function AddGhostForm({ tripId }: { tripId: number }) {
  const [state, action, pending] = useActionState(addGhostAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field after a successful add (the list re-renders via revalidatePath).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="ghost-form">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="text" name="name" required maxLength={80} placeholder="Guest name" />
      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add guest"}
      </button>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
