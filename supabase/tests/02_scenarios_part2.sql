create or replace function t_ch(a int) returns uuid language sql stable as $$ select id from challenges where challenger_id = t_uid(a) order by created_at desc limit 1 $$;
create or replace function t_race(a int, n int) returns uuid language sql stable as $$
  select id from challenge_races where challenge_id = t_ch(a) and race_no = n $$;
create or replace function t_pos(n int) returns text language sql stable as $$ select coalesce((select position::text from blacklist_rankings where driver_id = t_uid(n)), 'out') $$;

\echo ''
\echo '### 5. Duel standard — résultat saisi par l''organisation uniquement'
reset role;
select t_as(19);
select t_fail(format($$select admin_record_race_result(%L, %L)$$, t_race(20,1), t_uid(20)), 'un pilote ne saisit pas de résultat');
reset role;
select t_as(2);
select t_fail(format($$select admin_record_race_result(%L, %L)$$, t_race(18,1), t_uid(18)), 'résultat impossible sur un défi non programmé');
select t_fail(format($$select admin_record_race_result(%L, %L)$$, t_race(20,1), t_uid(11)), 'vainqueur doit être un des deux pilotes');
select admin_record_race_result(t_race(20,1), t_uid(20), 'https://clips.example/c1');
reset role;
select t_eq('statut = awaiting_validation', (select status::text from challenges where id=t_ch(20)), 'awaiting_validation');
select t_eq('vainqueur calculé automatiquement', (select winner_id::text from challenges where id=t_ch(20)), t_uid(20)::text);
select t_eq('classement NON modifié avant validation', t_pos(20) || '/' || t_pos(19), '10/9');
select t_eq('aucune récompense avant validation', (select count(*) from rewards)::text, '0');
select t_as(20);
select t_fail(format($$select admin_validate_challenge(%L)$$, t_ch(20)), 'le vainqueur ne valide pas son propre résultat');
reset role;
select t_as(2);
select admin_validate_challenge(t_ch(20));
reset role;
select t_eq('échange de positions : challenger #9', t_pos(20), '9');
select t_eq('échange de positions : défié #10', t_pos(19), '10');
select t_eq('défi complété', (select status::text from challenges where id=t_ch(20)), 'completed');
select t_eq('récompense = rang du boss battu (#9 = 250 000)', (select amount::text from rewards where challenge_id=t_ch(20)), '250000');
select t_eq('rang battu enregistré', (select rank_beaten::text from rewards where challenge_id=t_ch(20)), '9');
select t_eq('statut Pending', (select status::text from rewards where challenge_id=t_ch(20)), 'pending');
select t_eq('clip enregistré', (select clip_url from rewards where challenge_id=t_ch(20)), 'https://clips.example/c1');
select t_as(20);
select t_eq('le gagnant voit sa prime', (select count(*) from rewards)::text, '1');
select t_rows('le gagnant ne peut pas modifier sa prime', $$update rewards set amount = 9999999$$, 0);
select t_rows('le gagnant ne peut pas la marquer payée', $$update rewards set status='paid'$$, 0);
select t_eq('notifié : Cash Prize', (select count(*) from notifications where kind='reward')::text, '1');
select t_eq('notifié : victoire', (select count(*) from notifications where kind='duel_won')::text, '1');
select t_eq('notifié : position changée (entrée + duel)', (select count(*) from notifications where kind='ranking_changed')::text, '2');
reset role;
select t_as(19);
select t_eq('le perdant ne voit pas la prime', (select count(*) from rewards)::text, '0');
select t_eq('perdant : position changée (#9 -> #10)', (select count(*) from notifications where kind='ranking_changed' and body='You are now #10.')::text, '1');
reset role;

\echo ''
\echo '### 5b. Cash Prize — suivi des paiements'
select t_as(2);
select admin_confirm_payment((select id from rewards where challenge_id=t_ch(20)), 'https://proof.example/virement1', 'Remis en main propre');
select t_fail($$select admin_confirm_payment((select id from rewards limit 1))$$, 'double paiement impossible');
reset role;
select t_eq('statut Paid', (select status::text from rewards where challenge_id=t_ch(20)), 'paid');
select t_eq('administrateur responsable enregistré', (select paid_by::text from reward_payments limit 1), t_uid(2)::text);
select t_eq('date de paiement enregistrée', (select (paid_at is not null)::text from reward_payments limit 1), 'true');
select t_as(20); select t_eq('gagnant notifié du paiement', (select count(*) from notifications where kind='reward_paid')::text, '1'); reset role;
select t_eq('stats : victoires du gagnant', (select wins::text from driver_stats where driver_id=t_uid(20)), '1');
select t_eq('stats : défaites du perdant', (select losses::text from driver_stats where driver_id=t_uid(19)), '1');
select t_eq('stats : défis remportés', (select challenges_won::text from driver_stats where driver_id=t_uid(20)), '1');

\echo ''
\echo '### 6. Duel du podium (#4 -> #3) : 3 manches, premier à 2 victoires'
select t_as(2);
select t_fail(format($$select admin_record_race_result(%L, %L)$$, t_race(14,2), t_uid(13)), 'manches saisies dans l''ordre');
select admin_record_race_result(t_race(14,1), t_uid(14));      -- challenger gagne la 1
select admin_record_race_result(t_race(14,2), t_uid(13));      -- champion gagne la 2
reset role;
select t_eq('1-1 : duel toujours en cours', (select status::text from challenges where id=t_ch(14)), 'scheduled');
select t_eq('score champion', (select champion_wins::text from challenges where id=t_ch(14)), '1');
select t_eq('score challenger', (select challenger_wins::text from challenges where id=t_ch(14)), '1');
select t_as(2);
select admin_record_race_result(t_race(14,3), t_uid(13), 'https://clips.example/last');   -- Last Race : le champion l'emporte
reset role;
select t_eq('champion 2-1 : vainqueur = champion', (select winner_id::text from challenges where id=t_ch(14)), t_uid(13)::text);
select t_as(2);
select admin_record_race_result(t_race(14,3), t_uid(14), 'https://clips.example/last');   -- correction par l'organisateur
reset role;
select t_eq('après correction : vainqueur = challenger 2-1', (select winner_id::text || ' ' || challenger_wins || '-' || champion_wins from challenges where id=t_ch(14)), t_uid(14)::text || ' 2-1');
select t_eq('rien ne bouge avant validation', t_pos(14) || '/' || t_pos(13), '4/3');
select t_eq('véhicule du champion encore engagé', (select status::text from vehicles where owner_id=t_uid(13) and status='approved'), 'approved');
select t_as(2); select admin_validate_challenge(t_ch(14)); reset role;
select t_eq('challenger #3', t_pos(14), '3');
select t_eq('ancien champion #4', t_pos(13), '4');
select t_eq('récompense du #3 battu = 1 000 000', (select amount::text from rewards where challenge_id=t_ch(14)), '1000000');
select t_eq('véhicule du champion déchu = Lost', (select status::text from vehicles where owner_id=t_uid(13) and lost_at is not null), 'lost');
select t_eq('plus aucun véhicule engagé', (select count(*) from vehicles where owner_id=t_uid(13) and status='approved')::text, '0');
select t_as(13);
select t_eq('notification spéciale : véhicule confisqué', (select title from notifications where kind='vehicle_lost'), 'Your vehicle has been confiscated');
select t_fail($$select create_challenge(t_uid(14))$$, 'sans véhicule homologué : ne peut plus participer');
select propose_vehicle('Remplaçante','Coupés', t_uid(13)||'/new.jpg');
select t_fail($$select create_challenge(t_uid(14))$$, 'véhicule en attente : toujours interdit');
reset role;
select t_as(2); select admin_review_vehicle((select id from vehicles where owner_id=t_uid(13) and status='pending'),'approved'); reset role;
select t_eq('nouvelle homologation : véhicule engagé', (select make_model from vehicles where owner_id=t_uid(13) and status='approved'), 'Remplaçante');
select t_eq('ancien véhicule reste Lost', (select count(*) from vehicles where owner_id=t_uid(13) and status='lost')::text, '1');

\echo ''
\echo '### 7. Duel standard remporté par le défié + forfait'
select t_as(2);
select admin_set_schedule(t_ch(16), now()+interval '1 minute', 'Exception : retard de réponse justifié');
select admin_record_race_result(t_race(16,1), t_uid(15));
select admin_validate_challenge(t_ch(16));
reset role;
select t_eq('défié vainqueur : classement inchangé', t_pos(16) || '/' || t_pos(15), '6/5');
select t_eq('défié vainqueur : pas de récompense', (select count(*) from rewards where challenge_id=t_ch(16))::text, '0');
select t_eq('défi du perdant compté (stats)', (select losses::text from driver_stats where driver_id=t_uid(16)), '1');
-- forfait : le défié (d17) ne se présente pas
select t_as(17); select t_fail(format($$select admin_declare_forfeit(%L,%L,'x y z')$$, t_ch(18), t_uid(17)), 'un pilote ne déclare pas de forfait'); reset role;
select t_as(2);
select t_fail(format($$select admin_declare_forfeit(%L,%L,'')$$, t_ch(18), t_uid(17)), 'forfait sans motif refusé');
select admin_declare_forfeit(t_ch(18), t_uid(17), 'Absent au rendez-vous après vérification');
reset role;
select t_eq('forfait : statut', (select status::text from challenges where id=t_ch(18)), 'forfeited');
select t_eq('forfait : le challenger prend la place', t_pos(18) || '/' || t_pos(17), '7/8');
select t_eq('forfait : pas de Cash Prize par défaut', (select count(*) from rewards where challenge_id=t_ch(18))::text, '0');

\echo ''
\echo '### 8. Limite hebdomadaire et annulations'
select t_as(20);
select t_fail($$select create_challenge(t_uid(17))$$, 'un seul défi par semaine par challenger');
reset role;
-- d19 (#10) n'a pas encore lancé de défi cette semaine
select t_as(19); select create_challenge(t_uid(20)); reset role;
select t_as(19); select t_fail($$select create_challenge(t_uid(20))$$, 'défi simultané impossible'); reset role;
select t_as(2);
select t_fail(format($$select admin_cancel_challenge(%L, '')$$, t_ch(19)), 'annulation sans justification refusée');
select admin_cancel_challenge(t_ch(19), 'Absence justifiée du défié', true);   -- libère la semaine
reset role;
select t_as(19); select create_challenge(t_uid(20)); reset role;                 -- possible de nouveau
select t_as(2);
select t_fail($$select admin_set_ranking(jsonb_build_array(), 'tentative pendant défi')$$, 'classement manuel bloqué pendant un défi');
select admin_cancel_challenge(t_ch(19), 'Litige : annulation exceptionnelle', false);   -- la semaine reste consommée
reset role;
select t_as(19); select t_fail($$select create_challenge(t_uid(20))$$, 'semaine consommée si annulation non libérée'); reset role;
select t_eq('aucun défi actif restant', (select count(*) from challenges where status in ('awaiting_schedule','scheduled','awaiting_validation'))::text, '0');

\echo ''
\echo '### 9. Atomicité — le classement ne bouge jamais à moitié'
select t_as(15); select create_challenge(t_uid(13)); reset role;     -- #5 -> #4
select t_as(13); select schedule_challenge(t_ch(15), now()+interval '1 minute'); reset role;
select t_as(2); select admin_record_race_result(t_race(15,1), t_uid(15)); reset role;
-- Quelqu'un (accident/bug) a modifié le classement en dessous : la validation doit échouer ENTIÈREMENT
update blacklist_rankings set driver_id = case position when 4 then t_uid(15) when 5 then t_uid(13) end where position in (4,5);
select t_as(2);
select t_fail(format($$select admin_validate_challenge(%L)$$, t_ch(15)), 'validation refusée si le classement a changé');
reset role;
select t_eq('aucune récompense créée (rollback)', (select count(*) from rewards where challenge_id=t_ch(15))::text, '0');
select t_eq('défi toujours en attente de validation', (select status::text from challenges where id=t_ch(15)), 'awaiting_validation');
update blacklist_rankings set driver_id = case position when 4 then t_uid(13) when 5 then t_uid(15) end where position in (4,5);
select t_as(2); select admin_validate_challenge(t_ch(15)); reset role;
select t_eq('après rétablissement : validation OK (#4)', t_pos(15), '4');
select t_eq('récompense du #4 = 800 000', (select amount::text from rewards where challenge_id=t_ch(15)), '800000');

\echo ''
\echo '### 9b. Classement manuel avec justification + journal'
select t_as(2);
select t_fail($$select admin_set_ranking((select jsonb_agg(driver_id order by position) from blacklist_rankings), 'ok')$$, 'justification trop courte refusée');
do $$ declare a jsonb; begin
  select jsonb_agg(driver_id order by position) into a from blacklist_rankings;
  a := jsonb_set(jsonb_set(a,'{7}',a->8),'{8}',a->7);
  perform admin_set_ranking(a, 'Correction suite à un litige validé');
end $$;
reset role;
select t_eq('échange manuel #8 <-> #9', t_pos(17) || '/' || t_pos(20), '9/8');
select t_eq('historique manuel enregistré', (select count(*) from ranking_history where kind='manual' and reason like 'Correction%')::text, '2');
select t_eq('journal admin : ranking:manual', (select count(*) from admin_logs where action='ranking:manual')::text, '2');
select t_as(2);
do $$ declare a jsonb; begin
  select jsonb_agg(driver_id order by position) into a from blacklist_rankings;
  a := jsonb_set(jsonb_set(a,'{7}',a->8),'{8}',a->7);
  perform admin_set_ranking(a, 'Annulation de la correction');
end $$;
select t_fail($$select admin_set_ranking(jsonb_build_array(t_uid(11),t_uid(11),null,null,null,null,null,null,null,null),'doublon volontaire')$$, 'doublon de pilote refusé');
reset role;
select t_eq('un pilote par position', (select count(distinct driver_id)::text from blacklist_rankings), '10');

\echo ''
\echo '### 10. Inactivité — alertes automatiques, sanctions TOUJOURS manuelles'
update profiles set blacklist_entered_at = now() - interval '20 days', last_duel_at = null, inactivity_alerted_at = null where id in (t_uid(11), t_uid(12));
select t_eq('20 jours d''inactivité', inactivity_days(t_uid(11))::text, '20');
select t_as(2);
select admin_record_absence(t_uid(12), current_date - 12, current_date - 3, 'Absence justifiée (voyage)');
select t_eq('absence justifiée : décompte suspendu (20 - 10)', (select days_inactive::text from inactivity_overview where driver_id=t_uid(12)), '10');
select t_eq('vue admin : alerte pour #1 seulement', (select string_agg(first_name,',') from inactivity_overview where needs_attention), 'Prenom11');
select t_eq('run_alerts : 1 alerte d''inactivité', (run_alerts() ->> 'inactivity'), '1');
select t_eq('run_alerts rejoué : pas de doublon', (run_alerts() ->> 'inactivity'), '0');
reset role;
select t_eq('AUCUNE sanction automatique (pilote toujours #1)', t_pos(11), '1');
select t_eq('aucune sanction enregistrée', (select count(*) from sanctions)::text, '0');
select t_as(11); select t_eq('pilote notifié de son inactivité', (select count(*) from notifications where kind='inactivity')::text, '1'); reset role;
select t_as(11); select t_fail($$select admin_apply_sanction(t_uid(12),'removal','Je vire mon rival')$$, 'un pilote ne sanctionne pas'); reset role;
select t_as(2);
select t_fail($$select admin_apply_sanction(t_uid(11),'lose_two_positions','')$$, 'sanction sans décision motivée refusée');
select admin_apply_sanction(t_uid(11),'lose_two_positions','14 jours sans duel : décision du bureau');
reset role;
select t_eq('perte de deux positions : #1 -> #3', t_pos(11), '3');
select t_eq('les deux suivants remontent', t_pos(12) || '/' || t_pos(14), '1/2');
select t_eq('sanction enregistrée', (select count(*) from sanctions where type='lose_two_positions')::text, '1');
select t_as(11); select t_eq('pilote notifié de la sanction', (select count(*) from notifications where kind='sanction')::text, '1'); reset role;

\echo ''
\echo '### 11. Retrait + Réservistes (historique conservé)'
select t_as(2);
select admin_apply_sanction(t_uid(20),'removal','Retrait de la Blacklist après décision du bureau');
reset role;
select t_eq('retrait : sorti du classement', t_pos(20), 'out');
select t_eq('les suivants remontent (#10 -> #9)', t_pos(19), '9');
select t_eq('position #10 vacante', (select count(*) from blacklist_rankings where driver_id is null)::text, '1');
select t_as(2);
select admin_add_reserve(t_uid(21));
select t_fail($$select admin_add_reserve(t_uid(21))$$, 'déjà en file d''attente');
select t_fail($$select admin_add_reserve(t_uid(19))$$, 'un pilote classé ne peut pas être réserviste');
select t_fail($$select admin_add_reserve(t_uid(30))$$, 'réserviste sans véhicule homologué refusé');
select admin_promote_reserve((select id from reserve_drivers where driver_id=t_uid(21) and status='waiting'));
reset role;
select t_eq('promotion : #10 pourvu', t_pos(21), '10');
select t_eq('réserviste marqué Promoted', (select status::text from reserve_drivers where driver_id=t_uid(21)), 'promoted');
select t_as(2);
select admin_add_reserve(t_uid(22));
select admin_apply_sanction(t_uid(16),'replace_with_reserve','Remplacement après inactivité prolongée', (select id from reserve_drivers where driver_id=t_uid(22) and status='waiting'));
select admin_add_reserve(t_uid(16));    -- l'ancien titulaire rejoint la file
reset role;
select t_eq('remplacement : le réserviste prend le #6', t_pos(22), '6');
select t_eq('ancien titulaire hors classement', t_pos(16), 'out');
select t_as(2);
select t_eq('file d''attente : 1 en attente, 2 promus (historique complet)', (select count(*) filter (where status='waiting') || '/' || count(*) filter (where status='promoted') from reserve_queue), '1/2');
select t_eq('position dans la file', (select queue_position::text from reserve_queue where status='waiting'), '1');
reset role;
select t_as(15); select t_eq('un pilote ne voit pas la file des réservistes', (select count(*) from reserve_queue)::text, '0'); reset role;

\echo ''
\echo '### 12. Warm-up Race'
select t_as(2);
insert into race_tracks(name,start_point,end_point,distance_km,difficulty,description,race_type) values ('Vinewood Sprint','Vinewood Hills','Pier','4.2','Medium','Sprint de nuit','Sprint urbain');
select t_eq('création de circuit journalisée', (select count(*) from admin_logs where action='insert:race_tracks')::text, '1');
select admin_create_warmup(now() + interval '3 days', (select id from race_tracks limit 1)) as ev \gset
reset role;
select t_as(2);
select admin_warmup_participant(:'ev', t_uid(23), true);
select admin_warmup_participant(:'ev', t_uid(24), true);
select t_fail(format($$select admin_warmup_participant(%L, %L, true)$$, :'ev', t_uid(19)), 'pilote déjà classé : pas de Warm-up');
select t_fail(format($$select admin_warmup_participant(%L, %L, true)$$, :'ev', t_uid(30)), 'pilote non homologué : pas de Warm-up');
select t_fail(format($$select admin_record_warmup_winner(%L, %L)$$, :'ev', t_uid(12)), 'le vainqueur doit être inscrit');
select admin_warmup_status(:'ev','running');
select admin_record_warmup_winner(:'ev', t_uid(23), 'Course nocturne');
reset role;
select t_eq('pas éligible avant validation', (select entry_eligible::text from profiles where id=t_uid(23)), 'false');
select t_as(2); select admin_validate_warmup(:'ev'); reset role;
select t_eq('éligible après validation', (select entry_eligible::text from profiles where id=t_uid(23)), 'true');
select t_as(2);
select t_fail(format($$select admin_validate_warmup(%L)$$, :'ev'), 'validation unique');
select t_fail(format($$select admin_record_warmup_winner(%L, %L)$$, :'ev', t_uid(24)), 'vainqueur non modifiable après validation');
select t_fail($$select admin_enter_blacklist(t_uid(24))$$, 'non vainqueur : pas d''entrée au #10');
select t_fail($$select admin_enter_blacklist(t_uid(23))$$, '#10 occupé : décision explicite requise');
select admin_enter_blacklist(t_uid(23), true);
reset role;
select t_eq('vainqueur entre au #10', t_pos(23), '10');
select t_eq('occupant évincé -> réserve', (select count(*) from reserve_drivers where driver_id=t_uid(21) and status='waiting')::text, '1');
select t_eq('éligibilité consommée', (select entry_eligible::text from profiles where id=t_uid(23)), 'false');
select t_as(23); select t_fail($$select admin_enter_blacklist(t_uid(23))$$, 'pilote ne s''inscrit pas lui-même au #10'); reset role;

\echo ''
\echo '### 13. Journal, paramètres, vues publiques'
select t_eq('un pilote par position à la fin', (select count(distinct driver_id)::text from blacklist_rankings where driver_id is not null), '10');
select t_eq('toutes les actions admin ont un auteur', (select count(*) from admin_logs where admin_id is null)::text, '0');
select t_eq('journal rempli', (select (count(*) > 40)::text from admin_logs), 'true');
select t_eq('somme des Cash Prize', (select sum(amount)::text from rewards), '2050000');
select t_as(2);
select t_rows('admin simple ne modifie pas les règles', $$update settings set value='7' where key='inactivity_days'$$, 0);
reset role;
select t_as(1);
select t_rows('super admin modifie une règle', $$update settings set value='10' where key='inactivity_days'$$, 1);
reset role;
select t_eq('modification de règle journalisée', (select count(*) from admin_logs where action='update:settings' and admin_id=t_uid(1))::text, '1');
select t_anon();
select t_eq('anonyme : circuits lisibles (3 de départ + 1)', (select count(*) from race_tracks)::text, '4');
select t_eq('anonyme : duels publics', (select (count(*) >= 4)::text from public_duels), 'true');
select t_eq('anonyme : pas de téléphone exposé', (select count(*) from information_schema.columns where table_name in ('public_driver','public_blacklist','public_duels') and column_name in ('phone','discord_tag'))::text, '0');
select t_eq('anonyme : aucune récompense visible', (select count(*) from rewards)::text, '0');
select t_eq('anonyme : paramètres sensibles masqués', (select count(*) from settings where key = 'timezone')::text, '0');
reset role;

\echo ''
\echo '### 14. Connexion par numéro, photo et pseudo facultatifs'
reset role;
select t_eq('clé de connexion = chiffres du numéro', (select phone_key from profiles where id=t_uid(15)), '0611223344');
insert into auth.users(id) values (t_uid(40));
select t_ok($$insert into profiles(id,first_name,last_name,phone) values (t_uid(40),'Sans','Discord','07 00 00 00 40')$$, 'inscription sans pseudo Discord');
select t_fail($$insert into profiles(id,first_name,last_name,phone) values (gen_random_uuid(),'Dbl','Num','0700000040')$$, 'même numéro avec un autre format refusé');
select t_ok($$insert into vehicles(owner_id,make_model,vehicle_class) values (t_uid(40),'Sans Photo','Muscle')$$, 'véhicule sans photo accepté');
update profiles set registration_status='validated' where id=t_uid(40);
select t_as(2); select admin_review_vehicle((select id from vehicles where owner_id=t_uid(40)),'approved'); reset role;
select t_eq('véhicule sans photo homologable', (select status::text from vehicles where owner_id=t_uid(40)), 'approved');
select t_as(40);
select t_fail($$select propose_vehicle('Autre','Muscle', t_uid(11)||'/car.jpg')$$, 'photo hors de son dossier toujours refusée');
select t_ok($$select propose_vehicle('Autre Sans Photo','Coupés', null)$$, 'proposition de changement sans photo');
reset role;

\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT'
