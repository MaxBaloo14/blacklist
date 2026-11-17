import type { Row } from "@/lib/types";

/** Statistiques calculées à partir des duels publics terminés (victoire = winner_id du pilote). */
export function driverStats(driverId: string, duels: Row[]) {
  const done = duels
    .filter((d) => d.status === "completed" || d.status === "forfeited")
    .sort((a, b) => +new Date(a.validated_at ?? a.scheduled_at ?? 0) - +new Date(b.validated_at ?? b.scheduled_at ?? 0)); // du plus ancien au plus récent
  const results = done.map((d) => d.winner_id === driverId);   // true = victoire

  // série en cours (en partant du plus récent)
  let current = 0, currentWin: boolean | null = null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (currentWin === null) currentWin = results[i];
    if (results[i] === currentWin) current++; else break;
  }
  // meilleure série de victoires
  let best = 0, run = 0;
  for (const r of results) { run = r ? run + 1 : 0; best = Math.max(best, run); }

  return {
    played: results.length,
    form: results.slice(-5).reverse(),           // les 5 derniers, le plus récent d'abord
    currentStreak: current, currentIsWin: currentWin,
    bestWinStreak: best,
  };
}

/** Meilleur rang atteint (le plus petit numéro) d'après l'historique public et la position actuelle. */
export function bestRank(position: number | null, moves: Row[]) {
  const all = [position, ...moves.map((m) => m.to_position)].filter((n): n is number => typeof n === "number");
  return all.length ? Math.min(...all) : null;
}

export const daysSince = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null);
