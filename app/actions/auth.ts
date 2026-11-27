"use server";
import { catalogBySlug } from "@/lib/vehicle-catalog";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
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
  const ident = str(f, "phone"), password = String(f.get("password") ?? "");
  if (!ident || !password) return { ok: false, message: t("Numéro de téléphone et mot de passe requis.") };
  const bad = { ok: false, message: t("Identifiants incorrects.") };

  // Identifiant = numéro de téléphone (espaces et tirets ignorés). Les anciens comptes peuvent aussi utiliser leur pseudo Discord.
  let email = ident.toLowerCase();
  if (!ident.includes("@")) {
    const admin = createServiceClient();
    const digits = ident.replace(/\D/g, "");
    let id: string | null = null;
    if (digits.length >= 4) {
      const { data } = await admin.from("profiles").select("id").eq("phone_key", digits).maybeSingle();
      id = data?.id ?? null;
    }
    if (!id) {
      const { data } = await admin.from("profiles").select("id").ilike("discord_tag", ident.replace(/[\\%_]/g, "\\$&")).maybeSingle();
      id = data?.id ?? null;
    }
    if (!id) return bad;
    const { data: u } = await admin.auth.admin.getUserById(id);
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
  await supabase.rpc("log_observer_login");   // sans effet pour un compte ordinaire
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
    phone: z.string().max(30).refine((v) => v.replace(/\D/g, "").length >= 4, t("Numéro de téléphone invalide")),
  });
  const parsed = registerSchema.safeParse({
    password: String(f.get("password") ?? ""),
    last_name: str(f, "last_name"), first_name: str(f, "first_name"), phone: str(f, "phone"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  // Le véhicule se choisit dans la liste des véhicules autorisés : marque, modèle et catégorie viennent de la liste, jamais du formulaire
  const car = catalogBySlug(str(f, "catalog_slug"));
  if (!car) return { ok: false, message: t("Choisis ton véhicule dans la liste des véhicules autorisés.") };
  const v = { ...parsed.data, make_model: car.label, vehicle_class: car.category };

  const admin = createServiceClient();
  // Règles de catégorie lues en base (modifiables par l'organisation)
  const { data: cfg } = await admin.from("settings").select("key,value").in("key", ["forbidden_vehicle_classes", "vehicle_classes"]);
  const forbidden: string[] = cfg?.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? [];
  if (forbidden.includes(v.vehicle_class)) return { ok: false, message: t("La catégorie « {c} » est interdite.", { c: v.vehicle_class }) };

  // Le numéro de téléphone est l'identifiant de connexion : il doit être libre
  const digits = v.phone.replace(/\D/g, "");
  const { data: taken } = await admin.from("profiles").select("id").eq("phone_key", digits).maybeSingle();
  if (taken) return { ok: false, message: t("Ce numéro de téléphone est déjà utilisé.") };

  const email = internalEmail();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({ email, password: v.password, email_confirm: true });
  if (userErr || !created.user) return { ok: false, message: t("Création du compte impossible.") };
  const uid = created.user.id;
  const rollback = async () => { await admin.auth.admin.deleteUser(uid); };

  const { error: pErr } = await admin.from("profiles").insert({ id: uid, first_name: v.first_name, last_name: v.last_name, phone: v.phone });
  if (pErr) { await rollback(); return { ok: false, message: /phone_key/.test(pErr.message) ? t("Ce numéro de téléphone est déjà utilisé.") : cleanError(pErr.message) }; }
  const { error: vErr } = await admin.from("vehicles").insert({ owner_id: uid, make_model: v.make_model, vehicle_class: v.vehicle_class });
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
