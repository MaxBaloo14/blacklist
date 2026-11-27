import { createClient as createSb } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/supabase/server";
import { cache } from "react";
import { matchVehicle } from "@/lib/vehicle-catalog";
import type { Row } from "@/lib/types";

/** Client anonyme pour les données 100 % publiques (vues en lecture seule) : réponses mises en cache 15 s par Next. */
const publicClient = () =>
  createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 15 } }) },
  });

/** Les pages publiques restent affichables même si la base est injoignable (états vides). */
async function safe<T>(fn: (s: ReturnType<typeof publicClient>) => PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  if (!hasSupabase) return fallback;
  try {
    const s = publicClient();
    const { data, error } = await fn(s);
    if (error) { console.error("[data]", error); return fallback; }
    return (data ?? fallback) as T;
  } catch (e) {
    console.error("[data]", e);
    return fallback;
  }
}

/** Ajoute à chaque ligne l'identifiant de la photo du véhicule (retrouvé d'après « Marque Modèle »). */
const withCar = <T extends Row>(r: T): T & { vslug: string | null } => ({ ...r, vslug: matchVehicle(r.make_model)?.slug ?? null });
export const getBlacklist = () => safe<Row[]>((s) => s.from("public_blacklist").select("*").order("position"), []).then((rows) => rows.map(withCar));
/** Véhicule homologué de chaque pilote (pour les photos des duels) : une seule lecture par requête. */
export const getApprovedCars = cache(async (): Promise<Map<string, { label: string; slug: string | null }>> => {
  const rows = await safe<Row[]>((s) => s.from("vehicles").select("owner_id,make_model").eq("status", "approved"), []);
  return new Map(rows.map((r) => [r.owner_id as string, { label: r.make_model as string, slug: matchVehicle(r.make_model)?.slug ?? null }]));
});
/** Classement + mouvement récent (7 jours) + pastille « en duel » : tout vient de vues et tables publiques en lecture seule. */
export async function getBlacklistLive(): Promise<Row[]> {
  const [rows, hist, duels] = await Promise.all([
    getBlacklist(),
    safe<Row[]>((s) => s.from("ranking_history").select("driver_id,from_position,to_position,created_at").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()).not("driver_id", "is", null).order("created_at", { ascending: false }).limit(200), []),
    safe<Row[]>((s) => s.from("public_duels").select("challenger_id,defender_id").eq("status", "scheduled"), []),
  ]);
  const move = new Map<string, number | "new">();
  for (const h of hist) {
    if (move.has(h.driver_id)) continue; // le plus récent d'abord
    if (h.to_position == null) continue;
    if (h.from_position == null) continue; // les entrées ne sont pas des mouvements : pas de pastille
    move.set(h.driver_id, h.from_position - h.to_position);
  }
  const inDuel = new Set(duels.flatMap((d) => [d.challenger_id, d.defender_id]));
  return rows.map((r) => ({ ...r, move: r.driver_id && move.get(r.driver_id) ? move.get(r.driver_id) : null, in_duel: !!r.driver_id && inDuel.has(r.driver_id) }));
}
export const getRewards = () => safe<Row>(async (s) => s.from("settings").select("value").eq("key", "rewards").maybeSingle().then((r) => ({ data: r.data?.value ?? {}, error: r.error })), {});
export const getLatestDuels = (n = 6) =>
  safe<Row[]>((s) => s.from("public_duels").select("*").in("status", ["completed", "forfeited", "scheduled"]).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(n), []);
export const getNews = (n = 3) => safe<Row[]>((s) => s.from("announcements").select("*").eq("published", true).order("published_at", { ascending: false }).limit(n), []);
export const getTracks = () => safe<Row[]>((s) => s.from("race_tracks").select("*").order("status").order("name"), []);
export const getPublicDriver = (id: string) => safe<Row | null>((s) => s.from("public_driver").select("*").eq("id", id).maybeSingle(), null).then((r) => (r ? withCar(r) : r));
/** Mouvements publics dans la Blacklist (sans les motifs internes de l'organisation). */
export const getDriverMoves = (id: string) =>
  safe<Row[]>((s) => s.from("ranking_history").select("id,from_position,to_position,kind,created_at").eq("driver_id", id).order("created_at", { ascending: false }).limit(10), []);
export const getDriverDuels = (id: string) =>
  safe<Row[]>((s) => s.from("public_duels").select("*").or(`challenger_id.eq.${id},defender_id.eq.${id}`).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(30), []);
export const getWarmups = () => safe<Row[]>((s) => s.from("warmup_events").select("*, race_tracks(name,start_point,end_point)").order("scheduled_at", { ascending: false }).limit(20), []);
export const getWarmupParticipants = () => safe<Row[]>((s) => s.from("public_warmup_participants").select("*"), []).then((rows) => rows.map(withCar));
export const getPublicSettings = () => safe<Row[]>((s) => s.from("settings").select("key,value"), []);

/** Échelle de la carte (mètres par pixel), réglage calibré par l'organisation. */
export async function getMapScale(): Promise<number> {
  const rows = await getPublicSettings();
  const v = Number(rows.find((x) => x.key === "map_scale_m_per_px")?.value);
  return Number.isFinite(v) && v > 0 ? v : 6.5;
}
