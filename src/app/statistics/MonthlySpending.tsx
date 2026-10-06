"use client";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/app/components/ui/skeleton";
const MonthlyChart = dynamic(() => import("./MonthlyChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
export default function MonthlySpending({
  months,
  currency,
}: {
  months: { month: string; amount: string }[];
  currency: string;
}) {
  const t = useTranslations("statistics");
  return (
    <div className="mt-5 min-w-0" aria-label={t("chartLabel", { currency })}>
      <MonthlyChart months={months} currency={currency} />
    </div>
  );
}
