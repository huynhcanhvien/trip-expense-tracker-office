import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import RecurringForm from "@/app/components/RecurringForm";
import { Heading, Empty, money } from "@/app/components/OfficeUI";
import { collectRows, groupMembersData } from "@/lib/office-data";
import { stopRecurring } from "@/lib/office-actions";
import { vietnamDate } from "@/lib/office-report";
import type { RecurringExpense } from "@/lib/office-types";
import { requireUser } from "@/lib/supabase/server";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const t = await getTranslations("recurring");
  const categories = await getTranslations("categories");
  const format = await getFormatter();
  const { groupId } = await params;
  const data = await groupMembersData(groupId);
  if (!data) notFound();
  const { group, user, members } = data;
  const { supabase } = await requireUser(`/groups/${groupId}/recurring`);
  const templates = await collectRows<RecurringExpense>((a, b) =>
    supabase
      .from("recurring_expenses")
      .select("*")
      .eq("group_id", groupId)
      .order("active", { ascending: false })
      .order("next_date")
      .order("id")
      .range(a, b),
  );
  const nameOf = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.name || t("member");
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), { dateStyle: "medium" });
  return (
    <AppShell>
      <Link
        href={`/groups/${groupId}`}
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        ← {group.name}
      </Link>
      <Heading title={t("title")} description={t("pageDescription")} />
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
          <h2>{t("schedules")}</h2>
          {templates.length ? (
            <ul className="mt-3">
              {templates.map((r) => (
                <li
                  key={r.id}
                  className="flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0"
                >
                  <div className="min-w-0 flex-1 wrap-anywhere">
                    <strong className="text-sm font-semibold">
                      {r.description}
                    </strong>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(r.cadence)} · {categories(r.category)} ·{" "}
                      {t("paidBy", { name: nameOf(r.creator_id) })}
                    </p>
                    <p className="mt-1 text-xs">
                      {r.active
                        ? t("nextOn", { date: date(r.next_date) })
                        : r.last_error
                          ? t("paused")
                          : t("stopped")}
                    </p>
                  </div>
                  <strong className="text-sm tabular-nums">
                    {money(String(r.amount), group.currency)}
                  </strong>
                  {r.active &&
                    (r.creator_id === user.id ||
                      group.owner_id === user.id) && (
                      <ActionForm
                        action={stopRecurring}
                        label={t("stop")}
                        className="flex max-w-full flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="groupId" value={groupId} />
                      </ActionForm>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("empty")}</Empty>
          )}
        </section>
        <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
          <h2>{t("new")}</h2>
          <RecurringForm
            groupId={groupId}
            currency={group.currency}
            members={members}
            today={vietnamDate()}
          />
        </section>
      </div>
    </AppShell>
  );
}
