\echo ''
\echo '### 26. Suppression d''un compte pilote'
reset role;
insert into auth.users(id, email) select t_uid(n), 'u' || n || '@test' from generate_series(60, 62) n;
insert into profiles(id, first_name, last_name, phone, discord_tag, registration_status) select t_uid(n), 'Jetable' || n, 'Compte' || n, '0680' || n, 'disc' || n, 'validated' from generate_series(60, 62) n;
select t_as(12); select t_fail($$select admin_delete_account(t_uid(60))$$, 'un pilote ne supprime pas de compte'); select t_fail($$select driver_deletion_info(t_uid(60))$$, 'un pilote ne lit pas le résumé de suppression'); reset role;
select t_as(2); select t_fail($$select admin_delete_account(t_uid(60))$$, 'un organisateur simple ne supprime pas de compte (super administrateur requis)'); reset role;
select t_as(1);
select t_fail($$select admin_delete_account(t_uid(1))$$, 'impossible de supprimer son propre compte');
select t_fail($$select admin_delete_account(t_uid(2))$$, 'impossible de supprimer un organisateur');
select t_eq('résumé d''un compte vierge', (select (driver_deletion_info(t_uid(60)) ->> 'duels') || '/' || (driver_deletion_info(t_uid(60)) ->> 'rewards')), '0/0');
select t_ok($$select admin_delete_account(t_uid(60))$$, 'compte sans historique : suppression simple');
reset role;
select t_eq('le compte a disparu (profil et utilisateur)', (select count(*)::text from profiles where id = t_uid(60)) || '/' || (select count(*)::text from auth.users where id = t_uid(60)), '0/0');
select t_eq('ses zigollars ont disparu avec lui', (select count(*)::text from point_balances where user_id = t_uid(60)) || '/' || (select count(*)::text from point_ledger where user_id = t_uid(60)), '0/0');
select t_eq('l''opération est journalisée', (select count(*)::text from admin_logs where action = 'account:delete'), '1');

-- pilote avec un duel en cours : refusé, même avec « supprimer avec l'historique »
select t_as(1);
select t_fail($$select admin_delete_account((select challenger_id from challenges where status = 'scheduled' order by created_at limit 1), true)$$, 'duel en cours : suppression refusée même en forçant');
-- pilote avec historique : refus sans confirmation, suppression avec
select t_fail($$select admin_delete_account(t_uid(17))$$, 'historique de duels : refus sans confirmation renforcée');
select t_eq('le résumé annonce l''historique', ((driver_deletion_info(t_uid(17)) ->> 'duels')::int > 0)::text, 'true');
select t_ok($$select admin_delete_account(t_uid(17), true)$$, 'avec confirmation renforcée : suppression avec l''historique');
reset role;
select t_eq('le pilote et ses duels ont disparu', (select count(*)::text from profiles where id = t_uid(17)) || '/' || (select count(*)::text from challenges where t_uid(17) in (challenger_id, defender_id)), '0/0');
select t_eq('ses récompenses aussi', (select count(*)::text from rewards where driver_id = t_uid(17)), '0');
select t_eq('l''adversaire est conservé', (select count(*)::text from profiles where id = t_uid(18)), '1');
\echo ''
