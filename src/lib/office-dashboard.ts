import { officeContext, groupsForUser, collectRows } from "./office-data";
import { calculateStats } from "./office-stats";
import type { Expense, Share } from "./office-types";

/** Only active expenses can contribute to current amounts due. Never mix currencies. */
export async function currentBalances() {
  const [{ supabase, user }, groups] = await Promise.all([
    officeContext(),
    groupsForUser(),
  ]);
  const expenses: Expense[] = [];
  const shares: Share[] = [];
  for (let start = 0; start < groups.length; start += 100) {
    const ids = groups.slice(start, start + 100).map((g) => g.id);
    expenses.push(
      ...(await collectRows<Expense>((a, b) =>
        supabase
          .from("office_expenses")
          .select("*")
          .in("group_id", ids)
          .eq("status", "active")
          .order("id")
          .range(a, b),
      )),
    );
  }
  for (let start = 0; start < expenses.length; start += 100) {
    const ids = expenses.slice(start, start + 100).map((e) => e.id);
    shares.push(
      ...(await collectRows<Share>((a, b) =>
        supabase
          .from("office_shares")
          .select("*")
          .in("expense_id", ids)
          .order("expense_id")
          .order("user_id")
          .range(a, b),
      )),
    );
  }
  return calculateStats(
    groups,
    expenses.map((e) => ({ ...e, amount: String(e.amount) })),
    shares.map((s) => ({ ...s, amount: String(s.amount) })),
    user.id,
  ).map(({ currency, totals }) => ({
    currency,
    toPay: totals.toPay,
    toReceive: totals.toReceive,
  }));
}
