import { getTranslations } from "next-intl/server";
import { reportData } from "@/lib/office-report";
import { toCsv } from "@/lib/csv";

/** One row per member share, so accounting can reconcile who owes what. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { chosen, from, to, expenses, shares, names } = await reportData({
    group: params.get("group") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  });
  const [t, status, categories] = await Promise.all([
    getTranslations("export"),
    getTranslations("status"),
    getTranslations("categories"),
  ]);
  const groups = new Map(chosen.map((g) => [g.id, g]));
  const name = (id: string) => names.get(id)?.name || "";
  const label = (key: string) => (status.has(key) ? status(key) : key);
  const byExpense = new Map<string, typeof shares>();
  for (const share of shares)
    byExpense.set(share.expense_id, [
      ...(byExpense.get(share.expense_id) || []),
      share,
    ]);
  const rows = [...expenses]
    .sort(
      (a, b) =>
        a.expense_date.localeCompare(b.expense_date) ||
        a.id.localeCompare(b.id),
    )
    .flatMap((e) =>
      (byExpense.get(e.id) || []).map((s) => [
        e.expense_date,
        groups.get(e.group_id)?.name || "",
        e.description,
        categories.has(e.category) ? categories(e.category) : e.category,
        label(e.status),
        e.amount,
        groups.get(e.group_id)?.currency || "",
        name(e.payer_id),
        name(e.creator_id),
        name(s.user_id),
        s.amount,
        label(s.payment_status),
      ]),
    );
  const header = [
    "date",
    "group",
    "description",
    "category",
    "expenseStatus",
    "total",
    "currency",
    "paidBy",
    "addedBy",
    "member",
    "share",
    "paymentStatus",
  ].map((key) => t(`columns.${key}`));
  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses_${from}_${to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
