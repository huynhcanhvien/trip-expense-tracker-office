import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { Heading } from "@/app/components/OfficeUI";
import ExpenseEditor from "@/app/components/ExpenseEditor";
import { groupMembersData } from "@/lib/office-data";
export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const t = await getTranslations("newExpense");
  const { groupId } = await params;
  const data = await groupMembersData(groupId);
  if (!data) notFound();
  return (
    <AppShell>
      <Link
        href={`/groups/${groupId}`}
        className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
      >
        ← {data.group.name}
      </Link>
      <Heading
        title={t("createExpense")}
        description={t("youPaidUpfrontSelectThePeople")}
      />
      <div className="mx-auto w-full max-w-3xl">
        <ExpenseEditor
          groupId={groupId}
          currency={data.group.currency}
          members={data.members}
        />
      </div>
    </AppShell>
  );
}
