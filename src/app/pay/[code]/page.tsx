import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import AppShell from "@/app/components/AppShell";
import CopyButton from "@/app/components/CopyButton";
import { Empty, Heading, money } from "@/app/components/OfficeUI";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { batchByCode, batchMemo, itemList } from "@/lib/office-pay";
import BatchSummary from "../BatchSummary";

const STATUS_TONE = {
  open: "bg-muted text-muted-foreground",
  reported: "bg-success-soft text-success",
  superseded: "bg-warning-soft text-warning",
} as const;

/** Lets both sides match a transfer memo code to the expenses it covers. */
export default async function PaymentBatchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getTranslations("pay");
  const format = await getFormatter();
  const { code } = await params;
  const data = /^[A-Za-z0-9]{6}$/.test(code) ? await batchByCode(code) : null;
  if (!data)
    return (
      <AppShell>
        <Heading title={t("title")} />
        <Card>
          <Empty>{t("batchMissing")}</Empty>
        </Card>
      </AppShell>
    );
  const { batch, items, memberName, receiverName } = data;
  return (
    <AppShell>
      <Link
        href={data.viewerId === batch.memberId ? "/pay" : "/notifications"}
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        ← {t("title")}
      </Link>
      <Heading
        eyebrow={t("batchEyebrow")}
        title={t("batchTitle", { code: batch.code })}
        description={t("batchDescription", {
          member: memberName,
          receiver: receiverName,
          date: format.dateTime(new Date(batch.reportedAt || batch.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      >
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <strong className="text-3xl font-bold tabular-nums">
            {money(batch.amount, batch.currency)}
          </strong>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              STATUS_TONE[batch.status],
            )}
          >
            {t(`status.${batch.status}`)}
          </span>
        </div>
      </Heading>
      <section
        aria-label={t("memo")}
        className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary-soft px-5 py-4"
      >
        <div className="min-w-0">
          <p className="text-xs text-primary-soft-foreground">{t("memo")}</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide text-primary-soft-foreground wrap-anywhere">
            {batchMemo(batch.code, items)}
          </p>
          <BatchSummary
            code={batch.code}
            items={items}
            className="mt-1 text-sm font-semibold text-primary-soft-foreground"
          />
        </div>
        <p className="max-w-sm text-xs leading-6 text-primary-soft-foreground">
          {t("memoHint")}
        </p>
      </section>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base">
            {t("expenses")} ·{" "}
            <span className="text-muted-foreground">
              {t("itemCount", { count: items.length })}
            </span>
          </h2>
          <CopyButton value={itemList(items)} label={t("copyList")} />
        </div>
        <ol className="divide-y rounded-xl border">
          {items.map((i) => (
            <li key={i.expenseId}>
              <Link
                href={`/expenses/${i.expenseId}`}
                className="flex min-h-11 flex-wrap items-start gap-x-3 gap-y-1 px-3 py-3 transition-colors hover:bg-muted"
              >
                <code className="shrink-0 font-mono text-xs text-muted-foreground wrap-anywhere">
                  {i.expenseId}:
                </code>
                <span className="min-w-0 flex-1 text-sm font-semibold wrap-anywhere">
                  {i.description}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {i.groupName} ·{" "}
                    {format.dateTime(new Date(`${i.expenseDate}T00:00:00Z`), {
                      dateStyle: "medium",
                    })}
                  </span>
                </span>
                <strong className="shrink-0 text-sm tabular-nums">
                  {money(i.amount, batch.currency)}
                </strong>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </AppShell>
  );
}
