import Link from "next/link";
import type { ReactNode } from "react";
import { Wallet, Receipt, ArrowRight, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/lib/supabase/server";
import { unreadNotifications } from "@/lib/office-data";
import { PolicyLinks } from "./PublicPage";
import AppNavigation, { MobileTabBar } from "./AppNavigation";
import ThemeToggle from "./ui/theme-toggle";
import LocaleSwitcher from "./ui/locale-switcher";
import { buttonVariants } from "./ui/button";
export default async function AppShell({ children }: { children: ReactNode }) {
  const [{ user }, count, t, common] = await Promise.all([
    requireUser(),
    unreadNotifications(),
    getTranslations("shell"),
    getTranslations("common"),
  ]);
  const name = String(
    user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      t("fallbackName"),
  );
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(-2)
    .join("")
    .toUpperCase();
  return (
    <div className="min-h-dvh">
      <a
        className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-surface-raised px-4 py-3 shadow-lift focus:translate-y-0"
        href="#main-content"
      >
        {common("skip")}
      </a>
      <aside className="fixed inset-y-4 left-4 z-40 hidden w-64 flex-col overflow-hidden rounded-2xl border bg-surface p-5 shadow-soft lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Link
            href="/"
            className="flex items-center gap-3 text-lg font-extrabold text-foreground"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Wallet size={24} />
            </span>
            <span>
              {t("brand")}
              <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
                {t("brandSub")}
              </span>
            </span>
          </Link>
          <p className="mb-4 mt-10 text-[10px] font-bold tracking-widest text-muted-foreground">
            {t("yourSpace")}
          </p>
          <AppNavigation count={count || 0} />
          <div className="mt-8 rounded-2xl bg-accent-soft p-5 text-accent-soft-foreground">
            <Receipt className="mb-3" size={26} />
            <strong className="text-sm">{t("tipTitle")}</strong>
            <p className="mt-2 text-xs leading-6">{t("tipText")}</p>
            <Link
              href="/"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold"
            >
              {t("yourGroups")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="shrink-0 bg-surface pt-4">
          <div className="flex min-w-0 items-center gap-3 border-t py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm">{name}</strong>
              <span className="text-xs text-muted-foreground">
                {t("account")}
              </span>
            </div>
          </div>
          <form action={signOut}>
            <button className={buttonVariants({ variant: "ghost" })}>
              <LogOut />
              {common("signOut")}
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-8 lg:border-0">
          <Link
            href="/"
            aria-label={t("brand")}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-sm font-bold lg:hidden"
          >
            <Wallet className="shrink-0 text-primary" size={23} />
            <span className="hidden sm:inline">{t("brand")}</span>
          </Link>
          <span className="hidden text-sm text-muted-foreground lg:inline">
            {t("workspace")}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
            <Link
              href="/profile"
              aria-label={common("profile")}
              className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground min-[375px]:flex"
            >
              <span aria-hidden="true">{initials}</span>
            </Link>
            <form action={signOut} className="lg:hidden">
              <button
                type="submit"
                aria-label={common("signOut")}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <LogOut />
              </button>
            </form>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 p-4 pb-8 sm:p-8"
        >
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 pb-32 pt-8 text-xs text-muted-foreground sm:px-8 lg:pb-8">
          <span>{t("footer")}</span>
          <PolicyLinks />
        </footer>
      </div>
      <MobileTabBar count={count || 0} />
    </div>
  );
}
