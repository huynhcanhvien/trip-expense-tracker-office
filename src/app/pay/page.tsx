import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import CopyButton from "@/app/components/CopyButton";
import PaymentQr from "@/app/components/PaymentQr";
import { Badge, Empty, Heading, money } from "@/app/components/OfficeUI";
import { Card } from "@/app/components/ui/card";
import BatchSummary from "./BatchSummary";
import { reportPaymentBatch } from "@/lib/office-actions";
import { payablesData } from "@/lib/office-inbox";
import { itemList, payDueData, type PayBatch } from "@/lib/office-pay";
import { AUTO_CONFIRM_HOURS } from "@/lib/payments";

export default async function PayPage() {
  const t = await getTranslations("pay");
  const [batches, payables] = await Promise.all([payDueData(), payablesData()]);
  const awaiting = payables.filter((p) => p.status === "reported");
  return (
    <AppShell>
      <Link
        href="/"
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        {t("back")}
      </Link>
      <Heading
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      {batches.length ? (
        <div className="grid gap-6">
          {batches.map((b) => (
            <BatchCard key={b.id} batch={b} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty>{t("nothingToPay")}</Empty>
        </Card>
      )}
      {awaiting.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-base">{t("awaitingTitle")}</h2>
          <ul>
            {awaiting.map((p) => (
              <li key={p.key} className="border-b last:border-0">
                <Link
                  href={`/expenses/${p.expenseId}`}
                  className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 text-sm wrap-anywhere">
                    {p.description} ·{" "}
                    <span className="text-muted-foreground">
                      {p.counterpartName}
                    </span>
                  </span>
                  <Badge status={p.status} />
                  <strong className="text-sm tabular-nums">
                    {money(p.amount, p.currency)}
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}

async function BatchCard({ batch: b }: { batch: PayBatch }) {
  const t = await getTranslations("pay");
  const format = await getFormatter();
  const total = money(b.amount, b.currency);
  return (
    <Card
      aria-labelledby={`batch-${b.id}`}
      className="overflow-hidden p-0 sm:p-0"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b bg-surface-raised px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id={`batch-${b.id}`} className="text-base wrap-anywhere">
            {t("payTo", { name: b.receiverName })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("itemCount", { count: b.items.length })} · {b.currency}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{t("total")}</p>
          <strong className="text-2xl font-bold tabular-nums">{total}</strong>
        </div>
      </header>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
        <section aria-label={t("expenses")} className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("expenses")}
            </h3>
            <CopyButton value={itemList(b.items)} label={t("copyList")} />
          </div>
          <ol className="divide-y rounded-xl border">
            {b.items.map((i) => (
              <li key={i.expenseId}>
                <Link
                  href={`/expenses/${i.expenseId}`}
                  className="flex min-h-11 items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                    {i.expenseId.slice(0, 8)}
                  </code>
                  <span className="min-w-0 flex-1 text-sm wrap-anywhere">
                    {i.description}
                    <span className="block text-xs text-muted-foreground">
                      {i.groupName} ·{" "}
                      {format.dateTime(new Date(`${i.expenseDate}T00:00:00Z`), {
                        dateStyle: "medium",
                      })}
                    </span>
                  </span>
                  <strong className="shrink-0 text-sm tabular-nums">
                    {money(i.amount, b.currency)}
                  </strong>
                </Link>
              </li>
            ))}
          </ol>
          {b.bank ? (
            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("bank")}</dt>
              <dd className="font-semibold wrap-anywhere">
                {b.bank.bank_name}
              </dd>
              <dt className="text-muted-foreground">{t("accountHolder")}</dt>
              <dd className="font-semibold wrap-anywhere">
                {b.bank.account_holder}
              </dd>
              <dt className="text-muted-foreground">{t("accountNumber")}</dt>
              <dd className="flex flex-wrap items-center gap-2 font-semibold wrap-anywhere">
                {b.bank.account_number}
                <CopyButton value={b.bank.account_number} />
              </dd>
            </dl>
          ) : (
            <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">
              {t("noBank", { name: b.receiverName })}
            </p>
          )}
        </section>
        <figure className="flex flex-col items-center gap-3 text-center">
          {b.qr ? (
            <>
              <PaymentQr
                payload={b.qr}
                label={t("qrLabel", { amount: total, name: b.receiverName })}
              />
              <figcaption className="text-xs text-muted-foreground">
                {t("scanToPay", { amount: total })}
              </figcaption>
            </>
          ) : (
            b.bank && (
              <figcaption className="text-xs text-muted-foreground">
                {t("qrUnavailable")}
              </figcaption>
            )
          )}
          <div className="w-full rounded-xl border border-dashed border-primary/40 bg-primary-soft px-3 py-2">
            <p className="text-[11px] text-primary-soft-foreground">
              {t("memo")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="font-mono text-sm font-bold whitespace-nowrap text-primary-soft-foreground">
                {b.memo}
              </p>
              <CopyButton value={b.memo} />
            </div>
            <BatchSummary
              code={b.code}
              items={b.items}
              className="mt-2 border-t border-primary/20 pt-2 text-xs font-semibold text-primary-soft-foreground"
            />
          </div>
          <Link
            href={`/pay/${b.code}`}
            className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("viewBatch", { code: b.code })}
          </Link>
        </figure>
      </div>
      <footer className="border-t px-5 pb-5 sm:px-6">
        <ActionForm action={reportPaymentBatch} label={t("reported")}>
          <input type="hidden" name="batchId" value={b.id} />
          <p className="text-xs leading-6 text-muted-foreground">
            {t("reportHint", { amount: total, hours: AUTO_CONFIRM_HOURS })}
          </p>
        </ActionForm>
      </footer>
    </Card>
  );
}
