import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import PublicPage from "../components/PublicPage";
import ContentVi from "./content.vi";
import ContentEn from "./content.en";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policy");
  return { title: t("privacyTitle") };
}
export default async function Page() {
  const [locale, format, t] = await Promise.all([
    getLocale(),
    getFormatter(),
    getTranslations("policy"),
  ]);
  const Content = locale === "en" ? ContentEn : ContentVi;
  const updated = t("updated", {
    date: format.dateTime(new Date("2026-10-05T00:00:00Z"), {
      dateStyle: "long",
    }),
  });
  return (
    <PublicPage>
      <Content updated={updated} />
    </PublicPage>
  );
}
