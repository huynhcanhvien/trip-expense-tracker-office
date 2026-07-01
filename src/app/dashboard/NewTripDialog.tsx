"use client";

import { useRef } from "react";
import NewTripForm from "./new/NewTripForm";

// "New trip" opens a modal dialog (like the legacy version) instead of a page.
export default function NewTripDialog({ label = "New trip" }: { label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()}>
        {label}
      </button>

      <dialog
        ref={ref}
        className="modal"
        onClick={(e) => {
          // Close when the backdrop (the dialog element itself) is clicked.
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
    </>
  );
}
