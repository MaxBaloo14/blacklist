#!/usr/bin/env node
// Crée (ou promeut) un compte ORGANISATEUR, distinct des comptes pilotes.
// Usage : node --env-file=.env.local scripts/create-admin.mjs email@exemple.com "MotDePasseLong" [super_admin|admin]
import { createClient } from "@supabase/supabase-js";

const [email, password, role = "admin"] = process.argv.slice(2);
if (!email || !password || !["admin", "super_admin"].includes(role)) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <mot_de_passe_12+> [admin|super_admin]');
  process.exit(1);
}
if (password.length < 12) { console.error("Mot de passe : 12 caractères minimum pour un organisateur."); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let { data: created, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error && /already/i.test(error.message)) {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === email);
  if (!existing) { console.error(error.message); process.exit(1); }
  created = { user: existing };
} else if (error) { console.error(error.message); process.exit(1); }

const { error: rErr } = await sb.from("user_roles").upsert({ user_id: created.user.id, role, label: email });
if (rErr) { console.error(rErr.message); process.exit(1); }
console.log(`OK — ${email} est maintenant ${role}. Connexion : /admin/login`);
