"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkImage } from "@/lib/upload";
import { rateLimit } from "@/lib/rate-limit";
import { cleanError, str } from "@/lib/action";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/admin") ? n : "/profile");
// Supabase Auth exige une adresse : on en génère une interne et unique. Le pilote ne la voit jamais, il se connecte avec son pseudo Discord.
const internalEmail = () => `${crypto.randomUUID()}@pilote.blacklist-bbc.app`;

export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const t = await getT();
  if (!(await rateLimit("login", 8, 10 * 60_000))) return { ok: false, message: t("Trop de tentatives. Réessaie dans quelques minutes.") };
  const pseudo = str(f, "pseudo"), password = String(f.get("password") ?? "");
  if (!pseudo || !password) return { ok: false, message: t("Pseudo Discord et mot de passe requis.") };
  const bad = { ok: false, message: t("Identifiants incorrects.") };

  // On retrouve le compte à partir du pseudo, côté serveur (la clé secrète n'est jamais exposée au navigateur)
  let email = pseudo.toLowerCase();
  if (!pseudo.includes("@")) {
    const admin = createServiceClient();
    const { data: prof } = await admin.from("profiles").select("id").ilike("discord_tag", pseudo.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    if (!prof) return bad;
    const { data: u } = await admin.auth.admin.getUserById(prof.id);
    if (!u?.user?.email) return bad;
    email = u.user.email;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return bad;
  const { data: profile } = await supabase.from("profiles").select("account_status").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, message: t("Aucun compte pilote correspondant. L'organisation se connecte via son propre accès.") };
  }
  if (profile.account_status === "banned") {
    await supabase.auth.signOut();
    return { ok: false, message: t("Ce compte a été banni.") };
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

export async function register(_: ActionState, f: FormData): Promise<ActionState> {
  const t = await getT();
  // Anti-bot : champ piège invisible
  if (str(f, "website")) return { ok: true, message: t("Inscription enregistrée.") };
  if (!(await rateLimit("register", 5, 60 * 60_000))) return { ok: false, message: t("Trop d'inscriptions depuis cette adresse. Réessaie plus tard.") };

  const registerSchema = z.object({
    password: z.string().min(10, t("Mot de passe : 10 caractères minimum")).max(72),
    last_name: z.string().min(1, t("Nom requis")).max(60),
    first_name: z.string().min(1, t("Prénom requis")).max(60),
    phone: z.string().min(4, t("Numéro de téléphone invalide")).max(30),
    discord_tag: z.string().min(2, t("Pseudo Discord requis")).max(40).refine((v) => !v.includes("@"), t("Le pseudo Discord ne peut pas contenir « @ »")),
    make_model: z.string().min(2, t("Marque et modèle requis")).max(80),
    vehicle_class: z.string().min(1, t("Catégorie requise")),
    shop: z.enum(["no", "yes"], { message: t("Précise si le véhicule vient de la boutique") }),
  });
  const parsed = registerSchema.safeParse({
    password: String(f.get("password") ?? ""),
    last_name: str(f, "last_name"), first_name: str(f, "first_name"), phone: str(f, "phone"), discord_tag: str(f, "discord_tag"),
    make_model: str(f, "make_model"), vehicle_class: str(f, "vehicle_class"), shop: str(f, "shop"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.shop === "yes") return { ok: false, message: t("Les véhicules de boutique sont interdits sur la Blacklist.") };

  const img = await checkImage(f.get("photo") as File | null);
  if (!img.ok) return { ok: false, message: t(img.message) };

  const admin = createServiceClient();
  // Règles de catégorie lues en base (modifiables par l'organisation)
  const { data: cfg } = await admin.from("settings").select("key,value").in("key", ["forbidden_vehicle_classes", "vehicle_classes"]);
  const forbidden: string[] = cfg?.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? [];
  const allowed: string[] = cfg?.find((s) => s.key === "vehicle_classes")?.value ?? [];
  if (forbidden.includes(v.vehicle_class)) return { ok: false, message: t("La catégorie « {c} » est interdite.", { c: v.vehicle_class }) };
  if (!allowed.includes(v.vehicle_class)) return { ok: false, message: t("Catégorie de véhicule inconnue.") };

  // Le pseudo Discord est l'identifiant de connexion : il doit être libre
  const { data: taken } = await admin.from("profiles").select("id").ilike("discord_tag", v.discord_tag.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (taken) return { ok: false, message: t("Ce pseudo Discord est déjà utilisé.") };

  const email = internalEmail();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({ email, password: v.password, email_confirm: true });
  if (userErr || !created.user) return { ok: false, message: t("Création du compte impossible.") };
  const uid = created.user.id;
  const path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
  const rollback = async () => { await admin.storage.from("vehicle-photos").remove([path]); await admin.auth.admin.deleteUser(uid); };

  const { error: pErr } = await admin.from("profiles").insert({ id: uid, first_name: v.first_name, last_name: v.last_name, phone: v.phone, discord_tag: v.discord_tag });
  if (pErr) { await rollback(); return { ok: false, message: /discord_unique/.test(pErr.message) ? t("Ce pseudo Discord est déjà utilisé.") : cleanError(pErr.message) }; }
  const { error: upErr } = await admin.storage.from("vehicle-photos").upload(path, img.bytes, { contentType: img.type, upsert: false });
  if (upErr) { await rollback(); return { ok: false, message: t("Envoi de la photographie impossible.") }; }
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
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: v.password });
  if (signErr) redirect("/login?registered=1");
  redirect("/profile?welcome=1");
}
