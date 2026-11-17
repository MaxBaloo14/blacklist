import Link from "next/link";
import HeroBackdrop from "@/components/HeroBackdrop";
import Tile from "@/components/Tile";
import { getT } from "@/lib/i18n";
import { DISCORD_URL } from "@/lib/links";

/** Accueil volontairement léger : un titre, un bouton, puis les rubriques. Tout le reste est dans les pages dédiées. */
export default async function HomeView() {
  const t = await getT();
  const tiles = [
    { href: "/blacklist", icon: "trophy", title: t("LA BLACKLIST"), text: t("Le classement officiel des 10 pilotes") },
    { href: "/race-network", icon: "map", title: t("CIRCUITS"), text: t("Les tracés officiels du réseau") },
    { href: "/warmup", icon: "flag", title: "WARM-UP RACE", text: t("La course d'entrée du dimanche") },
    { href: "/news", icon: "news", title: t("ACTUALITÉS"), text: t("Les annonces de l'organisation") },
    { href: DISCORD_URL, icon: "discord", title: "DISCORD", text: t("Rejoins la BBC sur Discord"), external: true },
  ] as const;
  const letters = [..."BLACKLIST"];
  return (
    <>
      <header className="relative isolate flex min-h-[72vh] items-end overflow-hidden pb-14 pt-32">
        <HeroBackdrop />
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg,#090A0C99 0%,#090A0C40 30%,#090A0Cd9 82%,#090A0C 100%),linear-gradient(90deg,#090A0Cd0 0%,transparent 60%)" }} />
        <div className="wrap">
          <h1 className="font-display text-[clamp(72px,14vw,190px)] uppercase leading-[.86] tracking-[.015em] [text-shadow:0_6px_40px_#000a]" aria-label="Blacklist Los Santos">
            <span aria-hidden>{letters.map((c, i) => <span key={i} className="hl" style={{ "--i": i } as React.CSSProperties}>{c}</span>)}</span>
            <span aria-hidden className="hero-sub mt-[.15em] block text-[.4em] leading-none tracking-[.34em] text-red">LOS SANTOS</span>
          </h1>
          <div className="hero-slogan font-marker slash mb-9 mt-6 -rotate-[1.2deg] pb-2.5 text-[clamp(20px,2.8vw,34px)]">10 DRIVERS. 10 POSITIONS. ONE KING.</div>
          <div><Link href="/register" className="hero-cta btn btn-red">{t("REJOINDRE LA BLACKLIST")}</Link></div>
        </div>
      </header>

      <nav aria-label={t("Rubriques")} className="pb-24 pt-2">
        <div className="wrap grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((x, i) => <Tile key={x.href} index={i} {...x} />)}
        </div>
        <p className="wrap mt-10 text-center">
          <Link href="/crew" className="font-cond text-xs font-semibold tracking-[.25em] text-metal transition hover:text-white sm:text-sm sm:tracking-[.3em]">A BOOBOO CREW PRODUCTION · {t("DÉCOUVRIR LE CREW")} →</Link>
        </p>
      </nav>
    </>
  );
}
