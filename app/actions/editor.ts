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

const pts = z.array(z.tuple([z.number().min(0).max(20000), z.number().min(0).max(20000)])).max(100000);   // l'organisation n'est pas limitée en points de passage
const manualKm = (f: FormData) => { const v = Number(str(f, "distance_km").replace(",", ".")); return Number.isFinite(v) && v > 0 && v < 1000 ? Math.round(v * 10) / 10 : null; };
const readPoints = (f: FormData) => { try { const r = pts.safeParse(JSON.parse(str(f, "points") || "[]")); return r.success ? r.data : []; } catch { return []; } };

type Extra = { points?: [number, number][]; follow?: boolean; km?: number | null; trackId?: string; draftId?: string };

/** Fabrique le plan (carte + cadre + tracé), l'envoie dans le stockage puis crée (ou remplace) le circuit officiel (voiture animée comprise). Organisateurs uniquement. */
async function publishPlan(m: z.infer<typeof meta>, path: string, w: number, h: number, x: Extra = {}): Promise<ActionState> {
  const { isAdmin } = await getSession();
  if (!isAdmin) return await fail("Action non autorisée.");
  if (!/^M[-0-9. ,CL]+$/.test(path) || path.length > 60000) return await fail("Tracé invalide : place au moins 2 points sur la carte.");
  const plan = await renderPlan(path, w, h);
  if ("error" in plan) return await fail(plan.error);
  const supabase = await createClient();
  const { data: sc } = await supabase.from("settings").select("value").eq("key", "map_scale_m_per_px").maybeSingle();
  const est = routeKm(path, Number(sc?.value) > 0 ? Number(sc?.value) : 6.5);   // distance estimée par le serveur ; la saisie manuelle de l'organisation prime
  const km = x.km ?? (est > 0 ? est : null);
  const file = `${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage.from("track-images").upload(file, plan.webp, { contentType: "image/webp" });
  if (upErr) return await fail("Envoi de l'image impossible.");
  const row = {
    name: m.name, race_type: m.race_type, difficulty: m.difficulty, status: m.status, description: m.description || null, start_point: "START", end_point: "FINISH",
    distance_km: km, image_path: file, route_path: plan.path, route_w: 1432, route_h: 2000,
    editor_points: x.points?.length ? x.points : null, editor_follow: x.follow ?? null, editor_w: x.points?.length ? w : null, editor_h: x.points?.length ? h : null,
  };
  let oldImage: string | null = null;
  if (x.trackId) {
    const { data: cur } = await supabase.from("race_tracks").select("image_path").eq("id", x.trackId).maybeSingle();
    oldImage = cur?.image_path ?? null;
  }
  const { error } = x.trackId ? await supabase.from("race_tracks").update(row).eq("id", x.trackId) : await supabase.from("race_tracks").insert(row);
  if (error) { await supabase.storage.from("track-images").remove([file]); return await fail(cleanError(error.message)); }
  if (oldImage && !oldImage.startsWith("/") && oldImage !== file) await supabase.storage.from("track-images").remove([oldImage]);
  if (x.draftId) await supabase.from("track_drafts").delete().eq("id", x.draftId);
  revalidatePath("/", "layout");
  return { ok: true, message: (await getT())(x.trackId ? "Circuit mis à jour : nouveau plan et tracé animé en ligne." : "Circuit créé : plan, tracé animé et voiture sont en ligne."), nonce: Date.now() };
}

function readMeta(f: FormData) {
  return meta.safeParse({ name: str(f, "name"), race_type: str(f, "race_type"), difficulty: str(f, "difficulty"), status: str(f, "status") || "active", description: str(f, "description") });
}

export async function createPlanTrack(_: ActionState, f: FormData): Promise<ActionState> {
  const p = readMeta(f);
  const w = dim.safeParse(str(f, "w")), h = dim.safeParse(str(f, "h"));
  if (!p.success) return await fail(p.error.issues[0]?.message ?? "Données invalides.");
  if (!w.success || !h.success || !str(f, "path")) return await fail("Trace le parcours sur la carte : place au moins 2 points (départ puis arrivée).");
  const trackId = str(f, "track"), draftId = str(f, "draft");
  const idOk = (v: string) => !v || z.string().uuid().safeParse(v).success;
  if (!idOk(trackId) || !idOk(draftId)) return await fail("Sélection invalide.");
  return publishPlan(p.data, str(f, "path"), w.data, h.data, { points: readPoints(f), follow: str(f, "follow") === "1", km: manualKm(f), trackId: trackId || undefined, draftId: draftId || undefined });
}

/** Enregistre (ou met à jour) un brouillon de circuit : rien n'est publié, seule l'organisation le voit. */
export async function saveDraft(f: FormData): Promise<ActionState & { id?: string }> {
  const { isAdmin, user } = await getSession();
  if (!isAdmin || !user) return await fail("Action non autorisée.");
  const name = str(f, "name") || "Brouillon sans nom";
  const w = dim.safeParse(str(f, "w")), h = dim.safeParse(str(f, "h"));
  if (!w.success || !h.success) return await fail("La carte n'est pas chargée : patiente un instant.");
  const rt = z.enum(["Sprint urbain", "Circuit", "Last Race", "Warm-up"]).safeParse(str(f, "race_type")), df = z.enum(["Easy", "Medium", "Hard", "Extreme"]).safeParse(str(f, "difficulty"));
  const row = { name: name.slice(0, 80), race_type: rt.success ? rt.data : "Sprint urbain", difficulty: df.success ? df.data : "Medium", description: str(f, "description").slice(0, 1000) || null, distance_km: manualKm(f), points: readPoints(f), follow: str(f, "follow") !== "0", map_w: w.data, map_h: h.data, updated_at: new Date().toISOString() };
  const supabase = await createClient();
  const existing = str(f, "draft");
  if (existing && !z.string().uuid().safeParse(existing).success) return await fail("Sélection invalide.");
  const { data, error } = existing
    ? await supabase.from("track_drafts").update(row).eq("id", existing).select("id").maybeSingle()
    : await supabase.from("track_drafts").insert({ ...row, created_by: user.id }).select("id").maybeSingle();
  if (error || !data) return await fail(error ? cleanError(error.message) : "Brouillon introuvable.");
  revalidatePath("/admin/editor");
  return { ok: true, message: (await getT())("Brouillon enregistré."), nonce: Date.now(), id: data.id };
}

export async function deleteDraft(_: ActionState, f: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(str(f, "draft"));
  if (!id.success) return await fail("Sélection invalide.");
  const supabase = await createClient();
  const { error } = await supabase.from("track_drafts").delete().eq("id", id.data);
  if (error) return await fail(cleanError(error.message));
  revalidatePath("/admin/editor");
  return { ok: true, message: (await getT())("Brouillon supprimé."), nonce: Date.now() };
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
