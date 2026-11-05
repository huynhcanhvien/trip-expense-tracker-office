import type { PaymentBatchItem } from "./office-types";

/** Oldest and newest expense dates (YYYY-MM-DD) in a batch. */
export function batchDateRange(items: PaymentBatchItem[]) {
  const dates = items.map((i) => i.expenseDate).toSorted();
  return { from: dates[0] || "", to: dates.at(-1) || "" };
}

const dayMonth = (date: string) => date.slice(8, 10) + date.slice(5, 7);

/**
 * The QR memo, e.g. "4F7K2Q 3 don 0511 0811". It must fit 25 bank-safe ASCII
 * characters, so the code comes first (never truncated), the year is left out
 * and the dates are DDMM; the batch page shows the full list for the code.
 */
export function batchMemo(code: string, items: PaymentBatchItem[]): string {
  if (!items.length) return code;
  const { from, to } = batchDateRange(items);
  const dates =
    from === to ? dayMonth(from) : `${dayMonth(from)} ${dayMonth(to)}`;
  return `${code} ${items.length} don ${dates}`;
}

/** `<id>:<description>` lines that the payer matches against the memo code. */
export const itemList = (items: PaymentBatchItem[]) =>
  items.map((i) => `${i.expenseId.slice(0, 8)}:${i.description}`).join("\n");
