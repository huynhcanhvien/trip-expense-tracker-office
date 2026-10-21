import {
  officeContext,
  groupsForUser,
  collectRows,
  profilesFor,
} from "./office-data";
import type { Expense, Share } from "./office-types";

export type ReportFilters = { group?: string; from?: string; to?: string };

export function vietnamDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
const validDate = (d?: string) =>
  !!d &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) &&
  new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/** The same filtered expenses feed the statistics page and the CSV export. */
export async function reportData(filters: ReportFilters) {
  const { supabase, user } = await officeContext("/statistics");
  const groups = await groupsForUser();
  const chosen = filters.group
    ? groups.filter((g) => g.id === filters.group)
    : groups;
  const today = vietnamDate();
  const from = validDate(filters.from)
    ? filters.from!
    : `${today.slice(0, 7)}-01`;
  const to = validDate(filters.to) ? filters.to! : today;
  const expenses: Expense[] = [];
  const shares: Share[] = [];
  if (chosen.length && from <= to) {
    for (let start = 0; start < chosen.length; start += 100) {
      const groupIds = chosen.slice(start, start + 100).map((g) => g.id);
      expenses.push(
        ...(await collectRows<Expense>((a, b) =>
          supabase
            .from("office_expenses")
            .select("*")
            .in("group_id", groupIds)
            .gte("expense_date", from)
            .lte("expense_date", to)
            .order("id")
            .range(a, b),
        )),
      );
    }
    for (let start = 0; start < expenses.length; start += 100) {
      const expenseIds = expenses.slice(start, start + 100).map((e) => e.id);
      shares.push(
        ...(await collectRows<Share>((a, b) =>
          supabase
            .from("office_shares")
            .select("*")
            .in("expense_id", expenseIds)
            .order("expense_id")
            .order("user_id")
            .range(a, b),
        )),
      );
    }
  }
  const money = <T extends { amount: unknown }>(row: T) => ({
    ...row,
    amount: String(row.amount),
  });
  const names = await profilesFor([
    ...shares.map((s) => s.user_id),
    ...expenses.flatMap((e) => [e.payer_id, e.creator_id]),
  ]);
  return {
    user,
    groups,
    chosen,
    from,
    to,
    expenses: expenses.map(money),
    shares: shares.map(money),
    names,
  };
}
