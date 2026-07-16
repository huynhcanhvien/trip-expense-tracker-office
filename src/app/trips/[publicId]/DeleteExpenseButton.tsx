"use client";

import ConfirmSubmitForm from "@/app/components/ConfirmSubmitForm";
import { deleteExpenseAction } from "./expense-actions";

export default function DeleteExpenseButton({
  publicId,
  expenseId,
}: {
  publicId: string;
  expenseId: number;
}) {
  return (
    <ConfirmSubmitForm
      action={deleteExpenseAction}
      message="Delete this expense? This can't be undone."
      fields={{ publicId, expenseId }}
      buttonClassName="icon-btn"
      title="Delete expense"
      ariaLabel="Delete expense"
    >
      🗑️
    </ConfirmSubmitForm>
  );
}
