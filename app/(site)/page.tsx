import Link from "next/link";
import BlacklistBoard from "@/components/BlacklistBoard";
import DuelCard from "@/components/DuelCard";
import Reveal from "@/components/Reveal";
import { getBlacklist, getLatestDuels, getNews, getRewards } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function Home() {
  const [{ t, locale }, list, rewards, duels, news] = await Promise.all([getI18n(), getBlacklist(), getRewards(), getLatestDuels(3), getNews(3)]);
  const steps = [
    ["01", t("S'INSCRIRE"), t("Engage ton véhicule. Il doit être homologué par l'organisation avant de rouler.")],
    ["02", "WARM-UP RACE", t("Chaque dimanche, une course d'entrée. Seul le vainqueur débloque la position #10.")],
    ["03", t("DÉFIER"), t("Tu ne peux défier que le pilote juste au-dessus de toi. Un défi par semaine. Il a 48 h pour fixer le duel.")],
    ["04", t("PRENDRE LA PLACE"), t("Le vainqueur prend le rang et le Cash Prize du boss battu. Au podium, c'est le meilleur des 3 manches.")],
  ];
  return (
    <>
      <header className="relative isolate flex min-h-screen items-end overflow-hidden pb-24 pt-32">
        <div className="push-in absolute inset-0 -z-20 bg-cover bg-[position:center_30%]" style={{ backgroundImage: "url(/img/hero.jpg)" }} />
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg,#090A0C99 0%,#090A0C40 30%,#090A0Cd9 78%,#090A0C 100%),linear-gradient(90deg,#090A0Cd0 0%,transparent 60%)" }} />
        <div className="wrap">
          <div className="font-cond mb-4 flex items-center gap-3.5 text-sm font-semibold tracking-[.42em] text-metal before:h-0.5 before:w-11 before:bg-red">BOOBOO CREW PRESENTS</div>
          <h1 className="font-display text-[clamp(72px,15vw,210px)] uppercase leading-[.86] tracking-[.015em] [text-shadow:0_6px_40px_#000a]">
            Blacklist
            <span className="mt-[.15em] block text-[.42em] leading-none tracking-[.34em] text-red">LOS SANTOS</span>
          </h1>
          <div className="font-marker slash mb-9 mt-6 -rotate-[1.2deg] pb-2.5 text-[clamp(22px,3.1vw,38px)]">10 DRIVERS. 10 POSITIONS. ONE KING.</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/register" className="btn btn-red">{t("REJOINDRE LA BLACKLIST")}</Link>
            <Link href="/blacklist" className="btn btn-ghost">{t("VOIR LE CLASSEMENT")}</Link>
          </div>
        </div>
      </header>

      <section className="py-24">
        <div className="wrap">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div><div className="kicker mb-2.5">{t("LA BLACKLIST — SAISON 1")}</div><h2 className="h2">{t("Le classement")} <em>{t("officiel")}</em></h2></div>
            <Link href="/blacklist" className="font-cond text-sm font-semibold tracking-[.2em] text-metal hover:text-white">{t("VOIR LES 10 PILOTES")} →</Link>
          </Reveal>
          <BlacklistBoard initial={list.slice(0, 5)} rewards={rewards} base="/blacklist" />
          {list.every((r) => !r.driver_id) && <p className="mt-5 text-sm text-metal">{t("La Blacklist est vide : les premières places seront attribuées après la Warm-up Race.")}</p>}
        </div>
      </section>

      <section className="bg-gradient-to-b from-ink to-[#0c0d10] py-24">
        <div className="wrap">
          <Reveal className="mb-10"><div className="kicker mb-2.5">{t("LE RÈGLEMENT")}</div><h2 className="h2">{t("Comment")} <em>{t("ça marche")}</em></h2></Reveal>
          <Reveal className="grid gap-0.5 bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, ti, p]) => (
              <div key={n} className="group bg-ink2 p-8 transition hover:bg-[#1a1114]">
                <b className="font-display mb-2.5 block text-7xl leading-none text-red-dark transition group-hover:text-red">{n}</b>
                <h3 className="h3 mb-2 text-[21px]">{ti}</h3>
                <p className="text-sm text-[#a5a9b0]">{p}</p>
              </div>
            ))}
          </Reveal>
          <div className="font-cond mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm tracking-[.14em] text-metal">
            {[t("UN SEUL VÉHICULE ENGAGÉ"), t("TOP 3 : LE VÉHICULE SE PERD"), t("14 JOURS SANS DUEL = SANCTION")].map((x) => (
              <span key={x} className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">{x}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="wrap">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div><div className="kicker mb-2.5">{t("DERNIÈRES CONFRONTATIONS")}</div><h2 className="h2">{t("Sur")} <em>{t("l'asphalte")}</em></h2></div>
          </Reveal>
          {duels.length ? (
            <Reveal className="grid gap-4 md:grid-cols-3">{duels.map((d) => <DuelCard key={d.id} d={d} />)}</Reveal>
          ) : <p className="panel text-[#a5a9b0]">{t("Aucune confrontation pour le moment. Le premier défi de la saison arrive bientôt.")}</p>}
        </div>
      </section>

      <section className="relative isolate flex min-h-[420px] items-center">
        <div className="absolute inset-0 -z-20 bg-cover bg-[position:85%_40%]" style={{ backgroundImage: "url(/img/hero.jpg)" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-10% via-ink/70 to-ink/55" />
        <div className="wrap">
          <Reveal className="max-w-[520px] py-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo.jpg" alt="Booboo Crew" width={224} height={224} loading="lazy" className="-ml-7 w-56" style={{ maskImage: "radial-gradient(circle,#000 55%,transparent 72%)", WebkitMaskImage: "radial-gradient(circle,#000 55%,transparent 72%)" }} />
            <div className="kicker mb-2.5">A BOOBOO CREW PRODUCTION</div>
            <h2 className="h2">{t("Une famille.")}<br />{t("Une passion.")}<br /><em>{t("Un crew.")}</em></h2>
            <p className="my-4 mb-6 text-[#bdbfc4]">{t("De Los Santos à Detroit, et retour. Oby et Coby ont bâti la BBC sur la loyauté, la vitesse et la famille. La Blacklist est leur règle du jeu.")}</p>
            <Link href="/crew" className="btn btn-ghost">{t("DÉCOUVRIR LE CREW")}</Link>
          </Reveal>
        </div>
      </section>

      <section className="py-24">
        <div className="wrap">
          <Reveal className="mb-10"><div className="kicker mb-2.5">{t("ACTUALITÉS DE L'ORGANISATION")}</div><h2 className="h2">{t("Le")} <em>{t("bulletin")}</em></h2></Reveal>
          {news.length ? (
            <Reveal className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <article className="border-l-[3px] border-red bg-ink2 p-8">
                <time className="font-cond text-xs tracking-[.25em] text-metal">{dateOnly(news[0].published_at, locale)}</time>
                <h3 className="font-display my-2.5 text-[34px] uppercase">{news[0].title}</h3>
                <p className="whitespace-pre-line text-[15px] text-[#a5a9b0]">{news[0].body}</p>
              </article>
              <div className="grid gap-4">
                {news.slice(1).map((n) => (
                  <article key={n.id} className="border-l-[3px] border-red bg-ink2 px-7 py-6">
                    <time className="font-cond text-xs tracking-[.25em] text-metal">{dateOnly(n.published_at, locale)}</time>
                    <h3 className="font-display my-2 text-[22px] uppercase">{n.title}</h3>
                    <p className="line-clamp-3 whitespace-pre-line text-sm text-[#a5a9b0]">{n.body}</p>
                  </article>
                ))}
              </div>
            </Reveal>
          ) : <p className="panel text-[#a5a9b0]">{t("Aucune annonce publiée.")}</p>}
        </div>
      </section>
    </>
  );
}
