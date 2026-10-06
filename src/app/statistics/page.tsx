import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import MonthlySpending from "./MonthlySpending";
import AppShell from "@/app/components/AppShell";
import { Heading, Empty, money } from "@/app/components/OfficeUI";
import {
  officeContext,
  groupsForUser,
  collectRows,
  profilesFor,
} from "@/lib/office-data";
import { calculateStats } from "@/lib/office-stats";
import type { Expense, Share } from "@/lib/office-types";
function vietnamDate() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (key: string) => p.find((x) => x.type === key)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; from?: string; to?: string }>;
}) {
  const t = await getTranslations("statistics");
  const format = await getFormatter();
  const filters = await searchParams;
  const { supabase, user } = await officeContext();
  const groups = await groupsForUser();
  const chosen = filters.group
    ? groups.filter((g) => g.id === filters.group)
    : groups;
  const today = vietnamDate();
  const validDate = (d?: string) =>
    !!d &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) &&
    new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
  const from = validDate(filters.from)
    ? filters.from!
    : `${today.slice(0, 7)}-01`;
  const to = validDate(filters.to) ? filters.to! : today;
  let expenses: Expense[] = [];
  let shares: Share[] = [];
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
    expenses = expenses.map((e) => ({ ...e, amount: String(e.amount) }));
    shares = shares.map((s) => ({ ...s, amount: String(s.amount) }));
  }
  const names = await profilesFor([
    ...shares.map((s) => s.user_id),
    ...expenses.map((e) => e.creator_id),
  ]);
  const stats = calculateStats(chosen, expenses, shares, user.id);
  const cancelled = expenses.filter((e) => e.status === "cancelled");
  return (
    <AppShell>
      <Heading
        title={t("statistics")}
        description={t("paymentsAwaitingConfirmationStillCountAs")}
      />
      <form
        className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6 flex flex-wrap items-end gap-4"
        method="get"
      >
        <label className="flex flex-col gap-2 text-sm font-medium flex-1 min-w-[min(100%,150px)]">
          {t("group")}
          <select name="group" defaultValue={filters.group || ""}>
            <option value="">{t("allGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.currency})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium flex-1 min-w-[min(100%,150px)]">
          {t("fromDate")}
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium flex-1 min-w-[min(100%,150px)]">
          {t("toDate")}
          <input type="date" name="to" defaultValue={to} required />
        </label>
        <button className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
          {t("filter")}
        </button>
      </form>
      {from > to && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
        >
          {t("theStartDateMustBeOn")}
        </p>
      )}
      {!stats.length && <Empty>{t("noGroupsToReportOnYet")}</Empty>}
      {stats.map((s) => (
        <section key={s.currency} className="mt-8 space-y-4">
          <h2>{s.currency}</h2>
          <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [t("totalSpending"), s.totals.spent],
              [t("toCollectFromMembers"), s.totals.toCollect],
              [t("confirmedReceipts"), s.totals.received],
              [t("awaitingConfirmation"), s.totals.reported],
              [t("outstandingIncludingUnconfirmed"), s.totals.outstanding],
            ].map(([label, amount]) => (
              <div
                className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-soft"
                key={label}
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <strong className="text-2xl font-bold tabular-nums">
                  {money(amount, s.currency)}
                </strong>
              </div>
            ))}
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-soft">
              <span className="text-xs text-muted-foreground">
                {t("completedExpenses")}
              </span>
              <strong className="text-2xl font-bold tabular-nums">
                {s.totals.completed}
              </strong>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
              <MonthlySpending
                months={s.months}
                days={s.days}
                currency={s.currency}
              />
            </section>
            <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
              <h3>{t("yourPersonalTotals")}</h3>
              <dl className="mt-4">
                {[
                  [t("paidUpfront"), s.totals.advanced],
                  [t("yourShareOfSpending"), s.totals.personalShare],
                  [t("repaid"), s.totals.repaid],
                  [t("stillToPay"), s.totals.toPay],
                  [t("stillToReceive"), s.totals.toReceive],
                ].map(([label, amount]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-3 border-b py-3 text-sm last:border-0"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">
                      {money(amount, s.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
            <h3>{t("byMember")}</h3>
            <div className="hidden md:block mt-5 w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("member")}
                    </th>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("paidUpfront")}
                    </th>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("shareOfSpending")}
                    </th>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("repaid")}
                    </th>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("toPay")}
                    </th>
                    <th
                      scope="col"
                      className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
                    >
                      {t("toReceive")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.people.map((p) => (
                    <tr key={p.userId}>
                      <td className="whitespace-nowrap border-b p-3 tabular-nums">
                        {names.get(p.userId)?.name || t("member")}
                      </td>
                      {[
                        p.advanced,
                        p.share,
                        p.repaid,
                        p.toPay,
                        p.toReceive,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className="whitespace-nowrap border-b p-3 tabular-nums"
                        >
                          {money(v, s.currency)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid gap-3 md:hidden">
              {s.people.map((p) => (
                <article
                  className="rounded-xl border bg-surface-raised p-4"
                  key={p.userId}
                >
                  <h4 className="mb-3 text-sm font-semibold">
                    {names.get(p.userId)?.name || t("member")}
                  </h4>
                  <dl className="grid grid-cols-2 gap-3">
                    {[
                      [t("paidUpfront"), p.advanced],
                      [t("shareOfSpending"), p.share],
                      [t("repaid"), p.repaid],
                      [t("toPay"), p.toPay],
                      [t("toReceive"), p.toReceive],
                    ].map(([label, amount]) => (
                      <div className="min-w-0" key={label}>
                        <dt className="text-xs text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="tabular mt-1 wrap-anywhere text-sm font-semibold">
                          {money(amount, s.currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {t("amountsPayableAndReceivableAreNot")}
            </p>
          </section>
          <div className="my-5 rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm leading-7 text-warning">
            {t("confirmedPaymentsInCancelledExpensesTo")}{" "}
            {money(s.totals.cancelledReceived, s.currency)}
          </div>
        </section>
      ))}
      <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
        <h2>{t("cancelledExpenses")}</h2>
        {!cancelled.length ? (
          <Empty>{t("noCancelledExpensesInThisDate")}</Empty>
        ) : (
          cancelled.map((e) => (
            <Link
              className="flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0 rounded-xl px-2 transition-colors hover:bg-muted"
              href={`/expenses/${e.id}`}
              key={e.id}
            >
              <div className="min-w-0 flex-1 wrap-anywhere">
                <strong className="text-sm font-semibold">
                  {e.description}
                </strong>
                <p className="mt-2 text-muted-foreground text-xs">
                  {format.dateTime(new Date(`${e.expense_date}T00:00:00Z`), {
                    dateStyle: "medium",
                  })}{" "}
                  · {e.cancel_reason}
                </p>
              </div>
              <span>{t("viewReconciliation")}</span>
            </Link>
          ))
        )}
      </section>
    </AppShell>
  );
}
