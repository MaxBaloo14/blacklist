#!/usr/bin/env node
// Contrôle rapide d'un projet Supabase déjà migré : vérifie que la RLS protège bien les données.
// Usage : node --env-file=.env.local scripts/smoke.mjs
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let bad = 0;
const check = (label, ok) => { console.log(ok ? "PASS" : "FAIL", label); if (!ok) bad++; };

const bl = await sb.from("public_blacklist").select("position");
check("classement public lisible (10 positions)", !bl.error && bl.data.length === 10);
const pr = await sb.from("profiles").select("id");
check("profils privés invisibles en anonyme", !pr.error && pr.data.length === 0);
const rw = await sb.from("rewards").select("id");
check("récompenses invisibles en anonyme", !rw.error && rw.data.length === 0);
const lg = await sb.from("admin_logs").select("id");
check("journal admin invisible en anonyme", !lg.error && lg.data.length === 0);
for (const fn of ["_write_ranking", "_notify", "_resolve_challenge", "admin_set_ranking", "create_challenge"]) {
  const r = await sb.rpc(fn, {});
  check(`RPC ${fn} refusée en anonyme`, !!r.error);
}
const up = await sb.from("blacklist_rankings").update({ driver_id: null }).eq("position", 1).select();
check("classement non modifiable en anonyme", !up.data?.length);
console.log(bad ? `\n${bad} contrôle(s) en échec` : "\nTout est conforme.");
process.exit(bad ? 1 : 0);
