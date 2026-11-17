#!/usr/bin/env node
// Contrôle rapide d'un projet Supabase déjà migré : vérifie que la RLS protège bien les données.
// Usage : node --env-file=.env.local scripts/smoke.mjs
// Une erreur réseau est un ÉCHEC (jamais un faux « PASS »).
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let bad = 0;
const check = (label, ok) => { console.log(ok ? "PASS" : "FAIL", label); if (!ok) bad++; };
const network = (e) => !e || /fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(`${e.message} ${e.details}`);
const denied = (e) => e && !network(e) && (e.code === "42501" || e.code === "PGRST202" || /permission denied|row-level security|not found/i.test(e.message));

const bl = await sb.from("public_blacklist").select("position");
check("classement public lisible (10 positions)", !bl.error && bl.data?.length === 10);
for (const t of ["profiles", "rewards", "notifications", "admin_logs", "user_roles", "challenges"]) {
  const r = await sb.from(t).select("id,user_id", { head: false }).limit(1);
  check(`table ${t} : aucune donnée privée en anonyme`, !r.error ? r.data.length === 0 : false);
}
for (const fn of ["_write_ranking", "_notify", "_resolve_challenge", "admin_set_ranking", "create_challenge", "run_alerts"]) {
  const r = await sb.rpc(fn, {});
  check(`RPC ${fn} refusée en anonyme`, denied(r.error));
}
const up = await sb.from("blacklist_rankings").update({ driver_id: null }).eq("position", 1).select();
check("classement non modifiable en anonyme", !up.error ? up.data.length === 0 : denied(up.error));
const ins = await sb.from("race_tracks").insert({ name: "x", start_point: "a", end_point: "b", distance_km: 1, difficulty: "Easy", race_type: "Circuit" });
check("création de circuit refusée en anonyme", denied(ins.error));
console.log(bad ? `\n${bad} contrôle(s) en échec` : "\nTout est conforme.");
process.exit(bad ? 1 : 0);
