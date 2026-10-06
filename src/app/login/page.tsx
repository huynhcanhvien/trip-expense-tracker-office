import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import LocaleSwitcher from "@/app/components/ui/locale-switcher";
import Link from "next/link";
import AuthForm from "./AuthForm";
import { safeNext, supabaseConfigured } from "@/lib/supabase/config";
import { PolicyLinks } from "../components/PublicPage";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations("login");
  const params = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary-soft p-12 text-primary-soft-foreground lg:flex">
        <Link
          className="flex items-center gap-3 text-lg font-extrabold text-foreground"
          href="/"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet size={24} />
          </span>
          <span>
            {t("officeSplit")}
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
              {t("brandSub")}
            </span>
          </span>
        </Link>
        <div className="my-16 max-w-md space-y-6">
          <p className="mb-2 font-bold uppercase tracking-[0.15em] text-primary text-sm leading-8">
            {t("eyebrow")}
          </p>
          <h2 className="text-4xl leading-snug">
            {t("oneSharedExpense")}
            <br />
            <span>{t("easyForTheWholeGroup")}</span>
          </h2>
          <p className="text-sm leading-8">{t("recordWhatYouPaidSplitIt")}</p>
        </div>
        <p className="text-xs">{t("desktopAndMobilePrivateWithinYour")}</p>
      </aside>
      <main className="mx-auto w-full max-w-xl px-4 py-10 flex flex-col justify-center">
        <div className="mb-5 flex justify-end gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
        <Link
          href="/"
          className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-primary"
        >
          {t("officeSplitLabel")}
        </Link>
        <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
          <h1>{t("splitCostsEasily")}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t("recordExpensesTogetherAndConfirmRepayments")}
          </p>
          {!supabaseConfigured() ? (
            <div
              className="mt-5 space-y-3 rounded-xl bg-warning-soft p-4 text-sm text-warning"
              role="status"
            >
              <h2>{t("applicationSetup")}</h2>
              <p>
                {t("create")} <code>.env.local</code> {t("from")}{" "}
                <code>.env.example</code>
                {t("fillInTheSupabaseURLAnd")}
              </p>
              <p>{t("seeTheREADMEToConfigureSign")}</p>
            </div>
          ) : (
            <AuthForm
              next={safeNext(params.next)}
              initialError={
                params.error ? t("thisSignInLinkIsInvalid") : undefined
              }
              message={
                params.password === "updated"
                  ? t("passwordChangedSignInAgainTo")
                  : undefined
              }
            />
          )}
        </section>
        <PolicyLinks />
      </main>
    </div>
  );
}
