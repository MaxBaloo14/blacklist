import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const t = await getT();
  return (
    <>
      <Nav />
      <main className="relative flex min-h-screen items-center overflow-hidden pt-20">
        <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-30" style={{ backgroundImage: "url(/img/hero-1600.webp)" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/90" />
        <div className="wrap">
          <div className="kicker mb-3">{t("ERREUR 404")}</div>
          <h1 className="font-display text-[clamp(90px,20vw,240px)] leading-[.85]">{t("IMPASSE")}</h1>
          <p className="font-marker slash my-6 text-3xl">{t("Cette route n'existe pas à Los Santos.")}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/" className="btn btn-red">{t("RETOUR AUX RUES")}</Link>
            <Link href="/blacklist" className="btn btn-ghost">{t("VOIR LE CLASSEMENT")}</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
