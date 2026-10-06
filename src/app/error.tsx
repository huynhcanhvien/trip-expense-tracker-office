"use client";
import { useTranslations } from "next-intl";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Card>
        <h1>{t("title")}</h1>
        <p className="mb-6 mt-3 text-muted-foreground">{t("description")}</p>
        <Button onClick={reset}>{common("retry")}</Button>
      </Card>
    </main>
  );
}
