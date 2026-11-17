import Link from "next/link";
import type { Row } from "@/lib/types";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function DuelCard({ d }: { d: Row }) {
  const { t, locale } = await getI18n();
  const done = d.status === "completed" || d.status === "forfeited";
  const chWin = d.winner_id && d.winner_id === d.challenger_id;
  const dfWin = d.winner_id && d.winner_id === d.defender_id;
  return (
    <div className="relative overflow-hidden border-t-[3px] border-red-dark bg-ink2 p-6 transition duration-300 hover:-translate-y-1.5 hover:border-red">
      <div className="font-cond mb-4 flex justify-between text-xs tracking-[.25em] text-metal">
        <span>#{d.challenger_position} → #{d.defender_position}</span>
        <span>{d.is_podium ? t("MEILLEUR DES 3") : t("1 COURSE")}{d.status === "forfeited" ? ` · ${t("FORFAIT")}` : ""}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <Link href={`/blacklist/${d.challenger_id}`} className={chWin ? "text-white" : done ? "text-white/40" : ""}>
          <strong className="font-cond block text-lg uppercase tracking-wide">{d.challenger_first} {d.challenger_last}</strong>
          <span className="font-display text-4xl">{done ? (d.is_podium ? d.challenger_wins : chWin ? t("V") : t("D")) : "–"}</span>
        </Link>
        <em className="font-marker text-2xl not-italic text-red">VS</em>
        <Link href={`/blacklist/${d.defender_id}`} className={dfWin ? "text-white" : done ? "text-white/40" : ""}>
          <strong className="font-cond block text-lg uppercase tracking-wide">{d.defender_first} {d.defender_last}</strong>
          <span className="font-display text-4xl">{done ? (d.is_podium ? d.champion_wins : dfWin ? t("V") : t("D")) : "–"}</span>
        </Link>
      </div>
      <div className="font-cond mt-4 flex items-center justify-between border-t border-white/10 pt-3.5 text-[13px] tracking-[.14em] text-[#a5a9b0]">
        <span>{done ? (chWin ? t("PLACE PRISE") : t("TITRE CONSERVÉ")) : `${t("DUEL")} · ${dateTime(d.scheduled_at, locale)}`}</span>
        {d.clip_url && <a href={d.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">{t("CLIP")} →</a>}
      </div>
    </div>
  );
}
