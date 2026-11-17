import { createClient as createSb } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/supabase/server";
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

export const getBlacklist = () => safe<Row[]>((s) => s.from("public_blacklist").select("*").order("position"), []);
export const getRewards = () => safe<Row>(async (s) => s.from("settings").select("value").eq("key", "rewards").maybeSingle().then((r) => ({ data: r.data?.value ?? {}, error: r.error })), {});
export const getLatestDuels = (n = 6) =>
  safe<Row[]>((s) => s.from("public_duels").select("*").in("status", ["completed", "forfeited", "scheduled"]).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(n), []);
export const getNews = (n = 3) => safe<Row[]>((s) => s.from("announcements").select("*").eq("published", true).order("published_at", { ascending: false }).limit(n), []);
export const getTracks = () => safe<Row[]>((s) => s.from("race_tracks").select("*").order("status").order("name"), []);
export const getPublicDriver = (id: string) => safe<Row | null>((s) => s.from("public_driver").select("*").eq("id", id).maybeSingle(), null);
export const getDriverDuels = (id: string) =>
  safe<Row[]>((s) => s.from("public_duels").select("*").or(`challenger_id.eq.${id},defender_id.eq.${id}`).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(30), []);
export const getWarmups = () => safe<Row[]>((s) => s.from("warmup_events").select("*, race_tracks(name,start_point,end_point)").order("scheduled_at", { ascending: false }).limit(20), []);
export const getWarmupParticipants = () => safe<Row[]>((s) => s.from("public_warmup_participants").select("*"), []);
export const getPublicSettings = () => safe<Row[]>((s) => s.from("settings").select("key,value"), []);
