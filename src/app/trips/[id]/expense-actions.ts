"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createExpense, ExpenseError } from "@/lib/expenses";

export interface ExpenseFormState {
  error?: string;
  ok?: boolean;
}

/** Add an expense to a trip (R2, scenarios A & G). */
export async function addExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tripId = Number(formData.get("tripId"));
  const includedMemberIds = formData.getAll("included").map((v) => Number(v));

  try {
    await createExpense(
      {
        tripId,
        description: String(formData.get("description") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        expenseDate: String(formData.get("expenseDate") ?? ""),
        payerMemberId: Number(formData.get("payerMemberId")),
        includedMemberIds,
      },
      Number(session.user.id),
    );
  } catch (err) {
    if (err instanceof ExpenseError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
