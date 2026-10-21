import { getFormatter, getTranslations } from "next-intl/server";
import { collectRows, officeContext, profilesFor } from "@/lib/office-data";
import { money, Empty } from "./OfficeUI";
import type { ExpenseChange, Profile } from "@/lib/office-types";

type Pair = [unknown, unknown];
const isPair = (value: unknown): value is Pair =>
  Array.isArray(value) && value.length === 2;

/** Who changed what on an expense; the database stores only changed fields. */
export default async function ExpenseChangeLog({
  expenseId,
  currency,
  names,
}: {
  expenseId: string;
  currency: string;
  names: Map<string, Profile>;
}) {
  const t = await getTranslations("changeLog");
  const categories = await getTranslations("categories");
  const format = await getFormatter();
  const { supabase } = await officeContext(`/expenses/${expenseId}`);
  const changes = await collectRows<ExpenseChange>((a, b) =>
    supabase
      .from("expense_changes")
      .select("*")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b),
  );
  const people = new Set<string>();
  for (const change of changes) {
    if (change.actor_id) people.add(change.actor_id);
    const payer = change.changes.payer_id;
    if (isPair(payer)) payer.forEach((id) => id && people.add(String(id)));
    const shares = change.changes.shares;
    if (isPair(shares))
      shares.forEach((map) =>
        Object.keys(map || {}).forEach((id) => people.add(id)),
      );
  }
  const missing = [...people].filter((id) => !names.has(id));
  const extra = missing.length ? await profilesFor(missing) : new Map();
  const nameOf = (id: unknown) =>
    names.get(String(id))?.name || extra.get(String(id))?.name || t("member");
  const show = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "amount") return money(String(value), currency);
    if (field === "payer_id") return nameOf(value);
    if (field === "category")
      return categories.has(String(value))
        ? categories(String(value))
        : String(value);
    if (field === "expense_date")
      return format.dateTime(new Date(`${value}T00:00:00Z`), {
        dateStyle: "medium",
      });
    return String(value);
  };
  const details = (change: ExpenseChange) => {
    if (change.action === "create" || change.action === "recurring") return [];
    return Object.entries(change.changes).flatMap(([field, value]) => {
      if (field === "reason")
        return [`${t("fields.reason")}: ${String(value)}`];
      if (!isPair(value)) return [];
      if (field !== "shares")
        return [
          `${t.has(`fields.${field}`) ? t(`fields.${field}`) : field}: ${show(field, value[0])} → ${show(field, value[1])}`,
        ];
      const [before, after] = value as [
        Record<string, string>,
        Record<string, string>,
      ];
      const ids = new Set([
        ...Object.keys(before || {}),
        ...Object.keys(after || {}),
      ]);
      return [...ids]
        .filter((id) => before?.[id] !== after?.[id])
        .map(
          (id) =>
            `${t("fields.shareOf", { name: nameOf(id) })}: ${before?.[id] ? money(before[id], currency) : "—"} → ${after?.[id] ? money(after[id], currency) : "—"}`,
        );
    });
  };
  return (
    <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
      <h2>{t("title")}</h2>
      {changes.length ? (
        <ol className="mt-5 space-y-5 border-l-2 border-accent-soft pl-5">
          {changes.map((change) => (
            <li key={change.id} className="text-sm">
              <strong>{t(`actions.${change.action}`)}</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {change.action === "recurring"
                  ? t("automatic")
                  : nameOf(change.actor_id)}{" "}
                ·{" "}
                {format.dateTime(new Date(change.created_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {details(change).length > 0 && (
                <ul className="mt-2 space-y-1 text-sm leading-6">
                  {details(change).map((line) => (
                    <li key={line} className="wrap-anywhere tabular-nums">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{t("empty")}</Empty>
      )}
    </section>
  );
}
