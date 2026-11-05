import { getFormatter, getTranslations } from "next-intl/server";
import { batchDateRange } from "@/lib/payment-batch";
import type { PaymentBatchItem } from "@/lib/office-types";

/** The memo spelled out with the full dates, for matching against a bank statement. */
export default async function BatchSummary({
  code,
  items,
  className,
}: {
  code: string;
  items: PaymentBatchItem[];
  className?: string;
}) {
  const t = await getTranslations("pay");
  const format = await getFormatter();
  const { from, to } = batchDateRange(items);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    <p className={className}>
      {from === to
        ? t("summarySameDay", { code, count: items.length, date: day(from) })
        : t("summary", {
            code,
            count: items.length,
            from: day(from),
            to: day(to),
          })}
    </p>
  );
}
