"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import ActionForm from "./ActionForm";
import { saveRecurring } from "@/lib/office-actions";
import { decimalPlaces, type CurrencyCode } from "@/lib/currency";
import { moneyInputError, moneyInputPattern } from "@/lib/money-input";
import { CATEGORIES, type Member } from "@/lib/office-types";

/** Recurring templates are paid by their creator and split equally. */
export default function RecurringForm({
  groupId,
  currency,
  members,
  today,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  today: string;
}) {
  const t = useTranslations("recurring");
  const categories = useTranslations("categories");
  const [selected, setSelected] = useState(members.map((m) => m.user_id));
  const [amount, setAmount] = useState("");
  const dp = decimalPlaces(currency as CurrencyCode);
  const amountError = moneyInputError(amount, dp);
  return (
    <ActionForm
      action={saveRecurring}
      label={t("save")}
      submitDisabled={Boolean(amountError) || !selected.length}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="splitMode" value="even" />
      <input
        type="hidden"
        name="shares"
        value={JSON.stringify(selected.map((userId) => ({ userId })))}
      />
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
        {t("description")}
        <input name="description" required maxLength={300} />
      </label>
      <div className="flex flex-col gap-5 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
          {t("amount", { currency })}
          <input
            name="amount"
            inputMode={dp ? "decimal" : "numeric"}
            pattern={moneyInputPattern(dp)}
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
          {t("category")}
          <select
            aria-label={t("category")}
            name="category"
            defaultValue="utilities"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categories(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
          {t("cadence")}
          <select
            aria-label={t("cadence")}
            name="cadence"
            defaultValue="monthly"
          >
            <option value="monthly">{t("monthly")}</option>
            <option value="weekly">{t("weekly")}</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
          {t("startDate")}
          <input
            type="date"
            name="startDate"
            min={today}
            defaultValue={today}
            required
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2 rounded-xl border p-4">
        <legend className="px-2 text-sm font-semibold">
          {t("participants", {
            selected: selected.length,
            total: members.length,
          })}
        </legend>
        {members.map((m) => (
          <label
            key={m.user_id}
            className="flex min-h-11 items-center gap-3 text-sm wrap-anywhere"
          >
            <input
              type="checkbox"
              checked={selected.includes(m.user_id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, m.user_id]
                    : selected.filter((id) => id !== m.user_id),
                )
              }
            />
            {m.profile?.name || t("member")}
          </label>
        ))}
      </fieldset>
      <p className="text-sm leading-6 text-muted-foreground">{t("hint")}</p>
    </ActionForm>
  );
}
