import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Geist / Geist Mono: a clean neo-grotesque pairing that echoes the OpenAI
// "Supply Co." aesthetic — a crisp humanist sans for display + body, and a
// monospace used for the small uppercase eyebrow / section labels. Both are
// variable fonts, so the full weight range is available.
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trip Splitter",
  description: "Split trip expenses with friends — track who paid and who owes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
