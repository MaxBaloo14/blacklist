\echo ''
\echo '### 19. Notifications push (abonnements, clés, suivi)'
reset role;
insert into push_subscriptions(user_id, endpoint, p256dh, auth) values (t_uid(22), 'https://fcm.googleapis.com/fcm/send/pilote22-abcdefghij', 'BKEYpilote22xxxxxxxxxxxxxxxxxxxxxxxx', 'authpilote22xx');
insert into push_subscriptions(user_id, endpoint, p256dh, auth) values (t_uid(21), 'https://fcm.googleapis.com/fcm/send/pilote21-abcdefghij', 'BKEYpilote21xxxxxxxxxxxxxxxxxxxxxxxx', 'authpilote21xx');
select t_as(22);
select t_eq('un pilote ne voit que son propre appareil', (select count(*) from push_subscriptions)::text, '1');
select t_fail($$insert into push_subscriptions(user_id, endpoint, p256dh, auth) values (t_uid(22), 'https://fcm.googleapis.com/fcm/send/forge-abcdefghij', 'k', 'a')$$, 'écriture directe d''un abonnement refusée (passe par le serveur)');
select t_rows('un pilote ne retire pas l''appareil d''un autre', $$delete from push_subscriptions where user_id = t_uid(21)$$, 0);
select t_fail($$select * from push_keys$$, 'clés VAPID illisibles par un pilote');
select t_rows('un pilote retire son propre appareil', $$delete from push_subscriptions where user_id = t_uid(22)$$, 1);
select t_anon();
select t_fail($$select * from push_subscriptions$$, 'anonyme : abonnements illisibles');
select t_fail($$select * from push_keys$$, 'anonyme : clés VAPID illisibles');
reset role;
select t_ok($$insert into notifications(user_id, kind, title) values (t_uid(21), 'test', 'Test push')$$, 'une notification se crée même sans service push (le déclencheur ne bloque jamais)');
select t_eq('la notification n''est pas marquée envoyée', (select count(*) from notifications where title = 'Test push' and push_sent_at is null)::text, '1');
select t_as(21);
select t_fail($$select _push_dispatch()$$, 'fonction interne non appelable depuis l''API');
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (push inclus)'
