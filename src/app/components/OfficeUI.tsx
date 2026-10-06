import type { ReactNode } from "react";
import Big from "big.js";
import { formatAmount, type CurrencyCode } from "@/lib/currency";
import { EmptyState } from "./ui/empty-state";
export const money = (value: string, currency: string) =>
  formatAmount(new Big(value), currency as CurrencyCode);
export { StatusBadge as Badge } from "./ui/badge";
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex min-w-0 flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="wrap-anywhere">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="max-w-full">{children}</div>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}
