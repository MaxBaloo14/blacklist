import Link from "next/link";
import type { Row } from "@/lib/types";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

/** Frise des duels d'un pilote : du plus ancien (gauche) au plus récent (droite), victoire en vert, défaite en rouge. */
export default async function DuelTimeline({ driverId, duels }: { driverId: string; duels: Row[] }) {
  const { t, locale } = await getI18n();
  const done = duels
    .filter((d) => d.status === "completed" || d.status === "forfeited")
    .sort((a, b) => +new Date(a.validated_at ?? a.scheduled_at ?? 0) - +new Date(b.validated_at ?? b.scheduled_at ?? 0));
  if (!done.length) return null;
  return (
    <div className="mb-10" aria-label={t("FRISE DES DUELS")}>
      <div className="mb-3 flex items-baseline justify-between gap-3"><div className="kicker">{t("FRISE DES DUELS")}</div><span className="font-cond text-xs tracking-[.14em] text-metal">{t("Du plus ancien au plus récent")}</span></div>
      <ol className="tline">
        {done.map((d) => {
          const meChallenger = d.challenger_id === driverId;
          const win = d.winner_id === driverId;
          const opp = meChallenger ? `${d.defender_first} ${d.defender_last}` : `${d.challenger_first} ${d.challenger_last}`;
          const oppId = meChallenger ? d.defender_id : d.challenger_id;
          return (
            <li key={d.id} className={win ? "tline-win" : "tline-loss"}>
              <span className="tline-dot font-display">{win ? t("V") : t("D")}</span>
              <div className="tline-card">
                <div className="font-cond text-[11px] tracking-[.18em] text-metal">{dateOnly(d.validated_at ?? d.scheduled_at, locale)}</div>
                <div className="font-cond text-xs tracking-[.14em] text-metal">#{d.challenger_position} → #{d.defender_position}</div>
                <Link href={`/blacklist/${oppId}`} className="font-cond block truncate text-base font-bold uppercase tracking-wide hover:text-red">{t("contre")} {opp.trim()}</Link>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
