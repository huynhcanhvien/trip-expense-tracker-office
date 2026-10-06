import { Receipt } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import CopyButton from "@/app/components/CopyButton";

import { Heading, Empty, Badge, money } from "@/app/components/OfficeUI";
import { groupData } from "@/lib/office-data";
import { decideJoin, renameGroup, rotateInvite } from "@/lib/office-actions";
export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const t = await getTranslations("group");
  const format = await getFormatter();
  const { groupId } = await params;
  const data = await groupData(groupId);
  if (!data) notFound();
  const { group, user, members, requests, expenses } = data;
  const admin = group.owner_id === user.id;
  return (
    <AppShell>
      <Link
        href="/"
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        {t("yourGroups")}
      </Link>
      <Heading
        eyebrow={group.currency}
        title={group.name}
        description={t("summary", {
          members: members.length,
          expenses: expenses.length,
        })}
      >
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          href={`/groups/${groupId}/expenses/new`}
        >
          {t("createExpense")}
        </Link>
      </Heading>
      <nav
        aria-label={t("sections")}
        className="sticky top-20 z-20 -mx-4 mb-3 flex gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden"
      >
        <a
          className="inline-flex min-h-11 items-center rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-soft-foreground"
          href="#expenses"
        >
          {t("groupExpenses")}
        </a>
        <a
          className="inline-flex min-h-11 items-center rounded-full bg-muted px-4 text-sm font-semibold"
          href="#members"
        >
          {t("members")}
        </a>
        {admin && (
          <a
            className="inline-flex min-h-11 items-center rounded-full bg-muted px-4 text-sm font-semibold"
            href="#manage"
          >
            {t("manage")}
          </a>
        )}
      </nav>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section
          id="expenses"
          className="scroll-mt-44 mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2>{t("groupExpenses")}</h2>
            <Link
              href={`/statistics?group=${groupId}`}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-primary"
            >
              {t("statistics")}
            </Link>
          </div>
          {expenses.length ? (
            <div className="mt-3">
              {expenses.map((e) => (
                <Link
                  className="flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0 rounded-xl px-2 transition-colors hover:bg-muted"
                  key={e.id}
                  href={`/expenses/${e.id}`}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <Receipt size={19} />
                  </span>
                  <div className="min-w-0 flex-1 wrap-anywhere">
                    <strong className="text-sm font-semibold">
                      {e.description}
                    </strong>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {format.dateTime(
                        new Date(`${e.expense_date}T00:00:00Z`),
                        { dateStyle: "medium" },
                      )}{" "}
                      ·{" "}
                      {members.find((m) => m.user_id === e.creator_id)?.profile
                        ?.name || t("member")}{" "}
                      {t("paidUpfront")}
                    </p>
                    <Badge status={e.status} />
                  </div>
                  <strong className="shrink-0 text-sm font-bold tabular-nums">
                    {money(e.amount, group.currency)}
                  </strong>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{t("noExpensesYetRecordTheFirst")}</Empty>
          )}
        </section>
        <aside className="min-w-0 lg:sticky lg:top-24">
          <section
            id="members"
            className="scroll-mt-44 mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6"
          >
            <h2>{t("members")}</h2>
            <div className="mt-3">
              {members.map((m) => (
                <div
                  className="flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0"
                  key={m.user_id}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground">
                    {(m.profile?.name || "TV")
                      .split(/\s+/)
                      .map((part) => part.charAt(0))
                      .slice(-2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <strong className="min-w-0 flex-1 wrap-anywhere shrink-0 text-sm font-bold tabular-nums">
                    {m.profile?.name || t("member")}
                    {m.user_id === user.id ? t("you") : ""}
                  </strong>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {m.user_id === group.owner_id ? t("admin") : t("member")}
                  </span>
                </div>
              ))}
            </div>
          </section>
          {admin && (
            <>
              <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
                <h2 id="manage" className="scroll-mt-44">
                  {t("inviteColleagues")}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {t("newMembersNeedYourApprovalBefore")}
                </p>
                <p className="my-4 break-all rounded-xl bg-muted p-3 text-xs">
                  /invite/{group.invite_token}
                </p>
                <CopyButton
                  value={`/invite/${group.invite_token}`}
                  label={t("copyInvitationLink")}
                />
                <ActionForm
                  action={rotateInvite}
                  label={t("revokeAndCreateNewLink")}
                >
                  <input type="hidden" name="groupId" value={groupId} />
                </ActionForm>
              </section>
              <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
                <h2>{t("joinRequests", { count: requests.length })}</h2>
                {!requests.length && (
                  <Empty>{t("noRequestsAwaitingApproval")}</Empty>
                )}
                {requests.map((r) => (
                  <div className="mt-4 space-y-3 border-t pt-4" key={r.id}>
                    <strong>{r.profile?.name || t("newMember")}</strong>
                    <div className="flex flex-wrap items-center gap-2">
                      {[true, false].map((approve) => (
                        <ActionForm
                          key={String(approve)}
                          action={decideJoin}
                          label={approve ? t("approve") : t("reject")}
                          className="flex max-w-full flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="requestId" value={r.id} />
                          <input type="hidden" name="groupId" value={groupId} />
                          <input
                            type="hidden"
                            name="approve"
                            value={String(approve)}
                          />
                        </ActionForm>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
              <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
                <h2>{t("groupSettings")}</h2>
                <ActionForm action={renameGroup} label={t("rename")}>
                  <input type="hidden" name="groupId" value={groupId} />
                  <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                    {t("groupName")}
                    <input
                      name="name"
                      defaultValue={group.name}
                      required
                      maxLength={100}
                    />
                  </label>
                </ActionForm>
              </section>
            </>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
