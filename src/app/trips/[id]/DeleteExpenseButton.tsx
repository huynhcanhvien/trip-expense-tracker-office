"use client";

import { deleteExpenseAction } from "./expense-actions";

export default function DeleteExpenseButton({ expenseId }: { expenseId: number }) {
  return (
    <form
      action={deleteExpenseAction}
      onSubmit={(e) => {
        if (!confirm("Delete this expense? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="expenseId" value={expenseId} />
      <button type="submit" className="icon-btn" title="Delete expense" aria-label="Delete expense">
        🗑️
      </button>
    </form>
  );
}
