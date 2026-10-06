import type { ReactNode } from "react";
export function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border bg-surface p-5 shadow-soft">
      {icon && (
        <span className="rounded-xl bg-primary-soft p-3 text-primary-soft-foreground">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className="tabular mt-1 block text-2xl font-bold">
          {value}
        </strong>
      </div>
    </div>
  );
}
