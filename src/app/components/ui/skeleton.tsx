import type { ComponentProps } from "react";
import { cn } from "./cn";
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-muted", className)}
      {...props}
    />
  );
}
