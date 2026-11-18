import { createClient as createSb } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import type { Row } from "@/lib/types";

export type PredictionInfo = { ch: number; df: number; mine: "challenger" | "defender" | null; canVote: boolean; loggedIn: boolean };

/** Totaux publics des pronostics (+ le vote du visiteur connecté) pour une liste de duels. */
export async function getPredictions(duels: Row[]): Promise<Map<string, PredictionInfo>> {
  const out = new Map<string, PredictionInfo>();
  const ids = duels.filter((d) => d.status === "scheduled").map((d) => d.id as string);
  if (!ids.length) return out;
  const pub = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: totals }, session] = await Promise.all([pub.from("public_predictions").select("*").in("challenge_id", ids), getSession()]);
  let mine = new Map<string, "challenger" | "defender">();
  if (session.supabase && session.user && session.profile) {
    const { data } = await session.supabase.from("duel_predictions").select("challenge_id,pick").in("challenge_id", ids);
    mine = new Map((data ?? []).map((r) => [r.challenge_id, r.pick]));
  }
  for (const d of duels) {
    if (d.status !== "scheduled") continue;
    const t = (totals ?? []).find((x) => x.challenge_id === d.id);
    const me = session.user?.id;
    out.set(d.id, {
      ch: t?.challenger_votes ?? 0, df: t?.defender_votes ?? 0, mine: mine.get(d.id) ?? null,
      loggedIn: Boolean(session.user && session.profile), canVote: Boolean(session.user && session.profile && me !== d.challenger_id && me !== d.defender_id),
    });
  }
  return out;
}
