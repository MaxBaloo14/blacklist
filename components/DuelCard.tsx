import Link from "next/link";
import Countdown from "@/components/Countdown";
import PredictionBar from "@/components/PredictionBar";
import type { PredictionInfo } from "@/lib/predictions";
import type { Row } from "@/lib/types";
import { dateOnly, dateTime, money } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

/** Duel en face-à-face : un pilote de chaque côté, grand VS au centre, résultat ou compte à rebours en bas. */
export default async function DuelCard({ d, example, rewards, prediction }: { d: Row; example?: boolean; rewards?: Row; prediction?: PredictionInfo }) {
  const { t, locale } = await getI18n();
  const done = d.status === "completed" || d.status === "forfeited";
  const chWin = Boolean(d.winner_id && d.winner_id === d.challenger_id);
  const dfWin = Boolean(d.winner_id && d.winner_id === d.defender_id);
  const upcoming = !done && d.scheduled_at && new Date(d.scheduled_at).getTime() > Date.now();

  const fullName = (who: "ch" | "df") => `${who === "ch" ? d.challenger_first : d.defender_first} ${who === "ch" ? d.challenger_last : d.defender_last}`.trim();
  const prizeRaw = rewards?.[String(d.defender_position)];
  const prize = prizeRaw ? money(Number(prizeRaw), locale) : null;
  const ch = fullName("ch"), df = fullName("df");
  const dp = Number(d.defender_position), cp = Number(d.challenger_position);

  // Détail du duel : ce qui était en jeu, et ce que le vainqueur a gagné
  const rows: [string, string, boolean?][] = [];
  rows.push([t("Format"), d.is_podium ? t("Meilleur des 3 manches") : t("1 course")]);
  if (done) {
    if (d.status === "forfeited") rows.push([t("Issue"), t("Forfait")]);
    rows.push([t("Vainqueur"), chWin ? ch : dfWin ? df : "—", true]);
    if (d.is_podium) rows.push([t("Score des manches"), `${d.challenger_wins} – ${d.champion_wins}`]);
    if (chWin) {
      rows.push([t("Place gagnée"), `#${dp}`, true]);
      rows.push([t("Ancien occupant"), t("{n} descend #{p}", { n: df, p: cp })]);
      if (prize) rows.push([t("Cash Prize remporté"), prize, true]);
    } else {
      rows.push([t("Résultat"), t("{n} conserve sa place #{p}", { n: df, p: dp })]);
      rows.push([t("Cash Prize"), t("Non versé : le titre est conservé")]);
    }
    if (d.validated_at) rows.push([t("Validé le"), dateOnly(d.validated_at, locale)]);
  } else {
    rows.push([t("En jeu"), `${t("La place")} #${dp}`, true]);
    if (prize) rows.push([t("Cash Prize en jeu"), prize, true]);
    rows.push([t("Si le challenger gagne"), t("{c} prend la place #{d}, {n} descend #{p}", { c: ch, d: dp, n: df, p: cp })]);
  }

  const side = (who: "ch" | "df") => {
    const win = who === "ch" ? chWin : dfWin;
    const id = who === "ch" ? d.challenger_id : d.defender_id;
    const first = who === "ch" ? d.challenger_first : d.defender_first, last = who === "ch" ? d.challenger_last : d.defender_last;
    const pos = who === "ch" ? d.challenger_position : d.defender_position;
    const score = done ? (d.is_podium ? (who === "ch" ? d.challenger_wins : d.champion_wins) : win ? t("V") : t("D")) : null;
    const Wrap = example
      ? ({ className, children }: { className: string; children: React.ReactNode }) => <div className={className}>{children}</div>
      : ({ className, children }: { className: string; children: React.ReactNode }) => <Link href={`/blacklist/${id}`} className={className}>{children}</Link>;
    return (
      <Wrap className={`duel-side ${win ? "duel-win" : done ? "duel-lose" : ""} ${who === "df" ? "text-right" : "text-left"}`}>
        <span className="duel-pos font-display">#{pos}</span>
        <strong className="font-cond block truncate text-xl uppercase leading-tight tracking-wide">{`${first} ${last ?? ""}`.trim()}</strong>
        <span className={`font-display block text-5xl leading-none ${win ? "text-ok" : done ? "text-red" : ""}`}>{score ?? "–"}</span>
      </Wrap>
    );
  };

  return (
    <div className="duel-card relative overflow-hidden border-t-[3px] border-red-dark bg-ink2 p-5 transition duration-300 hover:-translate-y-1.5 hover:border-red sm:p-6">
      {example && <span className="badge badge-warn absolute right-0 top-0 !text-[11px]" style={{ clipPath: "none" }}>{t("EXEMPLE")}</span>}
      <div className="font-cond mb-4 flex justify-between text-xs tracking-[.25em] text-metal">
        <span>#{d.challenger_position} → #{d.defender_position}</span>
        <span>{d.is_podium ? t("MEILLEUR DES 3") : t("1 COURSE")}{d.status === "forfeited" ? ` · ${t("FORFAIT")}` : ""}</span>
      </div>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {side("ch")}
        <div className="duel-vs"><em className="font-marker not-italic">VS</em></div>
        {side("df")}
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        {upcoming ? (
          <div className="grid justify-items-center gap-2">
            <Countdown to={d.scheduled_at} big label="Début du duel" />
            <span className="font-cond text-[13px] tracking-[.14em] text-[#a5a9b0]">{dateTime(d.scheduled_at, locale)}</span>
          </div>
        ) : (
          <div className="font-cond flex items-center justify-between text-[13px] tracking-[.14em] text-[#a5a9b0]">
            <span>{done ? (chWin ? t("PLACE PRISE") : t("TITRE CONSERVÉ")) : `${t("DUEL")} · ${dateTime(d.scheduled_at, locale)}`}</span>
            {d.clip_url && <a href={d.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">{t("CLIP")} →</a>}
          </div>
        )}
      </div>
      {upcoming && prediction && !example && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <PredictionBar challengeId={d.id} challenger={ch || "—"} defender={df || "—"} ch={prediction.ch} df={prediction.df} mine={prediction.mine} canVote={prediction.canVote} loggedIn={prediction.loggedIn} />
          <a href={`/api/calendar.ics?duel=${d.id}`} className="font-cond mt-3 inline-block text-xs font-semibold tracking-[.18em] text-[#cfcfcf] underline decoration-red decoration-2 underline-offset-4 hover:text-white">{t("AJOUTER À MON AGENDA")}</a>
        </div>
      )}
      <dl className="duel-detail">
        {rows.map(([k, v, hi]) => (
          <div key={k}><dt>{k}</dt><dd className={hi ? "hi" : ""}>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}
