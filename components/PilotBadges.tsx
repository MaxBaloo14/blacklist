import { Banknote, Crown, Flag, Flame, Lock, Medal, Shield, Star, Swords, Trophy } from "lucide-react";
import type { Badge } from "@/lib/badges";

export const badgeIcons = { crown: Crown, trophy: Trophy, flame: Flame, shield: Shield, swords: Swords, medal: Medal, banknote: Banknote, flag: Flag, star: Star };
const icons = badgeIcons;

/** Rangée de badges (puces inclinées) : les infobulles expliquent comment on les obtient. */
export default function PilotBadges({ badges, label, className = "", compact }: { badges: Badge[]; label: string; className?: string; compact?: boolean }) {
  if (!badges.length) return null;
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2.5"} ${className}`} aria-label={label}>
      {badges.map((b) => { const Icon = icons[b.icon]; return <span key={b.key} title={b.hint} className={`pilot-badge pilot-badge-${b.tone} ${compact ? "pilot-badge-sm" : ""}`}><Icon size={compact ? 14 : 16} /> {b.label}</span>; })}
    </div>
  );
}

/** Collection complète : badges obtenus allumés, les autres grisés avec la condition pour les gagner. */
export function BadgeGrid({ badges, earnedLabel, lockedLabel }: { badges: Badge[]; earnedLabel: string; lockedLabel: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {badges.map((b) => {
        const Icon = icons[b.icon];
        return (
          <div key={b.key} className={`badge-card ${b.earned ? `badge-card-on pilot-badge-${b.tone}` : "badge-card-off"}`}>
            <span className="badge-card-icon">{b.earned ? <Icon size={26} /> : <Lock size={22} />}</span>
            <div className="min-w-0">
              <div className="font-cond text-lg font-bold uppercase leading-tight tracking-wide">{b.label}</div>
              <div className="mt-0.5 text-[13px] leading-snug text-[#a5a9b0]">{b.hint}</div>
              {b.progress && !b.earned && (
                <div className="mt-2"><div className="h-1.5 bg-white/10"><div className="h-full bg-red" style={{ width: `${(b.progress[0] / b.progress[1]) * 100}%` }} /></div><div className="font-cond mt-1 text-xs tracking-wider text-metal">{b.progress[0]} / {b.progress[1]}</div></div>
              )}
              <div className="font-cond mt-2 text-[11px] font-bold tracking-[.22em]">{b.earned ? earnedLabel : lockedLabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
