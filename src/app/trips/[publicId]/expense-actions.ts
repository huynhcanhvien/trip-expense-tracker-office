"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTripByPublicId } from "@/lib/trips";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  ExpenseError,
  type SplitMode,
  type ExpenseShareInput,
} from "@/lib/expenses";

export interface ExpenseFormState {
  error?: string;
  ok?: boolean;
}

/**
 * Read the split fields the ExpenseForm submits: `splitMode` plus either the
 * `included` checkboxes (even) or one `share_<memberId>` input per person
 * (custom). Kept in one place so add + edit parse them identically.
 */
function readSplit(formData: FormData): {
  splitMode: SplitMode;
  includedMemberIds: number[];
  customShares: ExpenseShareInput[];
} {
  const splitMode: SplitMode = formData.get("splitMode") === "custom" ? "custom" : "even";
  const includedMemberIds = formData.getAll("included").map((v) => Number(v));

  const customShares: ExpenseShareInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("share_")) continue;
    const memberId = Number(key.slice("share_".length));
    if (Number.isNaN(memberId)) continue;
    customShares.push({ memberId, amount: String(value).trim() });
  }

  return { splitMode, includedMemberIds, customShares };
}

/** Add an expense to a trip. Anyone with the link may do this while it's open. */
export async function addExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const publicId = String(formData.get("publicId") ?? "");
  const trip = await getTripByPublicId(publicId);
  if (!trip) return { error: "Trip not found" };

  const photoPath = String(formData.get("photoPath") ?? "").trim() || null;
  const { splitMode, includedMemberIds, customShares } = readSplit(formData);

  try {
    await createExpense({
      tripId: trip.id,
      description: String(formData.get("description") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      expenseDate: String(formData.get("expenseDate") ?? ""),
      payerMemberId: Number(formData.get("payerMemberId")),
      splitMode,
      includedMemberIds,
      customShares,
      photoPath,
    });
  } catch (err) {
    if (err instanceof ExpenseError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/trips/${publicId}`);
  return { ok: true };
}

/** Edit an expense. On success, returns to the trip page. */
export async function updateExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const publicId = String(formData.get("publicId") ?? "");
  const expenseId = Number(formData.get("expenseId"));
  const { splitMode, includedMemberIds, customShares } = readSplit(formData);

  try {
    await updateExpense(expenseId, {
      description: String(formData.get("description") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      expenseDate: String(formData.get("expenseDate") ?? ""),
      payerMemberId: Number(formData.get("payerMemberId")),
      splitMode,
      includedMemberIds,
      customShares,
    });
  } catch (err) {
    if (err instanceof ExpenseError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/trips/${publicId}`);
  redirect(`/trips/${publicId}`);
}

/** Delete an expense. Plain form action → redirects back to the trip. */
export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const publicId = String(formData.get("publicId") ?? "");
  const expenseId = Number(formData.get("expenseId"));

  await deleteExpense(expenseId);

  revalidatePath(`/trips/${publicId}`);
  redirect(`/trips/${publicId}`);
}
