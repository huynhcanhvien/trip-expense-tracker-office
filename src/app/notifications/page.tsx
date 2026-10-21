import { localizeServerMessage } from "@/i18n/server-messages";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import { Heading, Empty, Badge, money } from "@/app/components/OfficeUI";
import { officeContext, checked } from "@/lib/office-data";
import { readNotification } from "@/lib/office-actions";
import {
  approvalsData,
  payablesData,
  type InboxItem,
} from "@/lib/office-inbox";
const FILTERS = ["all", "toPay", "approvals"] as const;
type Filter = (typeof FILTERS)[number];
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const locale = await getLocale();
  const requested = (await searchParams).filter;
  const filter: Filter = FILTERS.includes(requested as Filter)
    ? (requested as Filter)
    : "all";
  const { supabase } = await officeContext("/notifications");
  const [payables, approvals] = await Promise.all([
    payablesData(),
    approvalsData(),
  ]);
  const counts: Record<Filter, number | null> = {
    all: null,
    toPay: payables.length,
    approvals: approvals.length,
  };
  const tabs = (
    <nav aria-label={t("filterLabel")} className="mt-5 flex flex-wrap gap-2">
      {FILTERS.map((key) => (
        <Link
          key={key}
          href={
            key === "all" ? "/notifications" : `/notifications?filter=${key}`
          }
          aria-current={filter === key ? "page" : undefined}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {t(`filters.${key}`)}
          {counts[key] ? (
            <span className="rounded-full bg-surface px-2 text-xs text-foreground tabular-nums">
              {counts[key]}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
  const inbox = (items: InboxItem[], empty: string, counterpart: string) => (
    <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
      {!items.length ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="mt-3">
          {items.map((item) => (
            <li key={item.expenseId} className="border-b last:border-0">
              <Link
                href={`/expenses/${item.expenseId}`}
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl px-2 py-4 transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1 wrap-anywhere">
                  <strong className="text-sm font-semibold">
                    {item.description}
                  </strong>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.groupName} ·{" "}
                    {format.dateTime(
                      new Date(`${item.expenseDate}T00:00:00Z`),
                      { dateStyle: "medium" },
                    )}{" "}
                    · {t(counterpart, { name: item.counterpartName || "—" })}
                  </p>
                  <Badge status={item.status} />
                </div>
                <strong className="shrink-0 text-sm font-bold tabular-nums">
                  {money(item.amount, item.currency)}
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  if (filter !== "all")
    return (
      <AppShell>
        <Heading
          title={t("notifications")}
          description={t(`filterSummary.${filter}`)}
        />
        {tabs}
        {filter === "toPay"
          ? inbox(payables, t("nothingToPay"), "payTo")
          : inbox(approvals, t("nothingToApprove"), "addedBy")}
      </AppShell>
    );
  const rows = checked(
    await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ) as {
    id: string;
    title: string;
    group_id: string | null;
    expense_id: string | null;
    created_at: string;
    read_at: string | null;
  }[];
  return (
    <AppShell>
      <Heading
        title={t("notifications")}
        description={t("summary", {
          count: rows.filter((r) => !r.read_at).length,
        })}
      >
        <ActionForm
          action={readNotification}
          label={t("markAllAsRead")}
          className="flex max-w-full flex-wrap items-center gap-2"
        />
      </Heading>
      {tabs}
      <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
        {!rows.length ? (
          <Empty>{t("youHaveNoNotificationsYet")}</Empty>
        ) : (
          <div className="mt-3">
            {rows.map((r) => (
              <article
                className={`flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0 ${!r.read_at ? "rounded-xl bg-primary-soft/40 px-3" : ""}`}
                key={r.id}
              >
                <div className="min-w-0 flex-1 wrap-anywhere">
                  <strong className="text-sm font-semibold">
                    {localizeServerMessage(r.title, locale)}
                  </strong>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {format.dateTime(new Date(r.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {(r.expense_id || r.group_id) && (
                    <Link
                      href={
                        r.expense_id
                          ? `/expenses/${r.expense_id}`
                          : `/groups/${r.group_id}`
                      }
                    >
                      {t("viewDetails")}
                    </Link>
                  )}
                </div>
                {!r.read_at && (
                  <ActionForm
                    action={readNotification}
                    label={t("markAsRead")}
                    className="flex max-w-full flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="notificationId" value={r.id} />
                  </ActionForm>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
