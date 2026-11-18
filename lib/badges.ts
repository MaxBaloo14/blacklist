import type { Row } from "@/lib/types";
import { driverStats } from "@/lib/driver-stats";

export type Badge = { key: string; label: string; hint: string; tone: "red" | "gold" | "ok" | "metal"; icon: "crown" | "trophy" | "flame" | "shield" | "swords" | "medal" };

/** Badges calculés uniquement à partir de données publiques : aucune saisie manuelle, rien à tricher. */
export function driverBadges(d: Row, duels: Row[], best: number | null, t: (s: string, v?: Record<string, string | number>) => string): Badge[] {
  const st = driverStats(d.id, duels);
  const out: Badge[] = [];
  if (d.position === 1) out.push({ key: "king", label: t("Roi de la Blacklist"), hint: t("Actuellement n°1"), tone: "red", icon: "crown" });
  else if (d.position && d.position <= 3) out.push({ key: "podium", label: t("Sur le podium"), hint: t("Dans le top 3"), tone: "gold", icon: "trophy" });
  if (d.position && best === 1 && d.position !== 1) out.push({ key: "ex-king", label: t("Ancien roi"), hint: t("A déjà été n°1"), tone: "gold", icon: "crown" });
  if (st.played >= 1) out.push({ key: "first", label: t("Premier duel"), hint: t("A disputé un duel officiel"), tone: "metal", icon: "swords" });
  if (st.played >= 10) out.push({ key: "veteran", label: t("Vétéran"), hint: t("10 duels disputés"), tone: "metal", icon: "shield" });
  if (st.bestWinStreak >= 5) out.push({ key: "streak5", label: t("5 victoires de suite"), hint: t("Meilleure série"), tone: "red", icon: "flame" });
  else if (st.bestWinStreak >= 3) out.push({ key: "streak3", label: t("3 victoires de suite"), hint: t("Meilleure série"), tone: "ok", icon: "flame" });
  if (d.wins >= 3 && d.losses === 0) out.push({ key: "unbeaten", label: t("Invaincu"), hint: t("Aucune défaite"), tone: "ok", icon: "medal" });
  if ((d.challenges_won ?? 0) >= 1) out.push({ key: "challenger", label: t("Défi remporté"), hint: t("A pris une place en duel"), tone: "ok", icon: "trophy" });
  return out;
}
