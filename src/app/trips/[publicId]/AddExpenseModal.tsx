"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/app/components/Modal";
import ExpenseForm, { type MemberOption } from "./ExpenseForm";
import AddFromPhoto from "./AddFromPhoto";
import { getMe } from "@/lib/recent-trips";
import type { CurrencyCode } from "@/lib/currency";

export const ADD_EXPENSE_DIALOG_ID = "add-expense-dialog";

// The single Add-expense dialog for a trip. Rendered once; opened by
// AddExpenseButton (which may appear in the Expenses header or its empty state).
// Offers a manual form and a receipt-scan flow; closes itself on a successful add.
export default function AddExpenseModal({
  publicId,
  members,
  currency,
  today,
}: {
  publicId: string;
  members: MemberOption[];
  currency: CurrencyCode;
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [me, setMeState] = useState<number | null>(null);

  // "You" is browser-local; read it once the dialog mounts to default the payer.
  useEffect(() => setMeState(getMe(publicId)), [publicId]);

  const close = () => ref.current?.close();

  return (
    <Modal id={ADD_EXPENSE_DIALOG_ID} ref={ref} className="modal-wide" title="Add expense">
      <div className="seg" role="tablist">
        <button
          type="button"
          className={mode === "manual" ? "seg-btn active" : "seg-btn"}
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
        >
          ✍️ Manual
        </button>
        <button
          type="button"
          className={mode === "photo" ? "seg-btn active" : "seg-btn"}
          aria-pressed={mode === "photo"}
          onClick={() => setMode("photo")}
        >
          📷 Scan receipt
        </button>
      </div>

      {mode === "manual" ? (
        <ExpenseForm
          publicId={publicId}
          members={members}
          currency={currency}
          today={today}
          defaultPayerId={me}
          onSuccess={close}
        />
      ) : (
        <AddFromPhoto
          publicId={publicId}
          members={members}
          currency={currency}
          today={today}
          onSuccess={close}
        />
      )}
    </Modal>
  );
}
