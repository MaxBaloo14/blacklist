import Link from "next/link";
import { Flag, MapPinned, ScrollText, Newspaper, Trophy, ArrowUpRight } from "lucide-react";
import { getT } from "@/lib/i18n";

/** Accueil volontairement léger : un titre, deux boutons, puis les rubriques. Tout le reste est dans les pages dédiées. */
export default async function HomeView() {
  const t = await getT();
  const tiles = [
    { href: "/blacklist", icon: Trophy, title: t("LA BLACKLIST"), text: t("Le classement officiel des 10 pilotes") },
    { href: "/race-network", icon: MapPinned, title: t("CIRCUITS"), text: t("Les tracés officiels du réseau") },
    { href: "/warmup", icon: Flag, title: "WARM-UP RACE", text: t("La course d'entrée du dimanche") },
    { href: "/rules", icon: ScrollText, title: t("RÈGLEMENT"), text: t("Défis, podium et Cash Prize") },
    { href: "/news", icon: Newspaper, title: t("ACTUALITÉS"), text: t("Les annonces de l'organisation") },
  ];
  return (
    <>
      <header className="relative isolate flex min-h-[72vh] items-end overflow-hidden pb-14 pt-32">
        <div className="push-in absolute inset-0 -z-20 bg-cover bg-[position:center_30%]" style={{ backgroundImage: "url(/img/hero.webp)" }} />
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg,#090A0C99 0%,#090A0C40 30%,#090A0Cd9 82%,#090A0C 100%),linear-gradient(90deg,#090A0Cd0 0%,transparent 60%)" }} />
        <div className="wrap">
          <h1 className="font-display text-[clamp(72px,14vw,190px)] uppercase leading-[.86] tracking-[.015em] [text-shadow:0_6px_40px_#000a]">
            Blacklist
            <span className="mt-[.15em] block text-[.4em] leading-none tracking-[.34em] text-red">LOS SANTOS</span>
          </h1>
          <div className="font-marker slash mb-9 mt-6 -rotate-[1.2deg] pb-2.5 text-[clamp(20px,2.8vw,34px)]">10 DRIVERS. 10 POSITIONS. ONE KING.</div>
          <div><Link href="/register" className="btn btn-red">{t("REJOINDRE LA BLACKLIST")}</Link></div>
        </div>
      </header>

      <nav aria-label={t("Rubriques")} className="pb-24 pt-2">
        <div className="wrap grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="group relative flex min-h-[150px] flex-col justify-between border border-white/10 bg-ink2 p-5 transition duration-200 hover:-translate-y-1 hover:border-red hover:bg-[#1a1114]">
              <div className="flex items-start justify-between">
                <Icon size={22} className="text-red" strokeWidth={1.75} />
                <ArrowUpRight size={18} className="text-metal transition group-hover:text-white" />
              </div>
              <div>
                <div className="font-display text-2xl uppercase leading-tight tracking-wide">{title}</div>
                <p className="mt-1 text-[13px] leading-snug text-[#a5a9b0]">{text}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="wrap mt-10 text-center">
          <Link href="/crew" className="font-cond text-xs font-semibold tracking-[.25em] text-metal transition hover:text-white sm:text-sm sm:tracking-[.3em]">A BOOBOO CREW PRODUCTION · {t("DÉCOUVRIR LE CREW")} →</Link>
        </p>
      </nav>
    </>
  );
}
