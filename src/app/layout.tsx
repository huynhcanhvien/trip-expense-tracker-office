import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Providers from "./components/Providers";
import "./globals.css";
const display = localFont({
  variable: "--font-display",
  src: [
    {
      path: "./fonts/be-vietnam-pro-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/be-vietnam-pro-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "optional",
  adjustFontFallback: "Arial",
});
const code = Geist_Mono({
  variable: "--font-code",
  preload: false,
  subsets: ["latin"],
  display: "swap",
});
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("title"), description: t("description") };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  // Server-only page copy stays on the server. Ship the namespaces used by client controls.
  const clientMessages = Object.fromEntries(
    [
      "auth",
      "password",
      "errors",
      "common",
      "statistics",
      "savedImage",
      "upload",
      "editor",
      "deleteGroup",
      "nav",
      "bank",
      "scanner",
      "locale",
      "theme",
      "status",
    ].map((key) => [key, messages[key]]),
  );
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${display.variable} ${code.variable}`}
    >
      <body className="app-backdrop">
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
