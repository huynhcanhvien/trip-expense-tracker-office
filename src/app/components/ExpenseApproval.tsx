import { getTranslations } from "next-intl/server";
import ActionForm from "./ActionForm";
import { approveExpense } from "@/lib/office-actions";
import type { Expense } from "@/lib/office-types";

/** The member named as payer accepts or rejects an expense someone else recorded. */
export default async function ExpenseApproval({
  expense,
  isPayer,
  payerName,
  creatorName,
}: {
  expense: Expense;
  isPayer: boolean;
  payerName: string;
  creatorName: string;
}) {
  const t = await getTranslations("approval");
  if (expense.status === "rejected")
    return (
      <div className="my-5 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm leading-7 text-danger">
        {t("rejectedNotice", {
          name: payerName,
          reason: expense.reject_reason || "",
        })}
      </div>
    );
  if (expense.status !== "awaiting_payer") return null;
  if (!isPayer)
    return (
      <div className="my-5 rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm leading-7 text-warning">
        {t("waitingFor", { name: payerName })}
      </div>
    );
  const hidden = (
    <>
      <input type="hidden" name="expenseId" value={expense.id} />
      <input type="hidden" name="groupId" value={expense.group_id} />
      <input type="hidden" name="revision" value={expense.revision} />
    </>
  );
  return (
    <section
      aria-labelledby="approval-heading"
      className="my-5 rounded-2xl border-2 border-primary/30 bg-primary-soft p-5 sm:p-6"
    >
      <h2 id="approval-heading">{t("title")}</h2>
      <p className="mt-2 text-sm leading-7">
        {t("explain", { name: creatorName })}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <ActionForm
          action={approveExpense}
          label={t("approve")}
          className="flex max-w-full flex-wrap items-center gap-2"
        >
          {hidden}
          <input type="hidden" name="decision" value="approve" />
        </ActionForm>
        <details className="min-w-0 flex-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-danger">
            {t("reject")}
          </summary>
          <ActionForm action={approveExpense} label={t("confirmReject")}>
            {hidden}
            <input type="hidden" name="decision" value="reject" />
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              {t("reason")}
              <input name="reason" required maxLength={500} />
            </label>
          </ActionForm>
        </details>
      </div>
    </section>
  );
}
