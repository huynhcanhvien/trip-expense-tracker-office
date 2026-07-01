"use client";

import { NEW_TRIP_DIALOG_ID } from "./NewTripModal";

// Opens the single shared New-trip dialog (NewTripModal).
export default function NewTripButton({ label = "New trip" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const dialog = document.getElementById(NEW_TRIP_DIALOG_ID) as HTMLDialogElement | null;
        dialog?.showModal();
      }}
    >
      {label}
    </button>
  );
}
