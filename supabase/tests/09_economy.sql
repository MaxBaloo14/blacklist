\echo ''
\echo '### 21. Points, boutique, paris à cotes, créneaux et cartes'
create or replace function t_c17() returns uuid language sql stable security definer as $$ select id from challenges where challenger_id=t_uid(17) order by created_at desc limit 1 $$;
reset role;
select t_eq('10 000 points offerts à chaque inscription', (select count(*) from point_ledger where kind='welcome' and delta=10000)::text, (select count(*) from profiles)::text);
select t_eq('solde de départ', (select balance::text from point_balances where user_id=t_uid(11)), '10000');
select t_fail($$insert into point_ledger(user_id,delta,reason,kind) values (t_uid(11),10000,'x','welcome')$$, 'bonus de bienvenue unique');
select t_as(11);
select t_fail($$update point_balances set balance = 999999 where user_id = t_uid(11)$$, 'un pilote ne modifie pas son solde');
select t_rows('un pilote ne lit que son solde', $$select 1 from point_balances where user_id <> t_uid(11) and user_id <> t_uid(11)$$, 0);
select t_eq('un pilote ne voit que son solde', (select count(*) from point_balances)::text, '1');
select t_fail($$select admin_grant_points(t_uid(11), 5000, 'triche')$$, 'un pilote ne se donne pas de points');
reset role;
select t_as(2); select admin_grant_points(t_uid(12), 500, 'Geste de l''organisation'); reset role;
select t_eq('points ajoutés par un organisateur', (select balance::text from point_balances where user_id=t_uid(12)), '10500');
select t_as(2); select t_fail($$select admin_grant_points(t_uid(12), -999999, 'trop')$$, 'montant excessif refusé'); reset role;

-- Boutique
select t_anon();
select t_eq('un visiteur voit la boutique', (select count(*) from shop_items where active)::text, '9');
select t_fail($$select shop_buy((select id from shop_items limit 1))$$, 'un visiteur n''achète pas');
reset role;
select t_as(11);
select t_fail($$insert into shop_items(name,price,category) values ('Triche',1,'Divers')$$, 'un pilote ne crée pas d''article');
select t_rows('un pilote ne modifie pas un prix', $$update shop_items set price = 1$$, 0);
select shop_buy((select id from shop_items where name='Fusée de détresse'));
reset role;
select t_eq('achat : points débités', (select balance::text from point_balances where user_id=t_uid(11)), '9500');
select t_eq('achat : commande en attente', (select count(*) from shop_orders where user_id=t_uid(11) and status='pending' and price=500)::text, '1');
select t_as(12); select t_eq('un pilote ne voit pas les commandes des autres', (select count(*) from shop_orders)::text, '0'); reset role;
update shop_items set stock = 1 where name = 'Couteau';
update shop_items set price = 900000 where name = 'Pétoire';
select t_as(11);
select t_fail($$select shop_buy((select id from shop_items where name='Pétoire'))$$, 'solde insuffisant refusé');
select shop_buy((select id from shop_items where name='Couteau'));
reset role;
select t_as(12); select t_fail($$select shop_buy((select id from shop_items where name='Couteau'))$$, 'article épuisé refusé'); reset role;
select t_as(11); select t_fail($$select admin_shop_order((select id from shop_orders limit 1), 'delivered')$$, 'un pilote ne traite pas de commande'); reset role;
select t_as(2);
select admin_shop_order((select id from shop_orders where item_name='Couteau'), 'cancelled', 'Rupture');
select t_fail($$select admin_shop_order((select id from shop_orders where item_name='Couteau'), 'delivered')$$, 'commande déjà traitée');
select admin_shop_order((select id from shop_orders where item_name='Fusée de détresse'), 'delivered');
reset role;
select t_eq('annulation : remboursement', (select balance::text from point_balances where user_id=t_uid(11)), '9500');
select t_eq('annulation : stock rétabli', (select stock::text from shop_items where name='Couteau'), '1');
select t_eq('livraison enregistrée', (select status from shop_orders where item_name='Fusée de détresse'), 'delivered');

-- Créneaux proposés (heure de Paris, 21 h – 23 h 30) : on se place le dimanche de la semaine en cours
update settings set value = '5' where key = 'challenges_per_week';
create or replace function t_slot(h int, m int) returns timestamptz language sql stable security definer as $$
  select (((_week_start() + 6)::timestamp + make_interval(hours => h, mins => m)) at time zone 'Europe/Paris') $$;
select t_as(17);
select t_fail($$select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(21,30)])$$, 'il faut 3 créneaux');
select t_fail($$select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(21,0), t_slot(22,0)])$$, '3 créneaux différents');
select t_fail($$select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(22,0), t_slot(12,0)])$$, 'créneau hors 21 h – 23 h 30 refusé');
select t_fail($$select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(22,0), t_slot(23,45)])$$, 'créneau après 23 h 30 refusé');
select t_fail($$select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(22,0), t_slot(21,0) + interval '8 days'])$$, 'créneau hors semaine refusé');
select create_challenge(t_uid(18), array[t_slot(21,0), t_slot(21,30), t_slot(22,0)]);
reset role;
select t_eq('3 créneaux enregistrés', (select count(*) from challenge_slots where challenge_id = t_c17())::text, '3');
select t_eq('duel standard : la carte est choisie par le défié', (select chosen_by from challenge_races where challenge_id=t_c17()), 'champion');
select t_as(19); select t_eq('un tiers ne voit pas les créneaux', (select count(*) from challenge_slots)::text, '0'); reset role;
select t_as(18);
select t_fail($$select set_race_track((select id from challenge_races where challenge_id=t_c17()), (select id from race_tracks where status='active' limit 1))$$, 'pas de carte avant la date validée');
select t_fail($$select schedule_challenge(t_c17(), t_slot(21,15))$$, 'date hors des créneaux proposés refusée');
select schedule_challenge(t_c17(), t_slot(21,30));
reset role;
select t_eq('créneau choisi = date du duel', (select scheduled_at::text from challenges where challenger_id=t_uid(17) order by created_at desc limit 1), t_slot(21,30)::text);
select t_as(17);
select t_fail($$select set_race_track((select id from challenge_races where challenge_id=t_c17()), (select id from race_tracks where status='active' limit 1))$$, 'le challenger ne choisit pas la carte d''un duel standard');
reset role;
select t_as(18);
select set_race_track((select id from challenge_races where challenge_id=t_c17()), (select id from race_tracks where status='active' order by name limit 1));
reset role;
select t_eq('carte choisie par le défié', (select (track_id is not null)::text from challenge_races where challenge_id=t_c17()), 'true');

-- Paris à cotes sur ce duel (17 #8 -> 18 #7)
select t_anon();
select t_eq('cotes lisibles par tous (>= 1,15)', (select (challenger_odds >= 1.15 and defender_odds >= 1.15)::text from duel_odds(t_c17())), 'true');
select t_eq('le défié est favori', (select (defender_odds < challenger_odds)::text from duel_odds(t_c17())), 'true');
reset role;
select t_fail($$select place_bet(t_c17(), 'challenger', 500)$$, 'un visiteur ne parie pas');
select t_as(17); select t_fail($$select place_bet(t_c17(), 'defender', 500)$$, 'un pilote ne parie pas sur son propre duel'); reset role;
select t_as(11);
select t_fail($$select place_bet(t_c17(), 'challenger', 50)$$, 'mise trop faible');
select t_fail($$select place_bet(t_c17(), 'challenger', 50500)$$, 'mise trop élevée (max 50 000)');
select t_fail($$select place_bet(t_c17(), 'nul', 500)$$, 'camp invalide');
select t_fail($$select place_bet(t_c17(), 'challenger', 750)$$, 'mise non ronde refusée');
select t_fail($$select place_bet(t_c17(), 'challenger', 450)$$, 'mise sous 500 refusée');
select place_bet(t_c17(), 'challenger', 1000);
select t_fail($$select place_bet(t_c17(), 'defender', 1000)$$, 'un seul pari par duel');
select t_fail($$update duel_bets set odds = 99, stake = 5000$$, 'un pilote ne modifie pas son pari');
reset role;
select t_as(12); select place_bet(t_c17(), 'defender', 2000); reset role;
select t_eq('mise débitée', (select balance::text from point_balances where user_id=t_uid(11)), '8500');
select t_as(12); select t_eq('un pilote ne voit que ses paris', (select count(*) from duel_bets)::text, '1'); reset role;

-- Le pari ne se règle qu'à la validation officielle : challenger (11 a misé sur lui) gagne
select t_as(2);
select admin_record_race_result((select id from challenge_races where challenge_id=t_c17() and race_no=1), t_uid(17), null, null);
reset role;
select t_eq('pari non réglé avant la validation', (select status from duel_bets where user_id=t_uid(11)), 'open');
select t_as(2); select admin_validate_challenge(t_c17()); reset role;
select t_eq('pari gagnant réglé', (select status from duel_bets where user_id=t_uid(11)), 'won');
select t_eq('gain = mise x cote (arrondi bas)', (select payout::text from duel_bets where user_id=t_uid(11)), (select floor(stake * odds)::text from duel_bets where user_id=t_uid(11)));
select t_eq('solde crédité', (select balance::text from point_balances where user_id=t_uid(11)), (8500 + (select payout from duel_bets where user_id=t_uid(11)))::text);
select t_eq('pari perdant réglé sans gain', (select status || payout::text from duel_bets where user_id=t_uid(12)), 'lost0');
select t_eq('solde du perdant : mise perdue', (select balance::text from point_balances where user_id=t_uid(12)), '8500');

-- Duel annulé : paris remboursés
insert into challenges(id, challenger_id, defender_id, challenger_position, defender_position, week_start, respond_by, scheduled_at, status)
values ('99999999-9999-9999-9999-999999999999', t_uid(20), t_uid(16), 7, 6, _week_start(), now() + interval '2 days', now() + interval '1 day', 'scheduled');
select t_as(13); select place_bet('99999999-9999-9999-9999-999999999999', 'defender', 1000); reset role;
select t_as(2); select admin_cancel_challenge('99999999-9999-9999-9999-999999999999', 'Test annulation'); reset role;
select t_eq('duel annulé : pari remboursé', (select status from duel_bets where user_id=t_uid(13)), 'refunded');
select t_eq('duel annulé : solde rétabli', (select balance::text from point_balances where user_id=t_uid(13)), '10000');
select t_as(13); select t_fail($$select place_bet('99999999-9999-9999-9999-999999999999', 'defender', 1000)$$, 'plus de pari sur un duel annulé'); reset role;

-- Podium : 1 carte du challenger, 1 du défié, la 3e tirée au sort (différente des deux autres)
insert into challenges(id, challenger_id, defender_id, challenger_position, defender_position, is_podium, week_start, respond_by, scheduled_at, status)
values ('88888888-8888-8888-8888-888888888888', t_uid(20), t_uid(16), 3, 2, true, _week_start(), now() + interval '2 days', now() + interval '1 day', 'scheduled');
insert into challenge_races(id, challenge_id, race_no, kind, chosen_by) values
  ('88888888-0000-0000-0000-000000000001','88888888-8888-8888-8888-888888888888',1,'sprint','challenger'),
  ('88888888-0000-0000-0000-000000000002','88888888-8888-8888-8888-888888888888',2,'sprint','champion'),
  ('88888888-0000-0000-0000-000000000003','88888888-8888-8888-8888-888888888888',3,'last_race','random');
select t_as(20); select set_race_track('88888888-0000-0000-0000-000000000001', (select id from race_tracks where name='Course 1')); reset role;
select t_eq('carte aléatoire : pas encore tirée', (select (track_id is null)::text from challenge_races where id='88888888-0000-0000-0000-000000000003'), 'true');
select t_as(20); select t_fail($$select set_race_track('88888888-0000-0000-0000-000000000002', (select id from race_tracks where name='Course 2'))$$, 'le challenger ne choisit pas la carte du défié'); reset role;
select t_as(16); select set_race_track('88888888-0000-0000-0000-000000000002', (select id from race_tracks where name='Course 2')); reset role;
select t_eq('3e carte tirée une fois les 2 choix faits', (select (track_id is not null)::text from challenge_races where id='88888888-0000-0000-0000-000000000003'), 'true');
select t_eq('3e carte différente des deux autres', (select (track_id not in (select track_id from challenge_races where id in ('88888888-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002')))::text from challenge_races where id='88888888-0000-0000-0000-000000000003'), 'true');
select t_eq('chaque pilote prévenu du tirage', (select count(*) from notifications where kind='track_chosen' and title='The random track has been drawn')::text, '2');
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (économie incluse)'
