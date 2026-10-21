export type Group = {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  invite_token: string;
  created_at: string;
};
export type Profile = { id: string; name: string };
export type Member = {
  group_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
};
export type JoinRequest = {
  id: string;
  group_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  profile?: Profile;
};
export type ExpenseStatus =
  "awaiting_payer" | "active" | "completed" | "rejected" | "cancelled";
/** Expenses the payer has not accepted never count toward balances. */
export const isUnapproved = (status: ExpenseStatus) =>
  status === "awaiting_payer" || status === "rejected";
export const CATEGORIES = [
  "food",
  "transport",
  "office",
  "entertainment",
  "utilities",
  "gift",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type SplitMode = "even" | "custom" | "weight";
export type Expense = {
  id: string;
  group_id: string;
  creator_id: string;
  payer_id: string;
  description: string;
  amount: string;
  expense_date: string;
  status: ExpenseStatus;
  receipt_upload_id: string | null;
  cancel_reason: string | null;
  reject_reason: string | null;
  approved_at: string | null;
  revision: number;
  category: Category;
  has_reported: boolean;
  created_at: string;
};
export type Share = {
  expense_id: string;
  user_id: string;
  amount: string;
  payment_status: "pending" | "reported" | "confirmed" | "self";
  weight?: number | null;
  last_reminded_at?: string | null;
};
export type ExpenseChange = {
  id: string;
  expense_id: string;
  actor_id: string | null;
  action:
    | "create"
    | "edit"
    | "metadata"
    | "approve"
    | "reject"
    | "cancel"
    | "recurring";
  changes: Record<string, unknown>;
  created_at: string;
};
export type RecurringExpense = {
  id: string;
  group_id: string;
  creator_id: string;
  description: string;
  amount: string;
  category: Category;
  split_mode: SplitMode;
  shares: { userId: string; amount?: string; weight?: number }[];
  cadence: "weekly" | "monthly";
  start_date: string;
  next_date: string;
  active: boolean;
  last_error: string | null;
};
export type InboxCounts = { unread: number; toPay: number; approvals: number };
export type BankAccount = {
  user_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  transfer_template: string;
  qr_upload_id: string | null;
  bank_bin: string | null;
};
export type OfficeState = { error?: string; success?: string };
