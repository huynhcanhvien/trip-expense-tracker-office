"use client";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/app/components/OfficeUI";
export default function MonthlyChart({
  months,
  currency,
}: {
  months: { month: string; amount: string }[];
  currency: string;
}) {
  const t = useTranslations("statistics");
  const format = useFormatter();
  const locale = useLocale();
  const points = months.map((m) => ({
    ...m,
    amountNumeric: Number(m.amount),
    label: format.dateTime(new Date(`${m.month}-01T00:00:00Z`), {
      month: "short",
      year: "2-digit",
    }),
  }));
  return (
    <>
      <div className="h-64 w-full min-w-0" data-testid="monthly-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={points}
            margin={{ top: 10, right: 8, left: 0, bottom: 8 }}
            aria-label={t("chartLabel", { currency })}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={55}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                new Intl.NumberFormat(locale, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  (typeof points)[number] | undefined;
                return active && point ? (
                  <div className="rounded-xl border bg-surface-raised p-3 text-sm shadow-lift">
                    <p className="text-muted-foreground">
                      {format.dateTime(
                        new Date(`${point.month}-01T00:00:00Z`),
                        { month: "long", year: "numeric" },
                      )}
                    </p>
                    <strong className="tabular">
                      {money(point.amount, currency)}
                    </strong>
                  </div>
                ) : null;
              }}
            />
            <Bar
              dataKey="amountNumeric"
              name={t("totalSpending")}
              fill="var(--primary)"
              radius={[6, 6, 0, 0]}
              maxBarSize={64}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm flex min-h-11 items-center font-semibold text-primary">
          {t("monthlyData")}
        </summary>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t("chartLabel", { currency })}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
              >
                {t("month")}
              </th>
              <th
                scope="col"
                className="text-right bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap border-b p-3 tabular-nums"
              >
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td className="border-t whitespace-nowrap border-b p-3 tabular-nums">
                  {format.dateTime(new Date(`${m.month}-01T00:00:00Z`), {
                    month: "long",
                    year: "numeric",
                  })}
                </td>
                <td className="tabular border-t text-right whitespace-nowrap border-b p-3 tabular-nums">
                  {money(m.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
