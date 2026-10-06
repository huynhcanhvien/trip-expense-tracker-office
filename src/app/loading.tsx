import { getTranslations } from "next-intl/server";
import { Skeleton } from "./components/ui/skeleton";
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <main
      className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10"
      role="status"
      aria-label={t("loading")}
    >
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-5 w-3/4" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton className="h-28" key={i} />
        ))}
      </div>
      <Skeleton className="h-80" />
    </main>
  );
}
