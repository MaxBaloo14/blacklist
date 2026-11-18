import type { Row } from "@/lib/types";
import { driverStats } from "@/lib/driver-stats";

export type BadgeIcon = "crown" | "trophy" | "flame" | "shield" | "swords" | "medal" | "banknote" | "flag" | "star";
export type Badge = { key: string; label: string; hint: string; tone: "red" | "gold" | "ok" | "metal"; icon: BadgeIcon; earned: boolean; progress?: [number, number] };

export type BadgeCtx = {
  driverId: string; position: number | null; best: number | null; wins: number; losses: number; challengesWon: number; duels: Row[];
  registered?: boolean; vehicle?: boolean; rewardsPaid?: number; warmupWinner?: boolean;
};
type T = (s: string, v?: Record<string, string | number>) => string;

/** Catalogue complet des badges, calculé uniquement à partir de données du site (aucune saisie manuelle, rien à tricher). */
export function badgeCatalog(c: BadgeCtx, t: T): Badge[] {
  const st = driverStats(c.driverId, c.duels);
  const b = (key: string, label: string, hint: string, tone: Badge["tone"], icon: BadgeIcon, earned: boolean, progress?: [number, number]): Badge => ({ key, label, hint, tone, icon, earned, progress });
  return [
    b("reg", t("Inscription validée"), t("Ton dossier a été validé par l'organisation."), "ok", "medal", Boolean(c.registered)),
    b("veh", t("Véhicule homologué"), t("Ton véhicule a été homologué par l'organisation."), "ok", "shield", Boolean(c.vehicle)),
    b("first", t("Premier duel"), t("Disputer ton premier duel officiel."), "metal", "swords", st.played >= 1),
    b("challenger", t("Défi remporté"), t("Prendre une place en battant le pilote au-dessus de toi."), "ok", "trophy", c.challengesWon >= 1),
    b("warmup", t("Vainqueur de la Warm-up"), t("Gagner la Warm-up Race du dimanche."), "gold", "flag", Boolean(c.warmupWinner)),
    b("entered", t("Dans la Blacklist"), t("Entrer dans le classement des 10."), "ok", "star", c.best !== null),
    b("podium", t("Sur le podium"), t("Atteindre le top 3."), "gold", "trophy", c.best !== null && c.best <= 3),
    b("king", t("Roi de la Blacklist"), t("Être n°1 du classement."), "red", "crown", c.position === 1),
    b("ex-king", t("Ancien roi"), t("Avoir déjà été n°1, même si ce n'est plus le cas."), "gold", "crown", c.best === 1 && c.position !== 1),
    b("streak3", t("3 victoires de suite"), t("Enchaîner 3 victoires en duel."), "ok", "flame", st.bestWinStreak >= 3, [Math.min(st.bestWinStreak, 3), 3]),
    b("streak5", t("5 victoires de suite"), t("Enchaîner 5 victoires en duel."), "red", "flame", st.bestWinStreak >= 5, [Math.min(st.bestWinStreak, 5), 5]),
    b("veteran", t("Vétéran"), t("Disputer 10 duels officiels."), "metal", "shield", st.played >= 10, [Math.min(st.played, 10), 10]),
    b("unbeaten", t("Invaincu"), t("Avoir au moins 3 victoires et aucune défaite."), "ok", "medal", c.wins >= 3 && c.losses === 0, [Math.min(c.wins, 3), 3]),
    b("cash", t("Cash Prize encaissé"), t("Recevoir le versement d'un Cash Prize."), "gold", "banknote", (c.rewardsPaid ?? 0) >= 1),
  ];
}

/** Badges obtenus d'un pilote, pour sa fiche publique (certaines infos privées, comme les paiements, n'y entrent pas). */
export function driverBadges(d: Row, duels: Row[], best: number | null, t: T): Badge[] {
  return badgeCatalog({ driverId: d.id, position: d.position ?? null, best, wins: d.wins ?? 0, losses: d.losses ?? 0, challengesWon: d.challenges_won ?? 0, duels, registered: Boolean(d.position || d.make_model), vehicle: Boolean(d.make_model) }, t).filter((x) => x.earned);
}
