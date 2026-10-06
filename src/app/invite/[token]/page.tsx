import { getTranslations } from "next-intl/server";
import Link from "next/link";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import { Heading } from "@/app/components/OfficeUI";
import { officeContext } from "@/lib/office-data";
import { requestJoin } from "@/lib/office-actions";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const t = await getTranslations("invite");
  const { token } = await params;
  const { supabase } = await officeContext(`/invite/${token}`);
  const result = await supabase.rpc("invite_info", { p_token: token });
  const info = (result.error ? null : result.data) as {
    group_id: string;
    name: string;
    status: string;
  } | null;
  return (
    <AppShell>
      <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6 mx-auto w-full max-w-3xl">
        {!info ? (
          <>
            <Heading
              title={t("invitationExpired")}
              description={t("askTheAdministratorForANew")}
            />
            <Link href="/">{t("backToGroups")}</Link>
          </>
        ) : (
          <>
            <Heading eyebrow={t("groupInvitation")} title={info.name} />
            {info.status === "approved" ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                href={`/groups/${info.group_id}`}
              >
                {t("openGroup")}
              </Link>
            ) : info.status === "pending" ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {t("awaitingApproval")}
                </span>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {t("youCanViewTheGroupS")}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {t("sendAJoinRequestForThe")}
                </p>
                <ActionForm
                  action={requestJoin}
                  label={t("requestToJoinGroup")}
                >
                  <input type="hidden" name="token" value={token} />
                </ActionForm>
              </>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
