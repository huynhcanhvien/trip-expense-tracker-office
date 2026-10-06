import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PublicPage from "./components/PublicPage";
import { buttonVariants } from "./components/ui/button";
import { Card } from "./components/ui/card";
export default async function NotFound() {
  const [t, common] = await Promise.all([
    getTranslations("errors"),
    getTranslations("common"),
  ]);
  return (
    <PublicPage>
      <Card className="mx-auto my-12 max-w-xl">
        <h1>{t("notFound")}</h1>
        <p className="mb-6 mt-3 text-muted-foreground">
          {t("notFoundDescription")}
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {common("back")}
        </Link>
      </Card>
    </PublicPage>
  );
}
