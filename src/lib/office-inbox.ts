import {
  officeContext,
  collectRows,
  profilesFor,
  settleOverduePayments,
} from "./office-data";
import type { Share } from "./office-types";

export type InboxItem = {
  /** Unique per row: one expense can have several reported shares. */
  key: string;
  expenseId: string;
  description: string;
  expenseDate: string;
  groupName: string;
  currency: string;
  amount: string;
  /** Share status for "to pay"; the expense status for approvals. */
  status: string;
  counterpartName: string;
};
type ExpenseRow = {
  id: string;
  description: string;
  expense_date: string;
  status: string;
  amount: string | number;
  payer_id: string;
  creator_id: string;
  group: { name: string; currency: string } | null;
};
type PayableRow = Pick<Share, "amount" | "payment_status" | "user_id"> & {
  expense: ExpenseRow | null;
};
// Embeds are many-to-one, so rows carry objects rather than the inferred arrays.
const EXPENSE_COLUMNS =
  "id,description,expense_date,status,amount,payer_id,creator_id,group:office_groups(name,currency)";
const SHARE_COLUMNS = `amount,payment_status,user_id,expense:office_expenses!inner(${EXPENSE_COLUMNS})`;

/** Shares the viewer still owes (or has reported) on approved, open expenses. */
export async function payablesData(): Promise<InboxItem[]> {
  const [{ supabase, user }] = await Promise.all([
    officeContext("/notifications"),
    settleOverduePayments(),
  ]);
  const rows = await collectRows<PayableRow>((a, b) =>
    supabase
      .from("office_shares")
      .select(SHARE_COLUMNS)
      .eq("user_id", user.id)
      .in("payment_status", ["pending", "reported"])
      .gt("amount", 0)
      .eq("expense.status", "active")
      .order("expense_id")
      .range(a, b)
      .overrideTypes<PayableRow[], { merge: false }>(),
  );
  const owed = rows.filter((r) => r.expense);
  const names = await profilesFor(owed.map((r) => r.expense!.payer_id));
  return owed
    .map(({ amount, payment_status, expense }) => ({
      key: expense!.id,
      expenseId: expense!.id,
      description: expense!.description,
      expenseDate: expense!.expense_date,
      groupName: expense!.group?.name || "",
      currency: expense!.group?.currency || "VND",
      amount: String(amount),
      status: payment_status,
      counterpartName: names.get(expense!.payer_id)?.name || "",
    }))
    .sort((x, y) => y.expenseDate.localeCompare(x.expenseDate));
}

/** Expenses recorded by others that name the viewer as payer and await their decision. */
export async function approvalsData(): Promise<InboxItem[]> {
  const { supabase, user } = await officeContext("/notifications");
  const rows = await collectRows<ExpenseRow>((a, b) =>
    supabase
      .from("office_expenses")
      .select(EXPENSE_COLUMNS)
      .eq("payer_id", user.id)
      .eq("status", "awaiting_payer")
      .order("expense_date", { ascending: false })
      .order("id")
      .range(a, b)
      .overrideTypes<ExpenseRow[], { merge: false }>(),
  );
  const names = await profilesFor(rows.map((r) => r.creator_id));
  return rows.map((e) => ({
    key: e.id,
    expenseId: e.id,
    description: e.description,
    expenseDate: e.expense_date,
    groupName: e.group?.name || "",
    currency: e.group?.currency || "VND",
    amount: String(e.amount),
    status: e.status,
    counterpartName: names.get(e.creator_id)?.name || "",
  }));
}

/** Transfers members reported on expenses the viewer paid, awaiting the viewer's confirmation. */
export async function confirmationsData(): Promise<InboxItem[]> {
  const [{ supabase, user }] = await Promise.all([
    officeContext("/notifications"),
    settleOverduePayments(),
  ]);
  const rows = await collectRows<PayableRow>((a, b) =>
    supabase
      .from("office_shares")
      .select(SHARE_COLUMNS)
      .eq("payment_status", "reported")
      .eq("expense.payer_id", user.id)
      .eq("expense.status", "active")
      .order("expense_id")
      .order("user_id")
      .range(a, b)
      .overrideTypes<PayableRow[], { merge: false }>(),
  );
  const reported = rows.filter((r) => r.expense);
  const names = await profilesFor(reported.map((r) => r.user_id));
  return reported
    .map(({ amount, payment_status, user_id, expense }) => ({
      key: `${expense!.id}:${user_id}`,
      expenseId: expense!.id,
      description: expense!.description,
      expenseDate: expense!.expense_date,
      groupName: expense!.group?.name || "",
      currency: expense!.group?.currency || "VND",
      amount: String(amount),
      status: payment_status,
      counterpartName: names.get(user_id)?.name || "",
    }))
    .sort((x, y) => y.expenseDate.localeCompare(x.expenseDate));
}
