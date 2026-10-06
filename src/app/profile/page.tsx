import ThemeToggle from "@/app/components/ui/theme-toggle";
import LocaleSwitcher from "@/app/components/ui/locale-switcher";
import { getTranslations } from "next-intl/server";
import AppShell from "@/app/components/AppShell";
import ActionForm from "@/app/components/ActionForm";
import BankEditor from "@/app/components/BankEditor";
import { Heading } from "@/app/components/OfficeUI";
import { officeContext, checked } from "@/lib/office-data";
import { saveProfile } from "@/lib/office-actions";
import type { BankAccount } from "@/lib/office-types";
export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const { supabase, user } = await officeContext();
  const [profile, bank] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("bank_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  return (
    <AppShell>
      <Heading
        title={t("yourProfile")}
        description={t("bankDetailsHelpColleaguesRepayExpenses")}
      />
      <section className="mb-6 mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
        <h2>{t("preferences")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {t("preferencesDescription")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ThemeToggle label={t("themeChoice")} />
          <LocaleSwitcher label={t("languageChoice")} />
        </div>
      </section>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
          <h2>{t("account")}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {user.email}
          </p>
          <ActionForm action={saveProfile} label={t("saveName")}>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              {t("displayName")}
              <input
                name="name"
                defaultValue={checked(profile)?.name || ""}
                required
                maxLength={100}
              />
            </label>
          </ActionForm>
        </section>
        <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
          <h2>{t("bankAccount")}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t("membersOfGroupsWithExpensesYou")}
          </p>
          <BankEditor bank={checked(bank) as BankAccount | null} />
        </section>
      </div>
    </AppShell>
  );
}
