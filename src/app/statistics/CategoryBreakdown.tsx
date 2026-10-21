import { getTranslations } from "next-intl/server";
import Big from "big.js";
import { money } from "@/app/components/OfficeUI";

/** Plain bars, no chart library: cheap to render and readable in both themes. */
export default async function CategoryBreakdown({
  categories,
  currency,
}: {
  categories: { category: string; amount: string; count: number }[];
  currency: string;
}) {
  const t = await getTranslations("statistics");
  const labels = await getTranslations("categories");
  const top = categories[0]?.amount || "0";
  const total = categories.reduce((sum, c) => sum.plus(c.amount), new Big(0));
  return (
    <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
      <h3>{t("byCategory")}</h3>
      {categories.length ? (
        <ul className="mt-5 space-y-4">
          {categories.map((c) => {
            const share = total.gt(0)
              ? Number(new Big(c.amount).div(total).times(100).toFixed(0))
              : 0;
            const width = new Big(top).gt(0)
              ? Number(new Big(c.amount).div(top).times(100).toFixed(1))
              : 0;
            return (
              <li key={c.category} className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {labels.has(c.category) ? labels(c.category) : c.category}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(c.amount, currency)} · {share}% ·{" "}
                    {t("expenseCount", { count: c.count })}
                  </span>
                </div>
                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t("noSpending")}</p>
      )}
    </section>
  );
}
