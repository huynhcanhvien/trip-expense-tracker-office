"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ChartColumn, Bell, User, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "./ui/cn";
import type { InboxCounts } from "@/lib/office-types";
const items = [
  { href: "/", key: "groups", Icon: Users },
  { href: "/statistics", key: "statistics", Icon: ChartColumn },
  { href: "/notifications", key: "notifications", Icon: Bell },
  { href: "/profile", key: "profile", Icon: User },
];
export default function AppNavigation({
  counts,
  mobile = false,
}: {
  counts: InboxCounts;
  mobile?: boolean;
}) {
  const count = counts.unread;
  const actions = counts.toPay + counts.approvals;
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("label")}
      data-testid={mobile ? "mobile-tab-bar" : "desktop-navigation"}
      className={cn(
        mobile
          ? "grid grid-cols-4 gap-1 rounded-full border bg-surface/95 p-2 shadow-lift backdrop-blur-xl"
          : "flex flex-col gap-2",
      )}
    >
      {items.map(({ href, key, Icon }) => {
        const active =
          href === "/"
            ? pathname === "/" ||
              /^\/(groups|expenses|invite)(\/|$)/.test(pathname)
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
              mobile
                ? "flex-col justify-center gap-1 rounded-full px-1 py-2 text-[11px]"
                : "px-4 py-3",
              active
                ? "bg-primary-soft text-primary-soft-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{t(key)}</span>
            {href === "/notifications" && count > 0 && (
              <span
                aria-label={t("unread", { count })}
                className={cn(
                  "tabular rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground",
                  mobile ? "absolute right-2 top-0" : "ml-auto",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
            {href === "/notifications" && actions > 0 && (
              <span
                aria-label={t("actionsNeeded", {
                  toPay: counts.toPay,
                  approvals: counts.approvals,
                })}
                title={t("actionsNeeded", {
                  toPay: counts.toPay,
                  approvals: counts.approvals,
                })}
                className={cn(
                  "tabular rounded-full bg-warning-soft px-1.5 text-[10px] font-bold text-warning ring-1 ring-warning/40",
                  mobile ? "absolute left-2 top-0" : count > 0 ? "" : "ml-auto",
                )}
              >
                {actions > 99 ? "99+" : actions}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
export function MobileTabBar({ counts }: { counts: InboxCounts }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const groupId = pathname.match(/^\/groups\/([^/]+)$/)?.[1];
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-3 z-40 mx-auto max-w-md pb-safe lg:hidden">
      {groupId && (
        <nav aria-label={t("groupActions")}>
          <Link
            href={`/groups/${groupId}/expenses/new`}
            className="pointer-events-auto absolute -top-16 right-1 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lift"
          >
            <Plus size={20} />
            {t("addExpense")}
          </Link>
        </nav>
      )}
      <div className="pointer-events-auto">
        <AppNavigation counts={counts} mobile />
      </div>
    </div>
  );
}
