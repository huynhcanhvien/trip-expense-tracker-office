import { localizeServerMessage } from "@/i18n/server-messages";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import { Heading, Empty } from "@/app/components/OfficeUI";
import { officeContext, checked } from "@/lib/office-data";
import { readNotification } from "@/lib/office-actions";
export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const locale = await getLocale();
  const { supabase } = await officeContext();
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
