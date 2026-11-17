import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, hasSupabase } from "@/lib/supabase/server";
import type { Row } from "@/lib/types";

/**
 * Session de la requête, calculée UNE seule fois (cache React) même si Nav, la page et le layout la demandent.
 * L'identité vient de getClaims() : le jeton est vérifié localement (clés publiques de signature),
 * sans aller-retour réseau vers Supabase. Les droits (admin) restent lus en base.
 */
export const getSession = cache(async () => {
  const empty = { supabase: null, user: null as { id: string; email?: string } | null, profile: null as Row | null, isAdmin: false, unread: 0 };
  if (!hasSupabase) return empty;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { ...empty, supabase };
  const [{ data: profile }, { data: isAdmin }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { supabase, user: { id: uid, email: data!.claims.email as string | undefined }, profile: profile as Row | null, isAdmin: Boolean(isAdmin), unread: count ?? 0 };
});

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
