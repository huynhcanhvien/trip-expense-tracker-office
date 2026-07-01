"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createExpense, updateExpense, deleteExpense, ExpenseError } from "@/lib/expenses";

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

  const photoPath = String(formData.get("photoPath") ?? "").trim() || null;

  try {
    await createExpense(
      {
        tripId,
        description: String(formData.get("description") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        expenseDate: String(formData.get("expenseDate") ?? ""),
        payerMemberId: Number(formData.get("payerMemberId")),
        includedMemberIds,
        photoPath,
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

/** Edit an expense (R5). On success, returns to the trip page. */
export async function updateExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const expenseId = Number(formData.get("expenseId"));
  const includedMemberIds = formData.getAll("included").map((v) => Number(v));

  let tripId: number;
  try {
    tripId = await updateExpense(
      expenseId,
      {
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
  redirect(`/trips/${tripId}`);
}

/** Delete an expense (R5). Plain form action → redirects back to the trip. */
export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const expenseId = Number(formData.get("expenseId"));
  const tripId = await deleteExpense(expenseId, Number(session.user.id));

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
