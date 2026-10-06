"use client";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
const MonthlyChart = dynamic(() => import("./MonthlyChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
export default function MonthlySpending({
  months,
  days,
  currency,
}: {
  months: { month: string; amount: string }[];
  days: { day: string; amount: string }[];
  currency: string;
}) {
  const t = useTranslations("statistics");
  const [interval, setInterval] = useState<"month" | "day">("month");
  const periods =
    interval === "day"
      ? days.map(({ day, amount }) => ({ date: day, amount }))
      : months.map(({ month, amount }) => ({ date: `${month}-01`, amount }));
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3>{t(interval === "day" ? "dailySpending" : "monthlySpending")}</h3>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("chartInterval", { currency })}
          <select
            value={interval}
            onChange={(event) =>
              setInterval(event.target.value === "day" ? "day" : "month")
            }
          >
            <option value="month">{t("byMonth")}</option>
            <option value="day">{t("byDay")}</option>
          </select>
        </label>
      </div>
      {periods.length ? (
        <div className="mt-5 min-w-0">
          <MonthlyChart
            periods={periods}
            interval={interval}
            currency={currency}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("noSpendingInThisDateRange")}
        </p>
      )}
    </div>
  );
}
