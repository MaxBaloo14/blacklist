import Link from "next/link";
import type { Row } from "@/lib/types";
import { dateTime } from "@/lib/format";

export default function DuelCard({ d }: { d: Row }) {
  const done = d.status === "completed" || d.status === "forfeited";
  const chWin = d.winner_id && d.winner_id === d.challenger_id;
  const dfWin = d.winner_id && d.winner_id === d.defender_id;
  return (
    <div className="relative overflow-hidden border-t-[3px] border-red-dark bg-ink2 p-6 transition duration-300 hover:-translate-y-1.5 hover:border-red">
      <div className="font-cond mb-4 flex justify-between text-xs tracking-[.25em] text-metal">
        <span>#{d.challenger_position} → #{d.defender_position}</span>
        <span>{d.is_podium ? "BEST OF 3" : "1 RACE"}{d.status === "forfeited" ? " · FORFEIT" : ""}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <Link href={`/blacklist/${d.challenger_id}`} className={chWin ? "text-white" : done ? "text-white/40" : ""}>
          <strong className="font-cond block text-lg uppercase tracking-wide">{d.challenger_first} {d.challenger_last}</strong>
          <span className="font-display text-4xl">{done ? (d.is_podium ? d.challenger_wins : chWin ? "W" : "L") : "–"}</span>
        </Link>
        <em className="font-marker text-2xl not-italic text-red">VS</em>
        <Link href={`/blacklist/${d.defender_id}`} className={dfWin ? "text-white" : done ? "text-white/40" : ""}>
          <strong className="font-cond block text-lg uppercase tracking-wide">{d.defender_first} {d.defender_last}</strong>
          <span className="font-display text-4xl">{done ? (d.is_podium ? d.champion_wins : dfWin ? "W" : "L") : "–"}</span>
        </Link>
      </div>
      <div className="font-cond mt-4 flex items-center justify-between border-t border-white/10 pt-3.5 text-[13px] tracking-[.14em] text-[#a5a9b0]">
        <span>{done ? (chWin ? "POSITION TAKEN" : "TITLE DEFENDED") : `DUEL · ${dateTime(d.scheduled_at)}`}</span>
        {d.clip_url && <a href={d.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">CLIP →</a>}
      </div>
    </div>
  );
}
