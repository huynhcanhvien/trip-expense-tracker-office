"use client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { localizeServerMessage } from "@/i18n/server-messages";
import { useActionState, useId, useState } from "react";
import Big from "big.js";
import type { Expense, Member, OfficeState, Share } from "@/lib/office-types";
import { saveExpense } from "@/lib/office-actions";
import { decimalPlaces, formatAmount, type CurrencyCode } from "@/lib/currency";
import { moneyInputError, moneyInputPattern } from "@/lib/money-input";
import SubmitButton from "./SubmitButton";
import ReceiptScanner from "./ReceiptScanner";
import SavedImage from "./SavedImage";
export default function ExpenseEditor({
  groupId,
  currency,
  members,
  expense,
  shares = [],
}: {
  groupId: string;
  currency: string;
  members: Member[];
  expense?: Expense;
  shares?: Share[];
}) {
  const t = useTranslations("editor");
  const locale = useLocale();
  const [state, action] = useActionState<OfficeState, FormData>(
    saveExpense,
    {},
  );
  const [amount, setAmount] = useState(expense?.amount || "");
  const [description, setDescription] = useState(expense?.description || "");
  const [date, setDate] = useState(
    expense?.expense_date ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
  );
  const [upload, setUpload] = useState(expense?.receipt_upload_id || "");
  const [selected, setSelected] = useState<string[]>(
    expense ? shares.map((s) => s.user_id) : members.map((m) => m.user_id),
  );
  const [mode, setMode] = useState(expense ? "custom" : "even");
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(shares.map((s) => [s.user_id, s.amount])),
  );
  const [scan, setScan] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const dp = decimalPlaces(currency as CurrencyCode);
  const moneyId = useId();
  const amountError = moneyInputError(amount, dp);
  const customError =
    mode === "custom"
      ? selected
          .map((id) => moneyInputError(custom[id] || "", dp, true))
          .find(Boolean)
      : undefined;
  let remaining = "";
  try {
    remaining = new Big(amount || 0)
      .minus(
        selected.reduce((sum, id) => sum.plus(custom[id] || 0), new Big(0)),
      )
      .toString();
  } catch {
    remaining = "—";
  }
  return (
    <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-input bg-surface-raised text-foreground hover:bg-muted"
          disabled={mediaBusy}
          onClick={() => setScan(!scan)}
        >
          {scan ? t("hideReceiptScanner") : t("captureScanReceipt")}
        </button>
      </div>
      {scan && (
        <ReceiptScanner
          groupId={groupId}
          onBusyChange={setMediaBusy}
          onScanned={(v) => {
            setUpload(v.uploadId);
            if (v.amount) setAmount(v.amount);
            if (v.description) setDescription(v.description);
            if (v.expenseDate) setDate(v.expenseDate);
          }}
        />
      )}
      <form
        action={action}
        className="mt-5 flex min-w-0 flex-col gap-5"
        onSubmit={(event) => {
          if (mediaBusy || amountError || customError) event.preventDefault();
        }}
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="expenseId" value={expense?.id || ""} />
        <input type="hidden" name="receiptUploadId" value={upload} />
        <input
          type="hidden"
          name="shares"
          value={JSON.stringify(
            selected.map((userId) => ({
              userId,
              amount: mode === "custom" ? custom[userId] || "0" : "0",
            })),
          )}
        />
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("description")}
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={300}
            placeholder={t("forExampleFridayLunch")}
          />
        </label>
        <div className="flex flex-col gap-5 sm:flex-row">
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium flex-1">
            {t("totalAmount", { currency })}
            <input
              name="amount"
              type="text"
              aria-label={t("totalAmount", { currency })}
              inputMode={dp ? "decimal" : "numeric"}
              pattern={moneyInputPattern(dp)}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(amountError)}
              aria-describedby={`${moneyId}-amount-preview${amountError ? ` ${moneyId}-amount-error` : ""}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <output
              id={`${moneyId}-amount-preview`}
              className="mt-2 text-sm leading-7 text-muted-foreground"
              aria-live="polite"
              data-testid="expense-amount-preview"
            >
              {amount && !amountError
                ? t("amountPreview", {
                    amount: formatAmount(
                      new Big(amount),
                      currency as CurrencyCode,
                    ),
                  })
                : t("enterTheTotalWithoutThousandsSeparators")}
            </output>
            {amountError && (
              <span
                id={`${moneyId}-amount-error`}
                className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
                role="alert"
              >
                {localizeServerMessage(amountError, locale)}
              </span>
            )}
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium flex-1">
            {t("expenseDate")}
            <input
              name="expenseDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          {t("splitMethod")}
          <select
            aria-label={t("splitMethod")}
            name="splitMode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="even">{t("splitEqually")}</option>
            <option value="custom">{t("enterIndividualAmounts")}</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
          <legend className="px-2 text-sm font-semibold">
            {t("participants", {
              selected: selected.length,
              total: members.length,
            })}
          </legend>
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm wrap-anywhere">
            <input
              type="checkbox"
              checked={selected.length === members.length}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? members.map((m) => m.user_id) : [],
                )
              }
            />
            {t("selectAll")}
          </label>
          {members.map((m) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3"
              key={m.user_id}
            >
              <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm wrap-anywhere">
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
              {mode === "custom" && selected.includes(m.user_id) && (
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium w-36">
                  {t("amount")}
                  <input
                    type="text"
                    aria-label={t("shareLabel", {
                      name: m.profile?.name || t("member"),
                    })}
                    inputMode={dp ? "decimal" : "numeric"}
                    pattern={moneyInputPattern(dp)}
                    maxLength={32}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(
                      moneyInputError(custom[m.user_id] || "", dp, true),
                    )}
                    value={custom[m.user_id] || ""}
                    onChange={(e) =>
                      setCustom({ ...custom, [m.user_id]: e.target.value })
                    }
                    required
                  />
                </label>
              )}
            </div>
          ))}
          {mode === "custom" && (
            <p
              className={
                remaining === "0"
                  ? "rounded-xl bg-success-soft p-3 text-sm leading-6 text-success"
                  : "rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
              }
            >
              {t("differenceFromTotal", { amount: remaining, currency })}
            </p>
          )}
          {customError && (
            <p
              className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
              role="alert"
            >
              {localizeServerMessage(customError, locale)}
            </p>
          )}
        </fieldset>
        {upload && (
          <>
            <SavedImage
              uploadId={upload}
              alt={t("receiptForThisExpense")}
              className="mt-5 w-full"
            />
            <p className="rounded-xl bg-success-soft p-3 text-sm leading-6 text-success">
              {t("receiptImageAttachedPleaseCheckThe")}
            </p>
          </>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft p-3 text-sm leading-6 text-danger"
          >
            {localizeServerMessage(state.error, locale)}
          </p>
        )}
        <SubmitButton
          label={expense ? t("saveChanges") : t("createExpense")}
          pendingLabel={t("saving")}
          disabled={Boolean(mediaBusy || amountError || customError)}
          className="self-start"
        />
      </form>
    </section>
  );
}
