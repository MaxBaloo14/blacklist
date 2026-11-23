import { getBlacklist, getLatestDuels, getRewards } from "@/lib/data";
import { driverStats } from "@/lib/driver-stats";
import { createClient as createSb } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import type { Row } from "@/lib/types";

const pub = () => createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
export type Bettor = { id: string; name: string; bets: number; won: number; rate: number; profit: number };
export type PlayerStat = { id: string; name: string; position: number | null; duels: number; wins: number; losses: number; races: number; raceWins: number; rate: number | null; streak: number; bestStreak: number; cash: number };
const days = (a: string | Date, b: string | Date) => Math.max(0, Math.floor((+new Date(b) - +new Date(a)) / 864e5));

/** Données du Hall of Fame : tout vient de vues et tables publiques (historique du classement, duels terminés). */
export async function getHallData() {
  const empty = { currentKing: null as null | { id: string; name: string; days: number }, kings: [] as { id: string; name: string; since: string; until: string; days: number; current: boolean }[],
    bestStreak: null as null | { n: number; who: { id: string; name: string } }, mostWins: null as null | { n: number; who: { id: string; name: string } }, mostDuels: null as null | { n: number; who: { id: string; name: string } },
    longestReign: null as null | { days: number; who: { id: string; name: string } }, topPrize: "",
    mostRaces: null as null | { n: number; who: { id: string; name: string } }, bestRate: null as null | { n: number; who: { id: string; name: string } }, topEarner: null as null | { n: number; who: { id: string; name: string } },
    players: [] as PlayerStat[], bettors: [] as Bettor[] };
  if (!hasSupabase) return empty;
  const [{ data: hist }, duels, board, rewards, { data: raceRows }] = await Promise.all([
    pub().from("ranking_history").select("driver_id,from_position,to_position,created_at").eq("to_position", 1).not("driver_id", "is", null).order("created_at", { ascending: true }).limit(300),
    getLatestDuels(500), getBlacklist(), getRewards(),
    pub().from("public_race_results").select("winner_id,challenger_id,defender_id").limit(2000),
  ]);
  const { data: bet } = await pub().from("public_bettors").select("driver_id,first_name,last_name,bets,won,profit").limit(200);
  const ids = [...new Set([...(hist ?? []).map((h) => h.driver_id), ...duels.flatMap((d) => [d.challenger_id, d.defender_id]), ...board.map((b) => b.driver_id).filter(Boolean)])] as string[];
  const { data: people } = ids.length ? await pub().from("public_driver").select("id,first_name,last_name").in("id", ids) : { data: [] as Row[] };
  const nameOf = new Map<string, string>((people ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
  duels.forEach((d) => { nameOf.set(d.challenger_id, `${d.challenger_first} ${d.challenger_last}`.trim()); nameOf.set(d.defender_id, `${d.defender_first} ${d.defender_last}`.trim()); });
  const who = (id: string) => ({ id, name: nameOf.get(id) ?? "—" });

  // Rois : on fusionne les entrées consécutives du même pilote, chaque règne dure jusqu'au sacre suivant
  const seq: { id: string; since: string }[] = [];
  for (const h of hist ?? []) if (!seq.length || seq[seq.length - 1].id !== h.driver_id) seq.push({ id: h.driver_id, since: h.created_at });
  const now = new Date().toISOString();
  const currentId = board.find((b) => b.position === 1)?.driver_id ?? null;
  const kings = seq.map((k, i) => {
    const until = seq[i + 1]?.since ?? now;
    return { ...who(k.id), since: k.since, until, days: days(k.since, until), current: i === seq.length - 1 && k.id === currentId };
  }).reverse();
  const cur = kings.find((k) => k.current) ?? null;

  const stat = (fn: (id: string) => number) => {
    let best: { n: number; id: string } | null = null;
    for (const id of new Set(duels.flatMap((d) => [d.challenger_id, d.defender_id]))) { const n = fn(id); if (n > 0 && (!best || n > best.n)) best = { n, id }; }
    return best ? { n: best.n, who: who(best.id) } : null;
  };
  const longest = kings.reduce<null | (typeof kings)[number]>((a, k) => (!a || k.days > a.days ? k : a), null);
  const prize1 = rewards?.["1"];

  // Statistiques par pilote : duels, courses, séries, taux de victoire, Cash Prize remporté
  const finished = duels.filter((d) => (d.status === "completed" || d.status === "forfeited") && d.winner_id);
  const pilots = new Set<string>([...duels.flatMap((d) => [d.challenger_id, d.defender_id]), ...board.map((b) => b.driver_id).filter(Boolean)]);
  const players: PlayerStat[] = [...pilots].map((id) => {
    const mine = finished.filter((d) => d.challenger_id === id || d.defender_id === id);
    const wins = mine.filter((d) => d.winner_id === id).length;
    const rr = (raceRows ?? []).filter((r) => r.challenger_id === id || r.defender_id === id);
    const ds = driverStats(id, duels);
    const cash = mine.filter((d) => d.winner_id === id && d.challenger_id === id).reduce((a, d) => a + Number(rewards?.[String(d.defender_position)] ?? 0), 0);
    return { id, name: who(id).name, position: board.find((b) => b.driver_id === id)?.position ?? null, duels: mine.length, wins, losses: mine.length - wins, races: rr.length, raceWins: rr.filter((r) => r.winner_id === id).length,
      rate: mine.length ? Math.round((wins / mine.length) * 100) : null, streak: ds.currentIsWin ? ds.currentStreak : 0, bestStreak: ds.bestWinStreak, cash };
  }).sort((a, b) => b.wins - a.wins || (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name));
  const top = (fn: (p: PlayerStat) => number, min = 1) => { const b = players.filter((p) => fn(p) >= min).sort((x, y) => fn(y) - fn(x))[0]; return b ? { n: fn(b), who: { id: b.id, name: b.name } } : null; };
  return {
    currentKing: cur ? { id: cur.id, name: cur.name, days: cur.days } : currentId ? { ...who(currentId), days: 0 } : null,
    kings,
    bestStreak: stat((id) => driverStats(id, duels).bestWinStreak),
    mostWins: stat((id) => duels.filter((d) => (d.status === "completed" || d.status === "forfeited") && d.winner_id === id).length),
    mostDuels: stat((id) => driverStats(id, duels).played),
    longestReign: longest && longest.days > 0 ? { days: longest.days, who: { id: longest.id, name: longest.name } } : null,
    topPrize: prize1 ? money(Number(prize1)) : "",
    mostRaces: top((p) => p.races), bestRate: top((p) => (p.duels >= 3 ? p.rate ?? 0 : 0)), topEarner: top((p) => p.cash),
    players,
    bettors: (bet ?? []).map((b) => ({ id: b.driver_id, name: `${b.first_name} ${b.last_name}`.trim(), bets: b.bets, won: b.won, rate: b.bets ? Math.round((b.won / b.bets) * 100) : 0, profit: Number(b.profit) }))
      .sort((a, b) => b.profit - a.profit || b.rate - a.rate || b.bets - a.bets).slice(0, 20),
  };
}
