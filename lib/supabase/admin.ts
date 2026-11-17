import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client « service role » : contourne la RLS. SERVEUR UNIQUEMENT.
 * Utilisé exclusivement pour l'inscription (création de compte) — jamais exposé au navigateur.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
