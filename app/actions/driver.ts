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
  return callRpc("create_challenge", { p_target: target.data }, (await getT())("Défi lancé ! Le pilote défié a 48 h pour fixer la date."), ["/challenges", "/profile"]);
}

export async function scheduleChallenge(_: ActionState, f: FormData): Promise<ActionState> {
  const id = uuid.safeParse(str(f, "challenge"));
  const when = str(f, "when");
  if (!id.success || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return await fail("Date invalide.");
  return callRpc("schedule_challenge", { p_challenge: id.data, p_at: parisLocalToISO(when) }, (await getT())("Date du duel enregistrée. Les deux pilotes sont prévenus."), ["/challenges", "/profile"]);
}

export async function setRaceTrack(_: ActionState, f: FormData): Promise<ActionState> {
  const race = uuid.safeParse(str(f, "race")), track = uuid.safeParse(str(f, "track"));
  if (!race.success || !track.success) return await fail("Choisis un circuit.");
  return callRpc("set_race_track", { p_race: race.data, p_track: track.data }, (await getT())("Circuit choisi."), ["/challenges"]);
}

const profileSchema = z.object({
  first_name: z.string().min(1).max(60), last_name: z.string().min(1).max(60),
  phone: z.string().min(4).max(30), discord_tag: z.string().min(2).max(40),
});

export async function updateProfile(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, uid } = await userId();
  if (!uid) return await fail("Connexion requise.");
  const p = profileSchema.safeParse({ first_name: str(f, "first_name"), last_name: str(f, "last_name"), phone: str(f, "phone"), discord_tag: str(f, "discord_tag") });
  if (!p.success) return await fail("Informations invalides : tous les champs sont requis.");
  // La RLS et les droits de colonnes limitent la mise à jour à ces 4 champs, pour son propre compte.
  const { error } = await supabase.from("profiles").update(p.data).eq("id", uid);
  if (error) return await fail(cleanError(error.message));
  revalidatePath("/profile");
  return { ok: true, message: (await getT())("Informations mises à jour."), nonce: Date.now() };
}

export async function proposeVehicle(_: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, uid } = await userId();
  if (!uid) return await fail("Connexion requise.");
  if (!(await rateLimit("vehicle", 5, 60 * 60_000, uid))) return await fail("Trop de propositions. Réessaie plus tard.");
  const make = str(f, "make_model"), cls = str(f, "vehicle_class");
  if (make.length < 2 || make.length > 80 || !cls) return await fail("Marque, modèle et catégorie requis.");
  if (str(f, "shop") !== "no") return await fail("Les véhicules de boutique sont interdits.");
  const img = await checkImage(f.get("photo") as File | null);
  if (!img.ok) return await fail(img.message);
  const path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
  const { error: upErr } = await supabase.storage.from("vehicle-photos").upload(path, img.bytes, { contentType: img.type });
  if (upErr) return await fail("Envoi de la photographie impossible.");
  const { error } = await supabase.rpc("propose_vehicle", { p_make_model: make, p_class: cls, p_photo_path: path, p_is_shop: false });
  if (error) { await supabase.storage.from("vehicle-photos").remove([path]); return await fail(cleanError(error.message)); }
  revalidatePath("/profile");
  return { ok: true, message: (await getT())("Véhicule soumis à homologation."), nonce: Date.now() };
}

export async function cancelProposal(): Promise<ActionState> {
  return callRpc("cancel_vehicle_proposal", {}, (await getT())("Demande annulée."), ["/profile"]);
}

export async function markAllRead(): Promise<ActionState> {
  return callRpc("mark_notifications_read", {}, (await getT())("Tout est lu."), ["/notifications"]);
}
