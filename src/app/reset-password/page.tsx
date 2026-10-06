import { getTranslations } from "next-intl/server";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import LocaleSwitcher from "@/app/components/ui/locale-switcher";
import { requireUser } from "@/lib/supabase/server";
import PasswordForm from "./PasswordForm";

export default async function ResetPassword() {
  const t = await getTranslations("resetPassword");
  await requireUser("/reset-password");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <div className="mb-5 flex justify-end gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <section className="mt-5 min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6">
        <h1>{t("resetPassword")}</h1>
        <PasswordForm />
      </section>
    </main>
  );
}
