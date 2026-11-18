import Reveal from "@/components/Reveal";
import DuelCard from "@/components/DuelCard";
import DuelTimeline from "@/components/DuelTimeline";
import PageHead from "@/components/PageHead";
import PilotBadges from "@/components/PilotBadges";
import { driverBadges } from "@/lib/badges";
import { bestRank, daysSince, driverStats } from "@/lib/driver-stats";
import { dateOnly, photoUrl } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

/** Fiche publique d'un pilote : identité, véhicule, statistiques, forme récente, parcours dans la Blacklist, duels. */
export default async function DriverSheet({ d, duels, moves }: { d: Row; duels: Row[]; moves: Row[] }) {
  const { t, locale } = await getI18n();
  const st = driverStats(d.id, duels);
  const photo = photoUrl(d.photo_path);
  const total = d.wins + d.losses;
  const pct = total ? Math.round((d.wins / total) * 100) : 0;
  const best = bestRank(d.position, moves);
  const since = daysSince(d.ranked_since);
  const badges = driverBadges(d, duels, best, t);
  const kindLabel: Record<string, string> = { duel: t("Duel"), entry: t("Entrée"), sanction: t("Sanction"), removal: t("Retrait"), reserve: t("Réserve"), manual: t("Ajustement") };

  const mini: [string, string | number, string?][] = [
    [t("Duels joués"), st.played],
    [t("Série en cours"), st.played ? `${st.currentStreak} ${st.currentIsWin ? t("V") : t("D")}` : "—", st.currentIsWin ? "text-ok" : st.played ? "text-red" : ""],
    [t("Meilleure série"), st.bestWinStreak ? `${st.bestWinStreak} ${t("V")}` : "—"],
    [t("Meilleur rang"), best ? `#${best}` : "—"],
    [t("Dans la Blacklist depuis"), since !== null && d.position ? t("{n} jour(s)", { n: since }) : "—"],
  ];

  return (
    <>
      <PageHead kicker={d.position ? `BLACKLIST #${d.position}` : t("PILOTE NON CLASSÉ")} title={d.first_name} em={d.last_name} />
      <section className="py-14">
        <div className="wrap"><PilotBadges badges={badges} label={t("Badges")} className="mb-8" /></div>
        <div className="wrap grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="border border-white/10 bg-ink2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt={d.make_model ?? ""} className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center bg-ink3 font-cond tracking-[.3em] text-metal">{d.make_model ? t("PAS DE PHOTO") : t("AUCUN VÉHICULE ENGAGÉ")}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div><div className="label">{t("Véhicule engagé")}</div><div className="font-cond text-2xl font-bold uppercase tracking-wide">{d.make_model ?? "—"}</div></div>
              {d.vehicle_class && <span className="badge badge-metal">{t(d.vehicle_class)}</span>}
            </div>
          </div>

          <div className="grid content-start gap-4">
            <div className="panel flex items-center gap-6">
              <div className="font-display text-[84px] leading-none text-red">{d.position ?? "—"}</div>
              <div><div className="label">Position</div><div className="font-cond text-lg tracking-wide text-[#cfcfcf]">{d.position ? t("Membre de la Blacklist") : t("Hors classement")}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[[t("Victoires"), d.wins, "text-ok"], [t("Défaites"), d.losses, "text-red"], [t("Défis remportés"), d.challenges_won, "text-bone"]].map(([l, v, c]) => (
                <div key={l as string} className="bg-ink2 p-5 text-center"><div className={`font-display text-5xl ${c}`}>{v}</div><div className="label mt-1">{l}</div></div>
              ))}
            </div>
            <div className="bg-ink2 p-5">
              <div className="flex items-center justify-between">
                <div className="label !mb-0">{t("Forme récente")}</div>
                <div className="flex gap-1.5" aria-label={t("5 derniers duels")}>
                  {st.form.length ? st.form.map((w, i) => <span key={i} className={`grid size-7 place-items-center font-cond text-sm font-bold ${w ? "bg-ok/20 text-ok" : "bg-red/20 text-[#ff7b7b]"}`}>{w ? t("V") : t("D")}</span>) : <span className="text-sm text-metal">—</span>}
                </div>
              </div>
              {total > 0 && (
                <>
                  <div className="mt-4 h-2 bg-white/10"><div className="h-full bg-red" style={{ width: `${pct}%` }} /></div>
                  <div className="font-cond mt-1.5 text-sm text-metal">{t("{p} % sur {n} duel(s)", { p: pct, n: total })}</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="wrap mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {mini.map(([l, v, c]) => (
            <div key={l} className="bg-ink2 px-5 py-4"><div className={`font-display text-3xl ${c ?? ""}`}>{v}</div><div className="label mt-1 !mb-0">{l}</div></div>
          ))}
        </div>
      </section>

      {moves.length > 0 && (
        <section className="pb-14">
          <div className="wrap">
            <Reveal>
              <h2 className="h2 mb-6">{t("Parcours dans la")} <em>Blacklist</em></h2>
              <ol className="relative grid gap-2 border-l border-white/10 pl-6">
                {moves.map((m) => (
                  <li key={m.id} className="relative bg-ink2 px-4 py-3">
                    <span className="absolute -left-[31px] top-1/2 size-2.5 -translate-y-1/2 rotate-45 bg-red" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-display text-2xl">{m.from_position ? `#${m.from_position}` : "—"} <span className="text-red">→</span> {m.to_position ? `#${m.to_position}` : t("Hors classement")}</span>
                      <span className="font-cond text-sm tracking-[.12em] text-metal">{kindLabel[m.kind] ?? m.kind} · {dateOnly(m.created_at, locale)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>
      )}

      <section className="pb-24">
        <div className="wrap">
          <h2 className="h2 mb-8">{t("Historique des")} <em>{t("duels")}</em></h2>
          <DuelTimeline driverId={d.id} duels={duels} />
          {duels.length ? <div className="grid gap-4 md:grid-cols-3">{duels.map((x) => <DuelCard key={x.id} d={x} />)}</div> : <p className="panel text-[#a5a9b0]">{t("Aucun duel enregistré.")}</p>}
        </div>
      </section>
    </>
  );
}
