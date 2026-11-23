"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callRpc, cleanError, str } from "@/lib/action";
import { getSession } from "@/lib/auth";
import { renderPlan } from "@/lib/plan";
import { routeKm, routePx } from "@/lib/plan-geom";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const fail = async (message: string): Promise<ActionState> => ({ ok: false, message: (await getT())(message), nonce: Date.now() });
const dim = z.coerce.number().int().min(100).max(20000);
const meta = z.object({
  name: z.string().min(2, "Nom trop court.").max(80), race_type: z.enum(["Sprint urbain", "Circuit", "Last Race", "Warm-up"]),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Extreme"]), status: z.enum(["active", "inactive"]), description: z.string().max(1000),
});

/** Fabrique le plan (carte + cadre + tracé), l'envoie dans le stockage puis crée le circuit officiel (voiture animée comprise). Organisateurs uniquement. */
async function publishPlan(m: z.infer<typeof meta>, path: string, w: number, h: number): Promise<ActionState> {
  const { isAdmin } = await getSession();
  if (!isAdmin) return await fail("Action non autorisée.");
  if (!/^M[-0-9. ,CL]+$/.test(path) || path.length > 60000) return await fail("Tracé invalide : place au moins 2 points sur la carte.");
  const plan = await renderPlan(path, w, h);
  if ("error" in plan) return await fail(plan.error);
  const supabase = await createClient();
  const { data: sc } = await supabase.from("settings").select("value").eq("key", "map_scale_m_per_px").maybeSingle();
  const km = routeKm(path, Number(sc?.value) > 0 ? Number(sc?.value) : 6.5);   // distance recalculée par le serveur : jamais reprise du navigateur
  const file = `${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage.from("track-images").upload(file, plan.webp, { contentType: "image/webp" });
  if (upErr) return await fail("Envoi de l'image impossible.");
  const { error } = await supabase.from("race_tracks").insert({
    name: m.name, race_type: m.race_type, difficulty: m.difficulty, status: m.status, description: m.description || null, start_point: "START", end_point: "FINISH",
    distance_km: km > 0 ? km : null, image_path: file, route_path: plan.path, route_w: 1432, route_h: 2000,
  });
  if (error) { await supabase.storage.from("track-images").remove([file]); return await fail(cleanError(error.message)); }
  revalidatePath("/", "layout");
  return { ok: true, message: (await getT())("Circuit créé : plan, tracé animé et voiture sont en ligne."), nonce: Date.now() };
}

export async function createPlanTrack(_: ActionState, f: FormData): Promise<ActionState> {
  const p = meta.safeParse({ name: str(f, "name"), race_type: str(f, "race_type"), difficulty: str(f, "difficulty"), status: str(f, "status") || "active", description: str(f, "description") });
  const w = dim.safeParse(str(f, "w")), h = dim.safeParse(str(f, "h"));
  if (!p.success) return await fail(p.error.issues[0]?.message ?? "Données invalides.");
  if (!w.success || !h.success || !str(f, "path")) return await fail("Trace le parcours sur la carte : place au moins 2 points (départ puis arrivée).");
  return publishPlan(p.data, str(f, "path"), w.data, h.data);
}

/** Retient une suggestion de pilote : crée le circuit officiel à partir de son tracé, puis prévient le pilote. */
export async function createTrackFromSuggestion(_: ActionState, f: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(str(f, "suggestion"));
  const p = meta.omit({ name: true, description: true }).safeParse({ race_type: str(f, "race_type"), difficulty: str(f, "difficulty"), status: str(f, "status") || "active" });
  if (!id.success || !p.success) return await fail("Données invalides.");
  const supabase = await createClient();
  const { data: s } = await supabase.from("course_suggestions").select("*").eq("id", id.data).maybeSingle();
  if (!s) return await fail("Suggestion introuvable.");
  if (s.status !== "pending") return await fail("Cette suggestion est déjà traitée.");
  const res = await publishPlan({ ...p.data, name: str(f, "name") || s.name, description: s.description ?? "" }, s.route_path, s.route_w, s.route_h);
  if (!res.ok) return res;
  return callRpc("admin_handle_suggestion", { p_id: id.data, p_status: "accepted", p_note: str(f, "note") || "Retenue : ton parcours est maintenant un circuit officiel." }, (await getT())("Circuit créé à partir de la suggestion. Le pilote est prévenu."), ["/admin/suggestions", "/suggestion"]);
}

/** Calibre l'échelle de la carte : le tracé dessiné correspond à une distance connue (en kilomètres, relevée en jeu). Super administrateur uniquement (règle protégée par la base). */
export async function calibrateScale(_: ActionState, f: FormData): Promise<ActionState> {
  const path = str(f, "path"), km = Number(str(f, "km").replace(",", "."));
  if (!/^M[-0-9. ,CL]+$/.test(path) || routePx(path) < 50) return await fail("Trace d'abord un parcours d'au moins quelques centaines de mètres sur la carte.");
  if (!Number.isFinite(km) || km < 0.2 || km > 200) return await fail("Distance invalide (entre 0,2 et 200 km).");
  const scale = Math.round(((km * 1000) / routePx(path)) * 1000) / 1000;
  if (scale < 1 || scale > 40) return await fail("Échelle incohérente : vérifie la distance saisie.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").update({ value: scale, updated_at: new Date().toISOString() }).eq("key", "map_scale_m_per_px").select("key");
  if (error) return await fail(cleanError(error.message));
  if (!data?.length) return await fail("Seul un super administrateur peut modifier l'échelle.");
  revalidatePath("/", "layout");
  return { ok: true, message: (await getT())("Échelle enregistrée : {n} m par pixel.", { n: scale }), nonce: Date.now() };
}
