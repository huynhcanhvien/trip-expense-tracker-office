"use client";

import { useRef } from "react";
import NewTripForm from "./new/NewTripForm";

export const NEW_TRIP_DIALOG_ID = "new-trip-dialog";

// The single New-trip dialog for the dashboard. Rendered once; opened by
// NewTripButton (which may appear in the header or the empty state).
export default function NewTripModal() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <dialog
      id={NEW_TRIP_DIALOG_ID}
      ref={ref}
      className="modal"
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="modal-head">
        <h2>New trip</h2>
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      <NewTripForm />
    </dialog>
  );
}
