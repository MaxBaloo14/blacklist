# BLACKLIST — BOOBOO CREW

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Framer Motion · Supabase (PostgreSQL, Auth, Storage) · Vercel.

## Mise en route
1. Crée un projet Supabase. Exécute dans l'ordre `supabase/migrations/0001_schema.sql`, `0002_functions.sql`, `0003_storage.sql` (SQL Editor ou `supabase db push`).
2. Copie `.env.example` en `.env.local` et renseigne les 3 clés. `SUPABASE_SERVICE_ROLE_KEY` est secrète : variable serveur uniquement (Vercel, non publique).
3. `npm install && npm run dev`
4. Crée le premier organisateur : `node --env-file=.env.local scripts/create-admin.mjs email "motdepasse12+" super_admin` puis connecte-toi sur `/admin/login`.
5. Vérifie la sécurité : `node --env-file=.env.local scripts/smoke.mjs`
6. Programme `select run_alerts();` (pg_cron, toutes les heures) ou laisse le dashboard admin le déclencher à chaque ouverture.

## Architecture de sécurité
- Aucune donnée de compétition n'est modifiable en direct : tout passe par des fonctions SQL `security definer` (atomiques, verrou global, journalisées) qui lisent l'identité dans `auth.uid()` et les droits dans `user_roles`.
- RLS sur toutes les tables ; vues publiques en lecture seule sans donnée privée.
- Comptes organisateurs distincts des comptes pilotes (`/admin/login`, privilèges vérifiés en base).
- Règles (48 h, 14 jours, primes, catégories interdites…) dans la table `settings`, éditables dans l'admin (super admin).

## Tests
`npm run test:db` : rejoue ~200 vérifications SQL sur un Postgres local (comptes multiples, permissions, règles de duel, podium, forfait, primes, véhicules, inactivité, sanctions, réserve, Warm-up, journal).
