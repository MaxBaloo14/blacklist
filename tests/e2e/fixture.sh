#!/bin/bash
# Prépare l'environnement de test complet : base, faux Supabase, serveur, pilotes, duels, historique.
cd "$(dirname "$0")/../.."
for c in $(pg_lsclusters -h 2>/dev/null | awk '{print $1"/"$2}'); do pg_ctlcluster "${c%/*}" "${c#*/}" start 2>/dev/null; done; sleep 2
pkill -f "next start"; pkill -f next-server; pkill -f mock-supabase
tests/e2e/db.sh >/dev/null 2>&1
su postgres -c "psql -d bl_e2e -q -c 'delete from challenges' -c 'delete from ranking_history' -c \"delete from auth.users where email like 'demo-%'\""
export VEHICLE_IMG_TEST_ORIGIN=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_e2e SUPABASE_SERVICE_ROLE_KEY=sb_secret_e2e
(setsid nohup node tests/e2e/mock-supabase.mjs >/tmp/mock.log 2>&1 &); sleep 1
node scripts/create-admin.mjs orga@test.local "MotDePasseOrga123" super_admin >/dev/null
rm -f /tmp/e2e-admin-state.json; rm -rf .next/types .next/cache/fetch-cache
[ "$1" = "build" ] && npx next build 2>&1 | grep -iE "error|failed"
# faux service push en HTTPS (certificat de test) : le serveur du site doit lui faire confiance et l'autoriser
[ -f /tmp/e2e-push-cert.pem ] || openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /tmp/e2e-push-key.pem -out /tmp/e2e-push-cert.pem -days 365 -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1" >/dev/null 2>&1
export NODE_EXTRA_CA_CERTS=/tmp/e2e-push-cert.pem PUSH_ALLOW_HOSTS=127.0.0.1:9443 DISABLE_RATE_LIMIT=${DISABLE_RATE_LIMIT:-1}
(setsid nohup npx next start -p 3100 >/tmp/next.log 2>&1 &); sleep 4
node tests/e2e/seed.mjs || { echo "ÉCHEC du jeu de données de test (seed)"; tail -20 /tmp/next.log; exit 1; }
su postgres -c "psql -d bl_e2e -q" <<'SQL'
insert into challenges(challenger_id, defender_id, challenger_position, defender_position, is_podium, week_start, status, respond_by, scheduled_at, validated_at, winner_id, champion_wins, challenger_wins)
select l.id, m.id, 5, 4, false, current_date-30, 'completed'::challenge_status, now()-interval '25 days', now()-interval '24 days', now()-interval '24 days', m.id, 0, 0 from (select id from profiles where first_name='Lio') l, (select id from profiles where first_name='Mika') m
union all select l.id, z.id, 4, 3, true, current_date-20, 'completed'::challenge_status, now()-interval '15 days', now()-interval '14 days', now()-interval '14 days', z.id, 2, 1 from (select id from profiles where first_name='Lio') l, (select id from profiles where first_name='Zane') z
union all select l.id, z.id, 4, 3, true, current_date-10, 'completed'::challenge_status, now()-interval '8 days', now()-interval '7 days', now()-interval '7 days', l.id, 1, 2 from (select id from profiles where first_name='Lio') l, (select id from profiles where first_name='Zane') z
union all select r.id, k.id, 2, 1, true, current_date, 'scheduled'::challenge_status, now()+interval '2 days', now()+interval '5 days', null, null, 0, 0 from (select id from profiles where first_name='Ryn') r, (select id from profiles where first_name='Kael') k;
delete from ranking_history;
insert into ranking_history(driver_id, from_position, to_position, kind, reason, created_at)
select id, 2, 1, 'duel', 'Duel', now()-interval '70 days' from profiles where first_name='Zane'
union all select id, 2, 1, 'duel', 'Duel', now()-interval '35 days' from profiles where first_name='Ryn'
union all select id, 3, 1, 'duel', 'Duel', now()-interval '12 days' from profiles where first_name='Kael';
SQL
rm -rf .next/cache/fetch-cache
echo "fixture prête"
