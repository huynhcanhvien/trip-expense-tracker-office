import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
const control =
  "min-h-11 w-full min-w-0 rounded-xl border border-input bg-surface-raised px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-ring disabled:opacity-50";
export function Field({
  label,
  children,
  className,
  ...props
}: ComponentProps<"label"> & { label: ReactNode }) {
  return (
    <label
      className={cn("flex flex-col gap-2 text-sm font-medium", className)}
      {...props}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return <select className={cn(control, className)} {...props} />;
}
