import type { Metadata, Viewport } from "next";
import "@fontsource/anton";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/permanent-marker";
import "./globals.css";
import LangProvider from "@/components/LangProvider";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "BLACKLIST — Booboo Crew", template: "%s — BLACKLIST" },
  description: "10 drivers. 10 positions. One king. A BOOBOO CREW PRODUCTION.",
  icons: { icon: "/img/favicon.png" },
};
export const viewport: Viewport = { themeColor: "#090A0C" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body><LangProvider lang={lang}>{children}</LangProvider></body>
    </html>
  );
}
