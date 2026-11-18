import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Flame, Swords, Trophy } from "lucide-react";
import PageHead from "@/components/PageHead";
import { getHallData } from "@/lib/hall";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Hall of Fame" };
export const dynamic = "force-dynamic";

export default async function HallOfFame() {
  const [{ t, locale }, h] = await Promise.all([getI18n(), getHallData()]);
  const rec = (icon: React.ReactNode, label: string, big: string, who?: { id: string; name: string } | null, sub?: string) => (
    <div className="hof-card">
      <div className="hof-icon" aria-hidden>{icon}</div>
      <div className="label !mb-0">{label}</div>
      <div className="font-display text-5xl leading-none">{big}</div>
      {who ? <Link href={`/blacklist/${who.id}`} className="font-cond mt-1 block truncate text-lg font-bold uppercase tracking-wide hover:text-red">{who.name}</Link> : <div className="font-cond mt-1 text-metal">—</div>}
      {sub && <div className="font-cond text-xs tracking-[.14em] text-metal">{sub}</div>}
    </div>
  );
  return (
    <>
      <PageHead kicker={t("LES LÉGENDES")} title="Hall of" em="Fame">{t("Les rois qui se sont succédé sur le trône et les records de la Blacklist.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          {h.currentKing && (
            <div className="king-card mb-10 flex flex-wrap items-center justify-between gap-6 px-8 py-8">
              <div>
                <div className="font-cond mb-2 flex items-center gap-2 text-xs font-bold tracking-[.3em] text-red"><Crown size={16} /> {t("LE ROI ACTUEL")}</div>
                <Link href={`/blacklist/${h.currentKing.id}`} className="font-display text-5xl uppercase hover:text-red sm:text-6xl">{h.currentKing.name}</Link>
              </div>
              <div className="text-right"><div className="font-display text-5xl text-red">{h.currentKing.days}</div><div className="label !mb-0">{t("jour(s) sur le trône")}</div></div>
            </div>
          )}

          <div className="kicker mb-3">{t("RECORDS")}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rec(<Flame size={22} />, t("Plus longue série de victoires"), h.bestStreak ? String(h.bestStreak.n) : "—", h.bestStreak?.who)}
            {rec(<Trophy size={22} />, t("Plus de victoires en duel"), h.mostWins ? String(h.mostWins.n) : "—", h.mostWins?.who)}
            {rec(<Swords size={22} />, t("Plus de duels disputés"), h.mostDuels ? String(h.mostDuels.n) : "—", h.mostDuels?.who)}
            {rec(<Crown size={22} />, t("Règne le plus long"), h.longestReign ? `${h.longestReign.days} ${t("j")}` : "—", h.longestReign?.who)}
          </div>
          {h.topPrize ? <p className="font-cond mt-4 text-sm tracking-[.14em] text-metal">{t("Cash Prize du #1 à remporter")} : <b className="text-red">{h.topPrize}</b></p> : null}

          <div className="kicker mb-3 mt-14">{t("LES ROIS DE LA BLACKLIST")}</div>
          {h.kings.length ? (
            <ol className="hof-list">
              {h.kings.map((k, i) => (
                <li key={`${k.id}-${i}`} className="hof-row">
                  <span className="font-display text-4xl text-red">{h.kings.length - i}</span>
                  <div className="min-w-0"><Link href={`/blacklist/${k.id}`} className="font-cond block truncate text-2xl font-bold uppercase tracking-wide hover:text-red">{k.name}</Link><span className="font-cond text-sm tracking-[.12em] text-metal">{dateOnly(k.since, locale)}{k.current ? ` — ${t("règne en cours")}` : ` — ${dateOnly(k.until, locale)}`}</span></div>
                  <span className="badge badge-metal">{k.days} {t("jour(s)")}</span>
                </li>
              ))}
            </ol>
          ) : <p className="panel text-[#a5a9b0]">{t("Aucun roi pour le moment : le trône est vacant.")}</p>}
        </div>
      </section>
    </>
  );
}
