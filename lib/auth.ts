import { redirect } from "next/navigation";
import { createClient, hasSupabase } from "@/lib/supabase/server";
import type { Row } from "@/lib/types";

export async function getSession() {
  if (!hasSupabase) return { supabase: null, user: null, profile: null as Row | null, isAdmin: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Row | null, isAdmin: false };
  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  return { supabase, user, profile: profile as Row | null, isAdmin: Boolean(isAdmin) };
}

/** Espace pilote : exige un compte pilote (profil). Un compte organisateur est renvoyé vers son interface. */
export async function requireDriver() {
  const s = await getSession();
  if (!s.user) redirect("/login");
  if (!s.profile) redirect(s.isAdmin ? "/admin" : "/login");
  if (s.profile.account_status === "banned") redirect("/login?error=banned");
  return { ...s, supabase: s.supabase!, user: s.user, profile: s.profile };
}

/** Espace organisation : privilèges vérifiés en base (table user_roles), jamais côté navigateur. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s.user) redirect("/admin/login");
  if (!s.isAdmin) redirect("/admin/login?error=forbidden");
  const { data: superAdmin } = await s.supabase!.rpc("is_super_admin");
  return { ...s, supabase: s.supabase!, user: s.user, isSuperAdmin: Boolean(superAdmin) };
}
