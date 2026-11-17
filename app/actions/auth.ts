"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkImage } from "@/lib/upload";
import { rateLimit } from "@/lib/rate-limit";
import { cleanError, str } from "@/lib/action";
import type { ActionState } from "@/lib/types";

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/admin") ? n : "/profile");

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  if (!(await rateLimit("login", 8, 10 * 60_000))) return { ok: false, message: "Trop de tentatives. Réessaie dans quelques minutes." };
  const email = str(f, "email").toLowerCase(), password = String(f.get("password") ?? "");
  if (!email || !password) return { ok: false, message: "Email et mot de passe requis." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, message: "Identifiants incorrects." };
  const { data: profile } = await supabase.from("profiles").select("account_status").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, message: "Aucun compte pilote pour cet email. L'organisation se connecte via son propre accès." };
  }
  if (profile.account_status === "banned") {
    await supabase.auth.signOut();
    return { ok: false, message: "Ce compte a été banni." };
  }
  await supabase.rpc("touch_activity");
  redirect(safeNext(str(f, "next")));
}

/** Connexion organisation : séparée de l'espace pilote, les droits sont lus en base (user_roles). */
export async function adminLogin(_: ActionState, f: FormData): Promise<ActionState> {
  if (!(await rateLimit("admin-login", 5, 10 * 60_000))) return { ok: false, message: "Trop de tentatives. Réessaie dans quelques minutes." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(f, "email").toLowerCase(), password: String(f.get("password") ?? "") });
  if (error || !data.user) return { ok: false, message: "Identifiants incorrects." };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    await supabase.auth.signOut();
    return { ok: false, message: "Accès refusé : ce compte n'a pas les privilèges d'organisateur." };
  }
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

const registerSchema = z.object({
  email: z.string().email("Email invalide").max(120),
  password: z.string().min(10, "Mot de passe : 10 caractères minimum").max(72),
  last_name: z.string().min(1, "Nom requis").max(60),
  first_name: z.string().min(1, "Prénom requis").max(60),
  phone: z.string().min(4, "Numéro de téléphone invalide").max(30),
  discord_tag: z.string().min(2, "Pseudo Discord requis").max(40),
  make_model: z.string().min(2, "Marque et modèle requis").max(80),
  vehicle_class: z.string().min(1, "Catégorie requise"),
  shop: z.enum(["no", "yes"], { message: "Précise si le véhicule vient de la boutique" }),
});

export async function register(_: ActionState, f: FormData): Promise<ActionState> {
  // Anti-bot : champ piège invisible
  if (str(f, "website")) return { ok: true, message: "Inscription enregistrée." };
  if (!(await rateLimit("register", 5, 60 * 60_000))) return { ok: false, message: "Trop d'inscriptions depuis cette adresse. Réessaie plus tard." };

  const parsed = registerSchema.safeParse({
    email: str(f, "email").toLowerCase(), password: String(f.get("password") ?? ""),
    last_name: str(f, "last_name"), first_name: str(f, "first_name"), phone: str(f, "phone"), discord_tag: str(f, "discord_tag"),
    make_model: str(f, "make_model"), vehicle_class: str(f, "vehicle_class"), shop: str(f, "shop"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.shop === "yes") return { ok: false, message: "Les véhicules de boutique sont interdits sur la Blacklist." };

  const img = await checkImage(f.get("photo") as File | null);
  if (!img.ok) return { ok: false, message: img.message };

  const admin = createServiceClient();
  // Règles de catégorie lues en base (modifiables par l'organisation)
  const { data: cfg } = await admin.from("settings").select("key,value").in("key", ["forbidden_vehicle_classes", "vehicle_classes"]);
  const forbidden: string[] = cfg?.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? [];
  const allowed: string[] = cfg?.find((s) => s.key === "vehicle_classes")?.value ?? [];
  if (forbidden.includes(v.vehicle_class)) return { ok: false, message: `La catégorie « ${v.vehicle_class} » est interdite.` };
  if (!allowed.includes(v.vehicle_class)) return { ok: false, message: "Catégorie de véhicule inconnue." };

  const { data: created, error: userErr } = await admin.auth.admin.createUser({ email: v.email, password: v.password, email_confirm: true });
  if (userErr || !created.user) {
    return { ok: false, message: /already|registered|exists/i.test(userErr?.message ?? "") ? "Un compte existe déjà avec cet email." : "Création du compte impossible." };
  }
  const uid = created.user.id;
  const path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
  const rollback = async () => { await admin.storage.from("vehicle-photos").remove([path]); await admin.auth.admin.deleteUser(uid); };

  const { error: pErr } = await admin.from("profiles").insert({ id: uid, first_name: v.first_name, last_name: v.last_name, phone: v.phone, discord_tag: v.discord_tag });
  if (pErr) { await rollback(); return { ok: false, message: cleanError(pErr.message) }; }
  const { error: upErr } = await admin.storage.from("vehicle-photos").upload(path, img.bytes, { contentType: img.type, upsert: false });
  if (upErr) { await rollback(); return { ok: false, message: "Envoi de la photographie impossible." }; }
  const { error: vErr } = await admin.from("vehicles").insert({ owner_id: uid, make_model: v.make_model, vehicle_class: v.vehicle_class, photo_path: path });
  if (vErr) { await rollback(); return { ok: false, message: cleanError(vErr.message) }; }
  const { data: admins } = await admin.from("user_roles").select("user_id");
  if (admins?.length) {
    await admin.from("notifications").insert([...new Set(admins.map((a) => a.user_id))].map((id) => ({
      user_id: id, kind: "registration_new", title: "New registration", body: `${v.first_name} ${v.last_name} — ${v.make_model}`, link: "/admin/drivers",
    })));
  }

  // Connecte le nouveau pilote (cookie de session posé côté serveur)
  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  if (signErr) redirect("/login?registered=1");
  redirect("/profile?welcome=1");
}
