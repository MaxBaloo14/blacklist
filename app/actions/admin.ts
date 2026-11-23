"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callRpc, cleanError, str } from "@/lib/action";
import { checkImage } from "@/lib/upload";
import { createServiceClient } from "@/lib/supabase/admin";
import { parisLocalToISO } from "@/lib/format";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const fail = async (message: string): Promise<ActionState> => ({ ok: false, message: (await getT())(message), nonce: Date.now() });
const ok = async (message: string): Promise<ActionState> => ({ ok: true, message: (await getT())(message), nonce: Date.now() });

class Invalid extends Error {}
const id = (f: FormData, k: string) => { const r = z.string().uuid().safeParse(str(f, k)); if (!r.success) throw new Invalid("Sélection invalide."); return r.data; };
const opt = (f: FormData, k: string) => str(f, k) || null;
const url = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) return null;
  try { const u = new URL(v); if (!["http:", "https:"].includes(u.protocol)) throw 0; return u.toString(); } catch { throw new Invalid("Lien invalide (http/https attendu)."); }
};
const when = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new Invalid("Date invalide.");
  return parisLocalToISO(v);
};

/** Fabrique une action serveur qui appelle une fonction SQL d'administration.
 *  Les droits sont revérifiés EN BASE (is_admin) : rien ne dépend de l'interface. */
function rpc(name: string, build: (f: FormData) => Record<string, unknown>, success: string) {
  return async (_: ActionState, f: FormData): Promise<ActionState> => {
    try { return await callRpc(name, build(f), success); }
    catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
  };
}

export const validateRegistration = rpc("admin_validate_registration", (f) => ({ p_driver: id(f, "driver"), p_decision: str(f, "decision"), p_note: opt(f, "note") }), "Inscription traitée.");
export const setAccountStatus = rpc("admin_set_account_status", (f) => ({ p_driver: id(f, "driver"), p_status: str(f, "status"), p_reason: str(f, "reason") }), "Statut du compte mis à jour.");
export const reviewVehicle = rpc("admin_review_vehicle", (f) => ({ p_vehicle: id(f, "vehicle"), p_decision: str(f, "decision"), p_reason: opt(f, "reason") }), "Décision enregistrée.");
export const markVehicleLost = rpc("admin_mark_vehicle_lost", (f) => ({ p_driver: id(f, "driver"), p_reason: str(f, "reason") }), "Confiscation enregistrée.");
export const setSchedule = rpc("admin_set_schedule", (f) => ({ p_challenge: id(f, "challenge"), p_at: when(f, "when"), p_reason: str(f, "reason") }), "Programmation modifiée.");
export const cancelChallenge = rpc("admin_cancel_challenge", (f) => ({ p_challenge: id(f, "challenge"), p_reason: str(f, "reason"), p_free_week: f.get("free_week") === "on" }), "Duel annulé.");
export const declareForfeit = rpc("admin_declare_forfeit", (f) => ({ p_challenge: id(f, "challenge"), p_forfeiting: id(f, "forfeiting"), p_reason: str(f, "reason") }), "Forfait déclaré, classement mis à jour.");
export const recordRaceResult = rpc("admin_record_race_result", (f) => ({ p_race: id(f, "race"), p_winner: id(f, "winner"), p_clip: url(f, "clip"), p_notes: opt(f, "notes") }), "Résultat enregistré.");
export const validateChallenge = rpc("admin_validate_challenge", (f) => ({ p_challenge: id(f, "challenge"), p_clip: url(f, "clip") }), "Duel validé : classement et récompense mis à jour.");
export const applySanction = rpc("admin_apply_sanction", (f) => ({ p_driver: id(f, "driver"), p_type: str(f, "type"), p_reason: str(f, "reason"), p_reserve: str(f, "reserve") ? id(f, "reserve") : null }), "Sanction appliquée.");
export const recordAbsence = rpc("admin_record_absence", (f) => ({ p_driver: id(f, "driver"), p_from: str(f, "from"), p_to: opt(f, "to"), p_reason: str(f, "reason"), p_suspends: f.get("suspends") === "on" }), "Absence enregistrée.");
export const addReserve = rpc("admin_add_reserve", (f) => ({ p_driver: id(f, "driver") }), "Ajouté à la file des réservistes.");
export const removeReserve = rpc("admin_remove_reserve", (f) => ({ p_reserve: id(f, "reserve"), p_reason: str(f, "reason") }), "Réserviste retiré.");
export const promoteReserve = rpc("admin_promote_reserve", (f) => ({ p_reserve: id(f, "reserve"), p_position: str(f, "position") ? Number(str(f, "position")) : null }), "Réserviste promu.");
export const createWarmup = rpc("admin_create_warmup", (f) => ({ p_at: when(f, "when"), p_track: str(f, "track") ? id(f, "track") : null }), "Warm-up Race programmée.");
export const addWarmupParticipant = rpc("admin_warmup_participant", (f) => ({ p_event: id(f, "event"), p_driver: id(f, "driver"), p_add: true }), "Participant inscrit.");
export const removeWarmupParticipant = rpc("admin_warmup_participant", (f) => ({ p_event: id(f, "event"), p_driver: id(f, "driver"), p_add: false }), "Participant retiré.");
export const setWarmupStatus = rpc("admin_warmup_status", (f) => ({ p_event: id(f, "event"), p_status: str(f, "status") }), "Statut mis à jour.");
export const recordWarmupWinner = rpc("admin_record_warmup_winner", (f) => ({ p_event: id(f, "event"), p_winner: id(f, "winner"), p_notes: opt(f, "notes") }), "Vainqueur enregistré.");
export const validateWarmup = rpc("admin_validate_warmup", (f) => ({ p_event: id(f, "event") }), "Résultat validé : le vainqueur est éligible au #10.");
export const enterBlacklist = rpc("admin_enter_blacklist", (f) => ({ p_driver: id(f, "driver"), p_displace: f.get("displace") === "on" }), "Pilote intégré à la Blacklist.");
export const confirmPayment = rpc("admin_confirm_payment", (f) => ({ p_reward: id(f, "reward"), p_proof: url(f, "proof"), p_note: opt(f, "note") }), "Paiement confirmé.");
export const setRewardClip = rpc("admin_set_reward_clip", (f) => ({ p_reward: id(f, "reward"), p_clip: url(f, "clip") }), "Clip enregistré.");

export const shopOrder = rpc("admin_shop_order", (f) => ({ p_order: id(f, "order"), p_status: str(f, "status"), p_note: opt(f, "note") }), "Commande traitée.");
export const grantPoints = rpc("admin_grant_points", (f) => {
  const n = Math.trunc(Number(str(f, "delta")));
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1_000_000) throw new Invalid("Montant invalide.");
  return { p_user: id(f, "driver"), p_delta: n, p_reason: str(f, "reason") };
}, "Zigollars mis à jour.");

const itemSchema = z.object({
  name: z.string().min(2, "Nom trop court.").max(80), description: z.string().max(300), category: z.string().min(2, "Catégorie requise.").max(40),
  price: z.coerce.number().int("Prix invalide.").positive("Prix invalide.").max(1_000_000),
  stock: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).max(100000).optional()),
  sort: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().int().min(0).max(9999)),
});
export async function saveShopItem(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const p = itemSchema.safeParse({ name: str(f, "name"), description: str(f, "description"), category: str(f, "category"), price: str(f, "price"), stock: str(f, "stock"), sort: str(f, "sort") });
    if (!p.success) return await fail(p.error.issues[0]?.message ?? "Données invalides.");
    const supabase = await createClient();
    const existing = str(f, "id");
    const row = { ...p.data, description: p.data.description || null, stock: p.data.stock ?? null, active: f.get("active") === "on" };
    const { error } = existing ? await supabase.from("shop_items").update(row).eq("id", id(f, "id")) : await supabase.from("shop_items").insert(row);
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/", "layout");
    return await ok(existing ? "Article modifié." : "Article ajouté.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}
export async function deleteShopItem(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("shop_items").delete().eq("id", id(f, "id"));
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/", "layout");
    return await ok("Article supprimé.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

export async function setRanking(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const arr = Array.from({ length: 10 }, (_, i) => str(f, `pos${i + 1}`) || null);
    arr.forEach((v) => { if (v && !z.string().uuid().safeParse(v).success) throw new Invalid("Sélection invalide."); });
    return await callRpc("admin_set_ranking", { p_assignments: arr, p_reason: str(f, "reason") }, "Classement modifié et journalisé.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

/* ---------- Données éditoriales (écriture directe, protégée par RLS + audit automatique) ---------- */
export async function updateDriverInfo(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const p = z.object({ first_name: z.string().min(1).max(60), last_name: z.string().min(1).max(60), phone: z.string().max(30).refine((v) => v.replace(/\D/g, "").length >= 4) })
      .parse({ first_name: str(f, "first_name"), last_name: str(f, "last_name"), phone: str(f, "phone") });
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(p).eq("id", id(f, "driver"));
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/admin", "layout");
    return await ok("Informations du pilote mises à jour.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Informations invalides."); }
}

const trackSchema = z.object({
  name: z.string().min(2).max(80), start_point: z.string().min(1).max(120), end_point: z.string().min(1).max(120),
  distance_km: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().positive().max(999).optional()), difficulty: z.enum(["Easy", "Medium", "Hard", "Extreme"]),
  race_type: z.enum(["Sprint urbain", "Circuit", "Last Race", "Warm-up"]), status: z.enum(["active", "inactive"]), description: z.string().max(1000).optional(),
});

/** Autorisation d'envoi direct (navigateur -> stockage) d'une vidéo de circuit. Réservé aux organisateurs. */
export async function createTrackVideoUpload(ext: string): Promise<ActionState & { path?: string; token?: string }> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return await fail("Accès réservé aux organisateurs.");
  if (ext !== "mp4" && ext !== "webm") return await fail("Format non supporté (MP4 ou WebM).");
  const path = `videos/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from("track-images").createSignedUploadUrl(path);
  if (error || !data) return await fail("Envoi impossible.");
  return { ok: true, path, token: data.token, nonce: Date.now() };
}

export async function saveTrack(_: ActionState, f: FormData): Promise<ActionState> {
  const parsed = trackSchema.safeParse({ name: str(f, "name"), start_point: str(f, "start_point"), end_point: str(f, "end_point"), distance_km: str(f, "distance_km"), difficulty: str(f, "difficulty"), race_type: str(f, "race_type"), status: str(f, "status"), description: str(f, "description") });
  if (!parsed.success) return await fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const supabase = await createClient();
  const existing = str(f, "id");
  const row: Record<string, unknown> = { ...parsed.data, distance_km: parsed.data.distance_km ?? null, description: parsed.data.description || null };

  const file = f.get("image") as File | null;
  if (file && file.size > 0) {
    const img = await checkImage(file);
    if (!img.ok) return await fail(img.message);
    const path = `${crypto.randomUUID()}.${img.ext}`;
    const { error: upErr } = await supabase.storage.from("track-images").upload(path, img.bytes, { contentType: img.type });
    if (upErr) return await fail("Envoi de l'image impossible.");
    row.image_path = path;
    row.route_path = null; row.route_w = null; row.route_h = null;   // le tracé animé ne correspond plus à la nouvelle image
  }
  // Vidéo : le fichier est déjà dans le stockage (envoi direct) ; on ne garde que son chemin, strictement contrôlé
  const videoPath = str(f, "video_path");
  let oldVideo: string | null = null;
  if (existing && (videoPath || f.get("remove_video") === "on")) {
    const { data: cur } = await supabase.from("race_tracks").select("video_path").eq("id", existing).maybeSingle();
    oldVideo = cur?.video_path ?? null;
  }
  if (videoPath) {
    if (!/^videos\/[0-9a-f-]{36}\.(mp4|webm)$/.test(videoPath)) return await fail("Vidéo invalide.");
    row.video_path = videoPath;
  } else if (f.get("remove_video") === "on") {
    row.video_path = null;
  }
  const { error } = existing ? await supabase.from("race_tracks").update(row).eq("id", existing) : await supabase.from("race_tracks").insert(row);
  if (error) return await fail(cleanError(error.message));
  if (oldVideo && oldVideo !== row.video_path) await supabase.storage.from("track-images").remove([oldVideo]);
  revalidatePath("/", "layout");
  return await ok(existing ? "Circuit modifié." : "Circuit créé.");
}

export async function deleteTrack(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("race_tracks").delete().eq("id", id(f, "id"));
    if (error) return await fail(/foreign key/i.test(error.message) ? "Circuit utilisé par un duel ou une Warm-up : désactive-le plutôt." : cleanError(error.message));
    revalidatePath("/", "layout");
    return await ok("Circuit supprimé.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

export async function saveNews(_: ActionState, f: FormData): Promise<ActionState> {
  const p = z.object({ title: z.string().min(2).max(120), body: z.string().min(2).max(4000) }).safeParse({ title: str(f, "title"), body: str(f, "body") });
  if (!p.success) return await fail("Titre et texte requis.");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims(); const user = { id: claims?.claims?.sub as string | undefined };
  const publish = f.get("publish") === "on";
  const { error } = await supabase.from("announcements").insert({ ...p.data, published: publish, published_at: publish ? new Date().toISOString() : null, author_id: user?.id });
  if (error) return await fail(cleanError(error.message));
  revalidatePath("/", "layout");
  return await ok(publish ? "Annonce publiée sur la page d'accueil." : "Brouillon enregistré.");
}

export async function toggleNews(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const publish = str(f, "publish") === "1";
    const { error } = await supabase.from("announcements").update({ published: publish, published_at: publish ? new Date().toISOString() : null }).eq("id", id(f, "id"));
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/", "layout");
    return await ok(publish ? "Publiée." : "Retirée de l'accueil.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

export async function deleteNews(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id(f, "id"));
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/", "layout");
    return await ok("Annonce supprimée.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

// Valeurs autorisées pour chaque règle : on ne laisse pas saisir n'importe quoi dans la configuration
const settingSchemas: Record<string, z.ZodType> = {
  challenge_response_hours: z.number().int().min(1).max(720),
  challenges_per_week: z.number().int().min(1).max(7),
  inactivity_days: z.number().int().min(1).max(365),
  podium_size: z.number().int().min(0).max(10),
  timezone: z.string().refine((v) => { try { new Intl.DateTimeFormat("fr", { timeZone: v }); return true; } catch { return false; } }, "Fuseau inconnu"),
  rewards: z.record(z.string().regex(/^(10|[1-9])$/), z.number().int().min(0)).refine((o) => Object.keys(o).length === 10, "Les 10 rangs sont requis"),
  forbidden_vehicle_classes: z.array(z.string().min(1)),
  vehicle_classes: z.array(z.string().min(1)).min(1),
  vehicle_loss_scope: z.enum(["defender", "both"]),
  require_clip_for_validation: z.boolean(),
  forfeit_gives_reward: z.boolean(),
};

export async function saveSetting(_: ActionState, f: FormData): Promise<ActionState> {
  const key = str(f, "key");
  const schema = settingSchemas[key];
  if (!schema) return await fail("Règle inconnue.");
  let value: unknown;
  try { value = JSON.parse(str(f, "value")); } catch { return await fail("JSON invalide."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) return await fail(parsed.error.issues[0]?.message ?? "Valeur invalide.");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims(); const user = { id: claims?.claims?.sub as string | undefined };
  const { data, error } = await supabase.from("settings").update({ value: parsed.data, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("key", key).select("key");
  if (error) return await fail(cleanError(error.message));
  if (!data?.length) return await fail("Seul un super administrateur peut modifier les règles.");
  revalidatePath("/", "layout");
  return await ok("Règle mise à jour (journalisée).");
}

/** Réinitialisation du mot de passe d'un pilote par l'organisation (les pilotes n'ont pas d'email de récupération). */
export async function resetDriverPassword(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return await fail("Accès réservé aux organisateurs.");
    const password = String(f.get("password") ?? "");
    if (password.length < 10 || password.length > 72) return await fail("Mot de passe : 10 caractères minimum.");
    const driver = id(f, "driver");
    const svc = createServiceClient();
    const { error } = await svc.auth.admin.updateUserById(driver, { password });
    if (error) return await fail("Réinitialisation impossible.");
    const { data: claims } = await supabase.auth.getClaims();
    await svc.from("admin_logs").insert({ admin_id: claims?.claims?.sub, action: "driver:reset_password", target_type: "profile", target_id: driver });
    revalidatePath("/admin", "layout");
    return await ok("Mot de passe réinitialisé. Transmets-le au pilote de façon privée.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}

const tplSchema = z.object({ kind: z.enum(["registration", "vehicle", "duel"]), title: z.string().min(2).max(80), body: z.string().min(3).max(300) });
export async function saveTemplate(_: ActionState, f: FormData): Promise<ActionState> {
  const p = tplSchema.safeParse({ kind: str(f, "kind"), title: str(f, "title"), body: str(f, "body") });
  if (!p.success) return await fail("Titre (2 à 80 caractères) et texte (3 à 300) requis.");
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").insert(p.data);
  if (error) return await fail(cleanError(error.message));
  revalidatePath("/admin", "layout");
  return await ok("Modèle enregistré.");
}
export async function deleteTemplate(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("message_templates").delete().eq("id", id(f, "id"));
    if (error) return await fail(cleanError(error.message));
    revalidatePath("/admin", "layout");
    return await ok("Modèle supprimé.");
  } catch (e) { return await fail(e instanceof Invalid ? e.message : "Requête invalide."); }
}
