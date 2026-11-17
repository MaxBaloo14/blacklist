import type { Metadata, Viewport } from "next";
import "@fontsource/anton";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/permanent-marker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BLACKLIST — Booboo Crew", template: "%s — BLACKLIST" },
  description: "10 drivers. 10 positions. One king. Le réseau de courses clandestines de Los Santos. A BOOBOO CREW PRODUCTION.",
  icons: { icon: "/img/logo.jpg" },
};
export const viewport: Viewport = { themeColor: "#090A0C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
