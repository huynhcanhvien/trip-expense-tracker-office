"use client";
import { useTranslations } from "next-intl";
import { cn } from "./cn";
export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  const tone = ["completed", "confirmed", "approved"].includes(status)
    ? "bg-success-soft text-success"
    : ["cancelled", "rejected"].includes(status)
      ? "bg-danger-soft text-danger"
      : ["reported", "active", "collecting"].includes(status)
        ? "bg-warning-soft text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {t.has(status) ? t(status) : status}
    </span>
  );
}
