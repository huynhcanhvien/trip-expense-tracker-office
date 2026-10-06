import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import Big from "big.js";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import CopyButton from "@/app/components/CopyButton";
import SavedImage from "@/app/components/SavedImage";
import { Heading, Badge, Empty, money } from "@/app/components/OfficeUI";
import { expenseData, checked, collectRows } from "@/lib/office-data";
import { paymentAction, cancelExpense } from "@/lib/office-actions";
import type { BankAccount } from "@/lib/office-types";
export default async function ExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const t = await getTranslations("expense");
  const format = await getFormatter();
  const eventLabels: Record<string, string> = {
    report: t("transferReported"),
    confirm: t("confirmReceipt"),
    reject: t("transferReportRejected"),
    cancel: t("cancelExpense"),
    create: t("createExpense"),
    update: t("expenseUpdated"),
  };

  const { expenseId } = await params;
  const data = await expenseData(expenseId);
  if (!data) notFound();
  const { user, supabase, expense, group, shares, names } = data;
  const creator = expense.creator_id === user.id;
  const [bankResult, events] = await Promise.all([
    supabase
      .from("bank_profiles")
      .select("*")
      .eq("user_id", expense.creator_id)
      .maybeSingle(),
    collectRows<{
      id: string;
      user_id: string;
      actor_id: string;
      action: string;
      created_at: string;
    }>((a, b) =>
      supabase
        .from("payment_events")
        .select("*")
        .eq("expense_id", expenseId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    ),
  ]);
  const bank = checked(bankResult) as BankAccount | null;
  const required = shares.filter(
    (s) => s.payment_status !== "self" && new Big(s.amount).gt(0),
  );
  const confirmed = required.filter((s) => s.payment_status === "confirmed");
  const received = confirmed.reduce((sum, s) => sum.plus(s.amount), new Big(0));
  return (
    <AppShell>
      <Link
        href={`/groups/${group.id}`}
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        ← {group.name}
      </Link>
      <Heading
        eyebrow={t("payerLine", {
          date: format.dateTime(new Date(`${expense.expense_date}T00:00:00Z`), {
            dateStyle: "medium",
          }),
          name: names.get(expense.creator_id)?.name || t("member"),
        })}
        title={expense.description}
      >
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <strong className="text-3xl font-bold tabular-nums">
            {money(expense.amount, group.currency)}
          </strong>
          <Badge status={expense.status} />
        </div>
      </Heading>
      {expense.status === "cancelled" && (
        <div className="my-5 rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm leading-7 text-warning">
          {t("cancelledNotice", {
            reason: expense.cancel_reason || "",
            amount: money(received.toString(), group.currency),
          })}
        </div>
      )}
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div>
          <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2>{t("sharesAndRepayments")}</h2>
              {creator && expense.status !== "cancelled" && (
                <Link
                  href={`/expenses/${expense.id}/edit`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-primary"
                >
                  {t("edit")}
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {t("progress", {
                confirmed: confirmed.length,
                required: required.length,
                amount: money(received.toString(), group.currency),
              })}
            </p>
            <progress
              max={Math.max(required.length, 1)}
              value={
                expense.status === "completed"
                  ? Math.max(required.length, 1)
                  : confirmed.length
              }
              aria-label={t("repaymentProgress")}
            />
            {shares.map((s) => (
              <div key={s.user_id}>
                <div className="flex min-w-0 flex-wrap items-center gap-3 border-b py-4 last:border-0">
                  <div className="min-w-0 flex-1 wrap-anywhere">
                    <strong className="text-sm font-semibold">
                      {names.get(s.user_id)?.name || t("member")}
                      {s.user_id === user.id ? t("you") : ""}
                    </strong>
                    <p>
                      <Badge status={s.payment_status} />
                    </p>
                  </div>
                  <strong className="shrink-0 text-sm font-bold tabular-nums">
                    {money(s.amount, group.currency)}
                  </strong>
                </div>
                {expense.status === "active" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {s.user_id === user.id &&
                      s.payment_status === "pending" && (
                        <ActionForm
                          action={paymentAction}
                          label={t("iHaveTransferred")}
                          className="flex max-w-full flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="expenseId"
                            value={expense.id}
                          />
                          <input
                            type="hidden"
                            name="groupId"
                            value={group.id}
                          />
                          <input
                            type="hidden"
                            name="userId"
                            value={s.user_id}
                          />
                          <input
                            type="hidden"
                            name="operation"
                            value="report"
                          />
                        </ActionForm>
                      )}
                    {creator &&
                      s.payment_status === "reported" &&
                      ["confirm", "reject"].map((operation) => (
                        <ActionForm
                          key={operation}
                          action={paymentAction}
                          label={
                            operation === "confirm"
                              ? t("confirmReceipt")
                              : t("notReceivedReject")
                          }
                          className="flex max-w-full flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="expenseId"
                            value={expense.id}
                          />
                          <input
                            type="hidden"
                            name="groupId"
                            value={group.id}
                          />
                          <input
                            type="hidden"
                            name="userId"
                            value={s.user_id}
                          />
                          <input
                            type="hidden"
                            name="operation"
                            value={operation}
                          />
                        </ActionForm>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </section>
          <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
            <h2>{t("history")}</h2>
            {events.length ? (
              <ol className="mt-5 space-y-5 border-l-2 border-primary-soft pl-5">
                {events.map((event, index) => (
                  <li
                    key={event.id || index}
                    className="relative text-sm before:absolute before:-left-[27px] before:top-1 before:size-2.5 before:rounded-full before:bg-primary before:content-['']"
                  >
                    <strong>{eventLabels[event.action] || event.action}</strong>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {names.get(event.actor_id)?.name || t("member")}
                      {event.user_id && event.user_id !== event.actor_id
                        ? ` · ${names.get(event.user_id)?.name || t("member")}`
                        : ""}{" "}
                      ·{" "}
                      {format.dateTime(new Date(event.created_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>{t("noRepaymentActivityYet")}</Empty>
            )}
          </section>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24">
          <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
            <h2>{t("transferToThePersonWhoPaid")}</h2>
            {bank ? (
              <>
                <dl className="mt-5 space-y-2">
                  <dt className="mt-4 text-xs text-muted-foreground">
                    {t("bank")}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2 text-sm font-semibold wrap-anywhere">
                    {bank.bank_name}
                  </dd>
                  <dt className="mt-4 text-xs text-muted-foreground">
                    {t("accountHolder")}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2 text-sm font-semibold wrap-anywhere">
                    {bank.account_holder}
                  </dd>
                  <dt className="mt-4 text-xs text-muted-foreground">
                    {t("accountNumber")}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2 text-sm font-semibold wrap-anywhere">
                    {bank.account_number}{" "}
                    <CopyButton value={bank.account_number} />
                  </dd>
                  <dt className="mt-4 text-xs text-muted-foreground">
                    {t("transferReference")}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2 text-sm font-semibold wrap-anywhere">
                    {bank.transfer_template || expense.description}{" "}
                    <CopyButton
                      value={bank.transfer_template || expense.description}
                    />
                  </dd>
                </dl>
                {bank.qr_upload_id && (
                  <SavedImage
                    className="mx-auto mt-5 max-h-72 rounded-xl"
                    uploadId={bank.qr_upload_id}
                    alt={t("bankQRCodeOfThePerson")}
                  />
                )}
              </>
            ) : (
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {t("thePersonWhoPaidHasNot")}
              </p>
            )}
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {t("afterTransferringMarkYourShareAs")}
            </p>
          </section>
          {expense.receipt_upload_id && (
            <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
              <h2>{t("attachedReceipt")}</h2>
              <SavedImage
                className="mt-5 w-full"
                uploadId={expense.receipt_upload_id}
                alt={t("attachedReceipt")}
              />
            </section>
          )}
          {creator && expense.status !== "cancelled" && (
            <details className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
              <summary className="flex min-h-11 items-center font-semibold text-danger">
                {t("cancelExpense")}
              </summary>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {t("historyAndConfirmedPaymentsAreKept")}
              </p>
              <ActionForm action={cancelExpense} label={t("cancelExpense")}>
                <input type="hidden" name="expenseId" value={expense.id} />
                <input type="hidden" name="groupId" value={group.id} />
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                  {t("cancellationReason")}
                  <input name="reason" required maxLength={500} />
                </label>
              </ActionForm>
            </details>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
