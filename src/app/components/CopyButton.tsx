"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
export default function CopyButton({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const t = useTranslations("common");
  const [result, setResult] = useState<"copied" | "copyError" | null>(null);
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              value.startsWith("/") ? `${location.origin}${value}` : value,
            );
            setResult("copied");
          } catch {
            setResult("copyError");
          }
        }}
      >
        {result === "copied" ? <Check /> : <Copy />}
        {label || t("copy")}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {result && t(result)}
      </span>
    </span>
  );
}
