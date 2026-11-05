import {
  officeContext,
  checked,
  collectRows,
  profilesFor,
  settleOverduePayments,
} from "./office-data";
import type {
  BankAccount,
  PaymentBatch,
  PaymentBatchItem,
} from "./office-types";
import { batchMemo } from "./payment-batch";
import { shareVietQr } from "./vietqr";
import { resolveBankBin } from "./vietqr-banks";

export type PayBatch = Pick<
  PaymentBatch,
  "id" | "code" | "receiverId" | "currency" | "amount"
> & {
  receiverName: string;
  bank: BankAccount | null;
  memo: string;
  /** VietQR payload, or null when it cannot be paid by QR (non-VND or no bank). */
  qr: string | null;
  items: PaymentBatchItem[];
};
type ItemRow = {
  batch_id: string;
  expense_id: string;
  amount: string | number;
  expense: {
    description: string;
    expense_date: string;
    group: { name: string } | null;
  } | null;
};
// Embeds are many-to-one, so rows carry objects rather than the inferred arrays.
const ITEM_COLUMNS =
  "batch_id,expense_id,amount,expense:office_expenses(description,expense_date,group:office_groups(name))";

async function itemsFor(batchIds: string[]) {
  if (!batchIds.length) return new Map<string, PaymentBatchItem[]>();
  const { supabase } = await officeContext();
  const rows = await collectRows<ItemRow>((a, b) =>
    supabase
      .from("payment_batch_items")
      .select(ITEM_COLUMNS)
      .in("batch_id", batchIds)
      .order("batch_id")
      .order("expense_id")
      .range(a, b)
      .overrideTypes<ItemRow[], { merge: false }>(),
  );
  const byBatch = new Map<string, PaymentBatchItem[]>();
  for (const r of rows)
    byBatch.set(r.batch_id, [
      ...(byBatch.get(r.batch_id) || []),
      {
        expenseId: r.expense_id,
        description: r.expense?.description || "",
        expenseDate: r.expense?.expense_date || "",
        groupName: r.expense?.group?.name || "",
        amount: String(r.amount),
      },
    ]);
  for (const [id, list] of byBatch)
    byBatch.set(
      id,
      list.toSorted((x, y) => x.expenseDate.localeCompare(y.expenseDate)),
    );
  return byBatch;
}

/** One open batch per payer and currency: what the viewer still owes them, with one QR. */
export async function payDueData(): Promise<PayBatch[]> {
  const [{ supabase }] = await Promise.all([
    officeContext("/pay"),
    settleOverduePayments(),
  ]);
  const batches = (checked(await supabase.rpc("open_payment_batches")) ||
    []) as {
    batch_id: string;
    code: string;
    receiver_id: string;
    currency: string;
    amount: string | number;
  }[];
  if (!batches.length) return [];
  const receivers = [...new Set(batches.map((b) => b.receiver_id))];
  const [items, names, banks] = await Promise.all([
    itemsFor(batches.map((b) => b.batch_id)),
    profilesFor(receivers),
    supabase.from("bank_profiles").select("*").in("user_id", receivers),
  ]);
  const bankOf = new Map(
    ((checked(banks) || []) as BankAccount[]).map((b) => [b.user_id, b]),
  );
  return batches.map((b) => {
    const bank = bankOf.get(b.receiver_id) || null;
    const amount = String(b.amount);
    const batchItems = items.get(b.batch_id) || [];
    const memo = batchMemo(b.code, batchItems);
    return {
      id: b.batch_id,
      code: b.code,
      receiverId: b.receiver_id,
      currency: b.currency,
      amount,
      receiverName: names.get(b.receiver_id)?.name || "",
      bank,
      memo,
      qr: bank
        ? shareVietQr({
            currency: b.currency,
            bin: resolveBankBin(bank),
            accountNumber: bank.account_number,
            amount,
            memo,
          })
        : null,
      items: batchItems,
    };
  });
}

/** A batch the viewer sent or received, looked up by the code in the transfer memo. */
export async function batchByCode(code: string) {
  const { supabase, user } = await officeContext(`/pay/${code}`);
  const row = checked(
    await supabase
      .from("payment_batches")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle(),
  ) as {
    id: string;
    code: string;
    member_id: string;
    receiver_id: string;
    currency: string;
    amount: string | number;
    status: PaymentBatch["status"];
    created_at: string;
    reported_at: string | null;
  } | null;
  if (!row) return null;
  const [items, names] = await Promise.all([
    itemsFor([row.id]),
    profilesFor([row.member_id, row.receiver_id]),
  ]);
  return {
    viewerId: user.id,
    batch: {
      id: row.id,
      code: row.code,
      memberId: row.member_id,
      receiverId: row.receiver_id,
      currency: row.currency,
      amount: String(row.amount),
      status: row.status,
      createdAt: row.created_at,
      reportedAt: row.reported_at,
    } satisfies PaymentBatch,
    items: items.get(row.id) || [],
    memberName: names.get(row.member_id)?.name || "",
    receiverName: names.get(row.receiver_id)?.name || "",
  };
}
export { batchDateRange, batchMemo, itemList } from "./payment-batch";
