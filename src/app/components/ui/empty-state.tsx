import { Receipt } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      <span className="rounded-2xl bg-accent-soft p-3 text-accent-soft-foreground">
        <Receipt size={26} />
      </span>
      <div className="max-w-md leading-7">{children}</div>
    </div>
  );
}
