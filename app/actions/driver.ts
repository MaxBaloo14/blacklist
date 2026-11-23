"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callRpc, cleanError, str } from "@/lib/action";
import { checkImage } from "@/lib/upload";
import { rateLimit } from "@/lib/rate-limit";
import { parisLocalToISO } from "@/lib/format";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();
const fail = async (message: string): Promise<ActionState> => ({ ok: false, message: (await getT())(message), nonce: Date.now() });

async function userId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, uid: (data?.claims?.sub as string | undefined) ?? null };
}

export async function createChallenge(_: ActionState, f: FormData): Promise<ActionState> {
  const { uid } = await userId();
  if (!uid) return await fail("Connexion requise.");
  if (!(await rateLimit("challenge", 6, 60_000, uid))) return await fail("Trop de requêtes. Patiente un instant.");
  const target = uuid.safeParse(str(f, "target"));
  if (!target.success) return await fail("Cible invalide.");
  // 3 créneaux différents proposés par le challenger : un jour de la semaine + une heure entre 21 h et 23 h 30 (heure de Paris)
  const slots: string[] = [];
  for (const i of [1, 2, 3]) {
    const day = str(f, `slot_day_${i}`), time = str(f, `slot_time_${i}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^(21|22|23):(00|30)$/.test(time)) return await fail("Propose 3 créneaux complets (jour et heure entre 21 h et 23 h 30).");
    slots.push(parisLocalToISO(`${day}T${time}`));
  }
  if (new Set(slots).size !== 3) return await fail("Propose exactement 3 créneaux différents.");
  return callRpc("create_challenge", { p_target: target.data, p_slots: slots }, (await getT())("Défi lancé ! Le pilote défié choisit parmi tes 3 créneaux."), ["/challenges", "/profile"]);
}

export async function scheduleChallenge(_: ActionState, f: FormData): Promise<ActionState> {
  const id = uuid.safeParse(str(f, "challenge"));
  const when = str(f, "when"), slot = str(f, "slot");
  // créneau choisi parmi ceux proposés (valeur ISO exacte) ; saisie libre seulement si le challenger n'en a proposé aucun
  const iso = slot ? (Number.isNaN(Date.parse(slot)) ? null : new Date(slot).toISOString()) : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? parisLocalToISO(when) : null;
  if (!id.success || !iso) return await fail("Date invalide.");
  return callRpc("schedule_challenge", { p_challenge: id.data, p_at: iso }, (await getT())("Date du duel enregistrée. Les deux pilotes sont prévenus."), ["/challenges", "/profile"]);
}

export async function setRaceTrack(_: ActionState, f: FormData): Promise<ActionState> {
  const race = uuid.safeParse(str(f, "race")), track = uuid.safeParse(str(f, "track"));
  if (!race.success || !track.success) return await fail("Choisis un circuit.");
  return callRpc("set_race_track", { p_race: race.data, p_track: track.data }, (await getT())("Circuit choisi."), ["/challenges"]);
}

const profileSchema = z.object({
  first_name: z.string().min(1).max(60), last_name: z.string().min(1).max(60),
  phone: z.string().max(30).refine((v) => v.replace(/\D/g, "").length >= 4), discord_tag: z.string().max(40),
  bank_iban: z.string().max(40).refine((v) => v === "" || (v.length >= 3 && /^[A-Za-z0-9 -]+$/.test(v))),
});

export async function updateProfile(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, uid } = await userId();
  if (!uid) return await fail("Connexion requise.");
  const p = profileSchema.safeParse({ first_name: str(f, "first_name"), last_name: str(f, "last_name"), phone: str(f, "phone"), discord_tag: str(f, "discord_tag"), bank_iban: str(f, "bank_iban") });
  if (!p.success) return await fail("Informations invalides : tous les champs sont requis.");
  // La RLS et les droits de colonnes limitent la mise à jour à ces champs, pour son propre compte.
  const { error } = await supabase.from("profiles").update({ ...p.data, discord_tag: p.data.discord_tag || null, bank_iban: p.data.bank_iban || null }).eq("id", uid);
  if (error) return await fail(/phone_key/.test(error.message) ? "Ce numéro de téléphone est déjà utilisé." : cleanError(error.message));
  revalidatePath("/profile");
  return { ok: true, message: (await getT())("Informations mises à jour."), nonce: Date.now() };
}

export async function proposeVehicle(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, uid } = await userId();
  if (!uid) return await fail("Connexion requise.");
  if (!(await rateLimit("vehicle", 5, 60 * 60_000, uid))) return await fail("Trop de propositions. Réessaie plus tard.");
  const make = str(f, "make_model"), cls = str(f, "vehicle_class");
  if (make.length < 2 || make.length > 80 || !cls) return await fail("Marque, modèle et catégorie requis.");
  // Photo facultative : si elle est fournie, elle est vérifiée puis stockée dans le dossier du pilote
  let path: string | null = null;
  const file = f.get("photo") as File | null;
  if (file && file.size > 0) {
    const img = await checkImage(file);
    if (!img.ok) return await fail(img.message);
    path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
    const { error: upErr } = await supabase.storage.from("vehicle-photos").upload(path, img.bytes, { contentType: img.type });
    if (upErr) return await fail("Envoi de la photographie impossible.");
  }
  const { error } = await supabase.rpc("propose_vehicle", { p_make_model: make, p_class: cls, p_photo_path: path, p_is_shop: false });
  if (error) { if (path) await supabase.storage.from("vehicle-photos").remove([path]); return await fail(cleanError(error.message)); }
  revalidatePath("/profile");
  return { ok: true, message: (await getT())("Véhicule soumis à homologation."), nonce: Date.now() };
}

export async function cancelProposal(): Promise<ActionState> {
  return callRpc("cancel_vehicle_proposal", {}, (await getT())("Demande annulée."), ["/profile"]);
}

export async function markAllRead(): Promise<ActionState> {
  return callRpc("mark_notifications_read", {}, (await getT())("Tout est lu."), ["/notifications"]);
}

export async function predictDuel(_: ActionState, f: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(str(f, "challenge")), pick = z.enum(["challenger", "defender"]).safeParse(str(f, "pick"));
  if (!id.success || !pick.success) return await fail("Choix invalide.");
  return callRpc("predict_duel", { p_challenge: id.data, p_pick: pick.data }, (await getT())("Pronostic enregistré."), ["/blacklist", "/calendar"]);
}
