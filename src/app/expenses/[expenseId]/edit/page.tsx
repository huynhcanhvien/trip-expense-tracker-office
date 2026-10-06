import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import { Heading } from "@/app/components/OfficeUI";
import ExpenseEditor from "@/app/components/ExpenseEditor";
import { expenseData, groupMembersData } from "@/lib/office-data";
import { editMetadata } from "@/lib/office-actions";
export default async function EditPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const t = await getTranslations("editExpense");
  const { expenseId } = await params;
  const data = await expenseData(expenseId);
  if (
    !data ||
    data.expense.creator_id !== data.user.id ||
    data.expense.status === "cancelled"
  )
    notFound();
  const members = data.expense.has_reported
    ? []
    : (await groupMembersData(data.group.id))?.members;
  if (!members) notFound();
  return (
    <AppShell>
      <Link
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
        href={`/expenses/${expenseId}`}
      >
        {t("expenseDetails")}
      </Link>
      <Heading
        title={t("editExpense")}
        description={
          data.expense.has_reported
            ? t("aTransferHasBeenReportedOnly")
            : t("youCanEditSharesUntilThe")
        }
      />
      <div className="mx-auto w-full max-w-3xl">
        {data.expense.has_reported ? (
          <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
            <ActionForm action={editMetadata} label={t("saveChanges")}>
              <input type="hidden" name="expenseId" value={expenseId} />
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                {t("description")}
                <input
                  name="description"
                  defaultValue={data.expense.description}
                  required
                  maxLength={300}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                {t("expenseDate")}
                <input
                  name="expenseDate"
                  type="date"
                  defaultValue={data.expense.expense_date}
                  required
                />
              </label>
            </ActionForm>
          </section>
        ) : (
          <ExpenseEditor
            groupId={data.group.id}
            currency={data.group.currency}
            members={members}
            expense={data.expense}
            shares={data.shares}
          />
        )}
      </div>
    </AppShell>
  );
}
