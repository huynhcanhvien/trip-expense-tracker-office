"use client";

import { ADD_EXPENSE_DIALOG_ID } from "./AddExpenseModal";

// Opens the single shared Add-expense dialog (AddExpenseModal).
export default function AddExpenseButton({
  label = "New expense",
  className = "btn-sm",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const dialog = document.getElementById(ADD_EXPENSE_DIALOG_ID) as HTMLDialogElement | null;
        dialog?.showModal();
      }}
    >
      {label}
    </button>
  );
}
