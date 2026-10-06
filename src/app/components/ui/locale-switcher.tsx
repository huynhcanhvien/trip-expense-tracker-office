"use client";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { LOCALES } from "@/i18n/config";
export default function LocaleSwitcher({ label }: { label?: string }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <Languages
        size={17}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 text-muted-foreground"
      />
      <select
        aria-label={label || t("label")}
        className="min-h-11 w-28 min-[375px]:w-36 cursor-pointer rounded-xl border border-transparent bg-transparent py-2 pl-8 pr-2 text-sm hover:bg-muted disabled:opacity-50"
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            try {
              setFailed(false);
              await setLocale(next);
              router.refresh();
            } catch {
              setFailed(true);
            }
          });
        }}
      >
        {LOCALES.map((value) => (
          <option value={value} key={value}>
            {t(value)}
          </option>
        ))}
      </select>
      {failed && (
        <span role="alert" className="text-xs text-danger">
          {t("error")}
        </span>
      )}
    </div>
  );
}
