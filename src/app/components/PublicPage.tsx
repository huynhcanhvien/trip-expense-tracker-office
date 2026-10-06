import Link from "next/link";
import type { ReactNode } from "react";
import { Wallet, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import ThemeToggle from "./ui/theme-toggle";
import LocaleSwitcher from "./ui/locale-switcher";
import { buttonVariants } from "./ui/button";
export const supportEmail = "huynhcanhvien@gmail.com";
export async function PolicyLinks() {
  const t = await getTranslations("public");
  return (
    <nav
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      aria-label={t("links")}
    >
      <Link
        href="/"
        className="inline-flex min-h-11 min-w-11 items-center hover:text-primary"
      >
        {t("about")}
      </Link>
      <Link
        href="/privacy"
        className="inline-flex min-h-11 min-w-11 items-center hover:text-primary"
      >
        {t("privacy")}
      </Link>
      <Link
        href="/terms"
        className="inline-flex min-h-11 min-w-11 items-center hover:text-primary"
      >
        {t("terms")}
      </Link>
      <a
        href={`mailto:${supportEmail}`}
        className="inline-flex min-h-11 min-w-11 items-center hover:text-primary"
      >
        {t("support")}
      </a>
    </nav>
  );
}
export default async function PublicPage({
  children,
}: {
  children: ReactNode;
}) {
  const [t, shell, common, metadata] = await Promise.all([
    getTranslations("public"),
    getTranslations("shell"),
    getTranslations("common"),
    getTranslations("metadata"),
  ]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <a
        className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-surface-raised px-4 py-3 shadow-lift focus:translate-y-0"
        href="#main-content"
      >
        {common("skip")}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-8">
        <Link
          className="flex items-center gap-3 text-lg font-extrabold text-foreground"
          href="/"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet size={24} />
          </span>
          <span>
            {shell("brand")}
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
              {shell("brandSub")}
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            {t("login")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>
      <main className="min-w-0 flex-1 px-4 pb-8 sm:px-8" id="main-content">
        {children}
      </main>
      <footer className="mx-4 flex flex-wrap items-center justify-between gap-6 border-t py-8 text-sm text-muted-foreground sm:mx-8">
        <div>
          <strong>{metadata("title")}</strong>
          <p className="mt-2 text-xs">{t("tagline")}</p>
        </div>
        <PolicyLinks />
      </footer>
    </div>
  );
}
