\echo ''
\echo '### 27. Compte observateur : invisible des joueurs, peut parier, ne participe à rien'
reset role;
insert into auth.users(id, email) select t_uid(70), 'obs@test';
insert into profiles(id, first_name, last_name, phone, discord_tag, registration_status, is_observer) values (t_uid(70), 'Observateur', 'Alias', '0670000', 'obs', 'validated', true);
select t_eq('zigollars de départ jamais verrouillés', (select balance::text || '/' || locked::text from point_balances where user_id = t_uid(70)), '10000/0');
select t_anon();
select t_eq('absent de la fiche publique des pilotes', (select count(*)::text from public_driver where id = t_uid(70)), '0');
reset role;
select t_as(12);
select t_eq('un pilote ne voit pas le profil de l''observateur', (select count(*)::text from profiles where id = t_uid(70)), '0');
reset role;
select t_as(70);
select t_fail($$insert into course_suggestions(user_id, name, description, route_path, route_w, route_h) values (t_uid(70), 'Circuit', 'Description assez longue', 'M 0 0', 10, 10)$$, 'l''observateur ne suggère pas de course');
reset role;
select t_fail($$insert into vehicles(owner_id, make_model, vehicle_class) values (t_uid(70), 'Test', 'Coupés')$$, 'pas de véhicule pour l''observateur');
select t_fail($$insert into claims(user_id, title, message) values (t_uid(70), 'Titre', 'Message assez long pour passer')$$, 'pas de réclamation pour l''observateur');
select t_as(70);
select t_fail($$select * from admin_grant_points(t_uid(70), 5, 'moi-même')$$, 'aucun droit d''organisation');
select t_eq('pas de rôle organisateur', (select is_admin()::text), 'false');
reset role;
select t_as(1);
select t_eq('le staff voit le compte observateur', (select count(*)::text from profiles where id = t_uid(70) and is_observer), '1');
reset role;
