\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

-- ===== Outils de test =====
create or replace function t_uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid $$;
create or replace function t_as(n int) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', t_uid(n)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function t_anon() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create or replace function t_fail(q text, label text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise notice 'PASS  %  [%]', label, left(sqlerrm, 80); return; end;
  raise exception 'FAIL  % — aurait dû être refusé', label;
end $$;
create or replace function t_ok(q text, label text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then raise exception 'FAIL  % — erreur inattendue : %', label, sqlerrm; end;
  raise notice 'PASS  %', label;
end $$;
create or replace function t_eq(label text, actual text, expected text) returns void language plpgsql as $$ begin
  if actual is distinct from expected then raise exception 'FAIL  % — obtenu %, attendu %', label, actual, expected; end if;
  raise notice 'PASS  % = %', label, actual;
end $$;
create or replace function t_rows(label text, q text, expected int) returns void language plpgsql as $$
declare n int; begin
  execute q; get diagnostics n = row_count;
  if n <> expected then raise exception 'FAIL  % — % ligne(s) modifiée(s), attendu %', label, n, expected; end if;
  raise notice 'PASS  % (% ligne)', label, n;
end $$;
\echo ''
\echo '### 0. Données de départ'
-- 2 admins (1 = super admin) + 14 pilotes (11..24)
insert into auth.users(id,email) select t_uid(n), 'u'||n||'@test' from generate_series(1,24) n;
insert into user_roles values (t_uid(1),'super_admin'),(t_uid(2),'admin');
insert into profiles(id,first_name,last_name,phone,discord_tag,registration_status)
  select t_uid(n), 'Prenom'||n, 'Nom'||n, '0600'||n, 'disc'||n, 'validated' from generate_series(11,24) n;
insert into vehicles(owner_id,make_model,vehicle_class,photo_path)
  select t_uid(n), 'Marque Modele '||n, 'Sportives', t_uid(n)||'/car.jpg' from generate_series(11,24) n;
select t_as(2);
select admin_review_vehicle(id,'approved') from vehicles;
reset role;
select t_eq('14 véhicules homologués', (select count(*) from vehicles where status='approved')::text, '14');
select t_as(2);
select admin_set_ranking(jsonb_build_array(t_uid(11),t_uid(12),t_uid(13),t_uid(14),t_uid(15),t_uid(16),t_uid(17),t_uid(18),t_uid(19),t_uid(20)), 'Classement initial saison 1');
reset role;
select t_eq('#1 = pilote 11', (select driver_id::text from blacklist_rankings where position=1), t_uid(11)::text);

\echo ''
\echo '### 1. Homologation des véhicules'
reset role;
insert into auth.users(id) values (t_uid(30));
insert into profiles(id,first_name,last_name,phone,discord_tag,registration_status) values (t_uid(30),'Nouveau','Pilote','0600','nouv','validated');
select t_fail($$insert into vehicles(owner_id,make_model,vehicle_class,photo_path) values (t_uid(30),'Truc Rapide','Supersportives','x/y.jpg')$$, 'catégorie Supersportives interdite');
select t_fail($$insert into vehicles(owner_id,make_model,vehicle_class,photo_path,is_shop_vehicle) values (t_uid(30),'Truc Boutique','Sportives','x/y.jpg',true)$$, 'véhicule de boutique interdit');
select t_fail($$insert into vehicles(owner_id,make_model,vehicle_class,photo_path) values (t_uid(30),'Truc','Inconnue','x/y.jpg')$$, 'catégorie inconnue refusée');
select t_ok($$insert into vehicles(owner_id,make_model,vehicle_class,photo_path) values (t_uid(30),'Truc Valide','Muscle','x/y.jpg')$$, 'véhicule valide en attente');
select t_fail($$insert into vehicles(owner_id,make_model,vehicle_class,photo_path) values (t_uid(30),'Truc Deux','Muscle','x/y2.jpg')$$, 'un seul véhicule en attente par pilote');
select t_eq('statut initial', (select status::text from vehicles where owner_id=t_uid(30)), 'pending');
-- un pilote ne s'auto-homologue pas ; un pilote ne peut pas appeler les fonctions admin
select t_as(30);
select t_fail($$select admin_review_vehicle((select id from vehicles where owner_id=t_uid(30)),'approved')$$, 'pilote ne peut pas homologuer');
select t_rows('pilote ne peut pas modifier son statut véhicule', $$update vehicles set status='approved' where owner_id=t_uid(30)$$, 0);
reset role;
select t_eq('toujours pending', (select status::text from vehicles where owner_id=t_uid(30)), 'pending');
-- l'admin refuse sans motif -> erreur ; avec motif -> OK + notification
select t_as(2);
select t_fail($$select admin_review_vehicle((select id from vehicles where owner_id=t_uid(30)),'rejected','')$$, 'refus sans motif impossible');
select admin_review_vehicle((select id from vehicles where owner_id=t_uid(30)),'rejected','Photo floue');
reset role;
select t_as(30);
select t_eq('pilote notifié du refus + motif', (select body from notifications where kind='vehicle_rejected'), 'Photo floue');
-- nouvelle proposition (photo dans son propre dossier uniquement)
select t_fail($$select propose_vehicle('Autre','Muscle', t_uid(11)||'/car.jpg')$$, 'photo hors de son dossier refusée');
select t_fail($$select propose_vehicle('Autre','Muscle', t_uid(30)||'/car.jpg', true)$$, 'boutique refusé via RPC');
select t_fail($$select propose_vehicle('Autre','Supersportives', t_uid(30)||'/car.jpg')$$, 'Supersportives refusé via RPC');
select propose_vehicle('Muscle Car','Muscle', t_uid(30)||'/car2.jpg');
select t_fail($$select propose_vehicle('Encore','Muscle', t_uid(30)||'/car3.jpg')$$, 'demande déjà en cours');
reset role;
-- changement de véhicule d'un pilote déjà homologué (le #1 garde l'ancien tant que non validé)
select t_as(11);
select propose_vehicle('Nouvelle Caisse','Coupés', t_uid(11)||'/new.jpg');
reset role;
select t_eq('ancien véhicule toujours engagé', (select count(*) from vehicles where owner_id=t_uid(11) and status='approved')::text, '1');
select t_as(2);
select admin_review_vehicle((select id from vehicles where owner_id=t_uid(11) and status='pending'),'approved');
reset role;
select t_eq('ancien véhicule remplacé', (select count(*) from vehicles where owner_id=t_uid(11) and status='replaced')::text, '1');
select t_eq('un seul véhicule approuvé', (select count(*) from vehicles where owner_id=t_uid(11) and status='approved')::text, '1');

\echo ''
\echo '### 2. Permissions (RLS) — un pilote ne triche pas'
select t_as(15);
select t_eq('ne voit que son profil privé', (select count(*) from profiles)::text, '1');
select t_eq('ne voit pas le téléphone des autres', (select count(*) from profiles where id <> t_uid(15))::text, '0');
select t_fail($$update profiles set account_status='banned' where id=t_uid(15)$$, 'ne peut pas changer son statut de compte');
select t_fail($$update profiles set entry_eligible=true where id=t_uid(15)$$, 'ne peut pas se rendre éligible');
select t_fail($$update profiles set registration_status='validated' where id=t_uid(15)$$, 'ne peut pas valider son inscription');
select t_ok($$update profiles set phone='0611223344' where id=t_uid(15)$$, 'peut modifier son téléphone');
select t_rows('ne modifie pas le profil d''un autre', $$update profiles set phone='666' where id=t_uid(16)$$, 0);
select t_rows('classement non modifiable', $$update blacklist_rankings set driver_id=t_uid(15) where position=1$$, 0);
select t_fail($$insert into challenges(challenger_id,defender_id,challenger_position,defender_position,week_start,respond_by) values (t_uid(15),t_uid(14),5,4,current_date,now())$$, 'création directe d''un défi interdite');
select t_fail($$insert into rewards(challenge_id,driver_id,rank_beaten,amount) values (gen_random_uuid(),t_uid(15),1,2000000)$$, 'création directe de récompense interdite');
select t_fail($$update driver_stats set driver_id = driver_id$$, 'vue driver_stats non modifiable');
select t_fail($$update public_blacklist set wins = 99$$, 'vue publique non modifiable');
select t_fail($$insert into user_roles values (t_uid(15),'super_admin')$$, 'auto-promotion admin impossible');
select t_fail($$select admin_set_ranking('[]','x yz abc')$$, 'fonction admin refusée au pilote');
select t_fail($$select admin_validate_challenge(gen_random_uuid())$$, 'validation de résultat refusée au pilote');
select t_fail($$select admin_confirm_payment(gen_random_uuid())$$, 'confirmation de paiement refusée au pilote');
select t_fail($$insert into race_tracks(name,start_point,end_point,distance_km,difficulty,race_type) values ('X','a','b',1,'Easy','Circuit')$$, 'pilote ne crée pas de circuit');
select t_rows('pilote ne modifie pas les règles', $$update settings set value='1' where key='inactivity_days'$$, 0);
select t_fail($$select _notify(t_uid(15),'x','Faux message')$$, 'pilote ne peut pas appeler _notify');
select t_fail($$select _write_ranking(array[t_uid(15),null,null,null,null,null,null,null,null,null],'hack','x')$$, 'pilote ne peut pas appeler _write_ranking');
select t_fail($$select _resolve_challenge(gen_random_uuid(), t_uid(15), null, false)$$, 'pilote ne peut pas appeler _resolve_challenge');
select t_fail($$select _log('x','y','z')$$, 'pilote ne peut pas appeler _log');
select t_fail($$select _lose_vehicle(t_uid(14),'x')$$, 'pilote ne peut pas appeler _lose_vehicle');
select t_eq('pilote ne lit pas l''inactivité des autres', coalesce(inactivity_days(t_uid(14))::text,'masqué'), 'masqué');
select t_fail($$select _notify_admins('x','Faux message admin')$$, 'pilote ne peut pas appeler _notify_admins');
select t_eq('aucun journal visible', (select count(*) from admin_logs)::text, '0');
select t_eq('aucun rôle d''autrui visible', (select count(*) from user_roles)::text, '0');
select t_eq('vue inactivité réservée aux admins', (select count(*) from inactivity_overview)::text, '0');
reset role;
select t_anon();
select t_eq('anonyme voit le classement (10 lignes)', (select count(*) from public_blacklist)::text, '10');
select t_eq('anonyme ne voit aucun profil privé', (select count(*) from profiles)::text, '0');
select t_eq('anonyme ne voit aucune notification', (select count(*) from notifications)::text, '0');
select t_fail($$select create_challenge(t_uid(19))$$, 'anonyme ne peut pas défier');
select t_fail($$select run_alerts()$$, 'anonyme ne lance pas les alertes');
reset role;

\echo ''
\echo '### 3. Défis — règles de progression'
select t_as(20);  -- #10
select t_fail($$select create_challenge(t_uid(18))$$, '#10 ne peut pas défier #8 (saut de position)');
select t_fail($$select create_challenge(t_uid(11))$$, '#10 ne peut pas défier #1');
select create_challenge(t_uid(19));  -- #10 -> #9
select t_fail($$select create_challenge(t_uid(19))$$, 'pas de second défi simultané');
reset role;
select t_eq('défi standard (pas podium)', (select is_podium::text from challenges where challenger_id=t_uid(20)), 'false');
select t_eq('une seule manche', (select count(*) from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(20)))::text, '1');
select t_eq('délai de 48 h', (select round(extract(epoch from respond_by-created_at)/3600)::text from challenges where challenger_id=t_uid(20)), '48');
select t_as(19);
select t_eq('défié notifié (défi + 48h)', (select count(*) from notifications where kind in ('challenge_new','challenge_deadline'))::text, '2');
select t_fail($$select create_challenge(t_uid(18))$$, '#9 ne peut pas défier tant que son défi est en cours');
reset role;
-- C2 : podium #4 -> #3 ; C3 : #6 -> #5 ; C4 : #8 -> #7
select t_as(14); select create_challenge(t_uid(13)); reset role;
select t_as(16); select create_challenge(t_uid(15)); reset role;
select t_as(18); select create_challenge(t_uid(17)); reset role;
select t_eq('défi du podium = 3 manches', (select count(*) from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(14)))::text, '3');
select t_eq('manche 3 = Last Race', (select kind from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(14)) and race_no=3), 'last_race');
select t_eq('manche 1 choisie par le challenger', (select chosen_by from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(14)) and race_no=1), 'challenger');
select t_eq('manche 2 choisie par le défié', (select chosen_by from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(14)) and race_no=2), 'champion');
select t_eq('manche 3 tirée au sort', (select chosen_by from challenge_races where challenge_id=(select id from challenges where challenger_id=t_uid(14)) and race_no=3), 'random');
-- #1 ne peut pas défier
select t_as(11); select t_fail($$select create_challenge(t_uid(12))$$, '#1 n''a personne à défier (et #2 est au-dessus ? non : en dessous)'); reset role;
-- compte suspendu / véhicule non homologué => défi impossible
select t_as(2); select admin_set_account_status(t_uid(12),'suspended','Test suspension'); reset role;
select t_as(13); select t_fail($$select create_challenge(t_uid(12))$$, 'défi vers un compte suspendu impossible'); reset role;
select t_as(2); select admin_set_account_status(t_uid(12),'active','Fin de test'); reset role;
-- un pilote ne voit pas les défis des autres
select t_as(12); select t_eq('#2 ne voit aucun défi (non concerné)', (select count(*) from challenges)::text, '0'); reset role;

\echo ''
\echo '### 4. Programmation et délais'
select t_as(20);
select t_fail(format($$select schedule_challenge(%L, now()+interval '1 minute')$$, (select id from challenges where challenger_id=t_uid(20))), 'le challenger ne fixe pas la date');
reset role;
select t_as(19);
select t_fail(format($$select schedule_challenge(%L, now()-interval '1 hour')$$, (select id from challenges where defender_id=t_uid(19))), 'date passée refusée');
select t_fail(format($$select schedule_challenge(%L, now()+interval '12 days')$$, (select id from challenges where defender_id=t_uid(19))), 'hors de la semaine en cours refusée');
select schedule_challenge((select id from challenges where defender_id=t_uid(19)), now()+interval '1 minute');
select t_fail(format($$select schedule_challenge(%L, now()+interval '2 minutes')$$, (select id from challenges where defender_id=t_uid(19))), 'pas de reprogrammation par le pilote');
reset role;
select t_eq('statut programmé', (select status::text from challenges where defender_id=t_uid(19)), 'scheduled');
select t_as(20); select t_eq('challenger notifié de la date', (select count(*) from notifications where kind='challenge_scheduled')::text, '1'); reset role;
-- C2 programmé aussi
select t_as(13); select schedule_challenge((select id from challenges where defender_id=t_uid(13)), now()+interval '1 minute'); reset role;
-- C3 : délai dépassé
update challenges set respond_by = now() - interval '1 hour' where defender_id = t_uid(15);
select t_as(15);
select t_fail(format($$select schedule_challenge(%L, now()+interval '1 minute')$$, (select id from challenges where defender_id=t_uid(15))), 'délai de 48 h dépassé : refus');
reset role;
select t_as(2);
select t_eq('alerte retard générée (C3 seulement)', (run_alerts() ->> 'overdue'), '1');
reset role;
