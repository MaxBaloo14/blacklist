\echo ''
\echo '### 28. Suggestion retenue récompensée, rappels aux parieurs, activité de l''observateur, édition limitée'
reset role;
-- Suggestion retenue : l'auteur reçoit les zigollars une seule fois
select t_as(12); select submit_suggestion('Circuit du port', 'Un tracé rapide le long des docks', 'M 10 10 L 90 90', 100, 100); select submit_suggestion('Circuit refusé', 'Un autre tracé de test', 'M 10 10 L 50 90', 100, 100); reset role;
create table sg as select id, name from course_suggestions where user_id = t_uid(12) and name in ('Circuit du port', 'Circuit refusé'); grant select on sg to public;
create table before as select balance from point_balances where user_id = t_uid(12); grant select on before to public;
select t_as(12); select t_fail($$select admin_handle_suggestion((select id from sg where name = 'Circuit du port'), 'accepted')$$, 'un pilote ne traite pas une suggestion'); reset role;
select t_as(2); select admin_handle_suggestion((select id from sg where name = 'Circuit du port'), 'accepted', 'Bravo'); reset role;
select t_eq('suggestion retenue : +5 000 zigollars pour l''auteur', (select (p.balance - b.balance)::text from point_balances p, before b where p.user_id = t_uid(12)), '5000');
select t_eq('une seule récompense au registre', (select count(*)::text from point_ledger where kind = 'suggestion' and ref = (select id from sg where name = 'Circuit du port')), '1');
select t_eq('l''auteur est prévenu du gain', (select count(*)::text from notifications where user_id = t_uid(12) and title = 'Your course suggestion has been accepted'), '1');
select t_as(2); select t_fail($$select admin_handle_suggestion((select id from sg where name = 'Circuit du port'), 'accepted')$$, 'pas de seconde récompense (déjà traitée)'); 
select admin_handle_suggestion((select id from sg where name = 'Circuit refusé'), 'declined', 'Non'); reset role;
select t_eq('suggestion refusée : aucun zigollar', (select (p.balance - b.balance)::text from point_balances p, before b where p.user_id = t_uid(12)), '5000');

-- Rappel 1 h : les parieurs aussi
insert into challenges(id, challenger_id, defender_id, challenger_position, defender_position, week_start, status, respond_by, scheduled_at)
  values ('00000000-0000-0000-0000-0000000000a3', t_uid(21), t_uid(22), 13, 12, current_date, 'scheduled', now() + interval '1 day', now() + interval '30 minutes');
insert into duel_bets(challenge_id, user_id, side, stake, odds) values ('00000000-0000-0000-0000-0000000000a3', t_uid(11), 'challenger', 1000, 2.0), ('00000000-0000-0000-0000-0000000000a3', t_uid(70), 'defender', 500, 1.5);
select t_as(11); select t_eq('le parieur déclenche les rappels de son duel', (duel_reminders() >= 1)::text, 'true'); reset role;
select t_eq('les parieurs reçoivent leur rappel 1 h (pilote et observateur)', (select count(*)::text from notifications where title = 'A duel you bet on starts in 1 hour' and user_id in (t_uid(11), t_uid(70))), '2');
-- Récap du pari à la fin du duel
update challenges set status = 'completed', winner_id = t_uid(21) where id = '00000000-0000-0000-0000-0000000000a3';
select t_eq('pari gagné : récap avec cote et gain net', (select body from notifications where user_id = t_uid(11) and title = 'You won your bet' order by created_at desc limit 1), (select _name(t_uid(21)) || ' vs ' || _name(t_uid(22)) || ' · odds x2.00 · +1000 zigollars'));
select t_eq('pari perdu : récap avec la mise', (select (body like '% · odds x1.50 · -500 zigollars')::text from notifications where user_id = t_uid(70) and title = 'You lost your bet' order by created_at desc limit 1), 'true');

-- Activité de l'observateur : visible du staff seulement
select t_eq('le pari de l''observateur est tracé', (select count(*)::text from observer_events where user_id = t_uid(70) and kind = 'bet'), '1');
select t_as(70); select log_observer_login(); select log_observer_login(); reset role;
select t_eq('connexion tracée une seule fois par 10 minutes', (select count(*)::text from observer_events where user_id = t_uid(70) and kind = 'login'), '1');
select t_as(11); select log_observer_login(); reset role;
select t_eq('un pilote ordinaire n''est jamais tracé', (select count(*)::text from observer_events where user_id = t_uid(11)), '0');
select t_as(11); select t_eq('un pilote ne lit pas ces traces', (select count(*)::text from observer_events), '0'); reset role;
select t_as(70); select t_eq('l''observateur ne lit pas ses propres traces', (select count(*)::text from observer_events), '0'); reset role;
select t_as(2); select t_eq('le staff lit les traces', (select (count(*) >= 2)::text from observer_events), 'true'); reset role;

-- Édition limitée : disparaît à l'échéance, achat refusé après
insert into shop_items(name, price, category, limited, ends_at, stock) values ('Casque doré (limité)', 500, 'Accessoires', true, now() + interval '1 day', 3);
select t_anon(); select t_eq('un visiteur voit l''édition limitée en cours', (select count(*)::text from shop_items where name = 'Casque doré (limité)'), '1'); reset role;
select t_as(70); select shop_buy((select id from shop_items where name = 'Casque doré (limité)')); reset role;
select t_eq('l''achat de l''observateur est tracé', (select count(*)::text from observer_events where user_id = t_uid(70) and kind = 'order'), '1');
update shop_items set ends_at = now() - interval '1 minute' where name = 'Casque doré (limité)';
select t_anon(); select t_eq('après l''échéance : invisible pour le public', (select count(*)::text from shop_items where name = 'Casque doré (limité)'), '0'); reset role;
select t_as(11); select t_fail($$select shop_buy((select id from shop_items where name = 'Casque doré (limité)'))$$, 'achat refusé après la fin'); reset role;
select t_as(2); select t_eq('le staff voit toujours l''article terminé', (select count(*)::text from shop_items where name = 'Casque doré (limité)'), '1'); reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (suppression de compte incluse)'
