import type { ComponentProps } from "react";
import { cn } from "./cn";
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border bg-surface p-5 shadow-soft sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
      {...props}
    />
  );
}
