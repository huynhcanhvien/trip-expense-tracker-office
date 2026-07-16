"use client";

import { useRef } from "react";
import Modal from "./components/Modal";
import NewTripForm from "./NewTripForm";

// A "Create a trip" button plus the dialog it opens. Self-contained so the home
// page can drop it into the hero and/or an empty state.
export default function NewTripDialog({
  label = "Create a trip",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>

      <Modal ref={ref} title="New trip">
        <NewTripForm />
      </Modal>
    </>
  );
}
