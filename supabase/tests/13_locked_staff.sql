\echo ''
\echo '### 25. Zigollars de bienvenue verrouillés et montants sans plafond pour l''organisation'
reset role;
-- trois nouveaux pilotes (le bonus de bienvenue arrive verrouillé)
insert into auth.users(id, email) select t_uid(n), 'u' || n || '@test' from generate_series(50, 53) n;
insert into profiles(id, first_name, last_name, phone, discord_tag, registration_status) select t_uid(n), 'Nouveau' || n, 'Pilote' || n, '0690' || n, 'disc' || n, 'validated' from generate_series(50, 53) n;
select t_eq('bonus de bienvenue : 10 000 au solde dont 10 000 verrouillés', (select balance::text || '/' || locked::text from point_balances where user_id = t_uid(50)), '10000/10000');
select t_as(50);
select t_fail($$select shop_buy((select id from shop_items where name = 'Fusée de détresse'))$$, 'achat impossible avec les zigollars de bienvenue');
select t_fail($$select place_bet('88888888-8888-8888-8888-888888888888', 'defender', 500)$$, 'pari impossible avec les zigollars de bienvenue');
select t_fail($$select shop_buy((select id from shop_items where name = 'Fusée de détresse'))$$, 'message : verrouillé jusqu''au premier gain');
reset role;
select t_eq('rien n''a été dépensé', (select balance::text from point_balances where user_id = t_uid(50)), '10000');

-- Premier gain : victoire en duel / Warm-up / gain d'organisation -> tout se débloque
select _points_add(t_uid(51), 2500, 'Victoire en duel', 'duel_win', gen_random_uuid());
select t_eq('premier gain (duel) : plus rien de verrouillé', (select balance::text || '/' || locked::text from point_balances where user_id = t_uid(51)), '12500/0');
select t_as(51); select t_ok($$select shop_buy((select id from shop_items where name = 'Fusée de détresse'))$$, 'après un gain : achat possible'); reset role;
select t_eq('achat débité du solde disponible', (select balance::text from point_balances where user_id = t_uid(51)), '12000');
select t_as(2); select admin_grant_points(t_uid(50), 100, 'Premier gain accordé par l''organisation'); reset role;
select t_eq('gain d''organisation : débloque aussi', (select balance::text || '/' || locked::text from point_balances where user_id = t_uid(50)), '10100/0');
select t_as(50); select t_ok($$select shop_buy((select id from shop_items where name = 'Fusée de détresse'))$$, 'achat possible une fois débloqué'); reset role;
-- un remboursement ou une dépense ne débloque rien : on ne dépense que le disponible
select _points_add(t_uid(52), 3000, 'Participation à la Warm-up Race', 'warmup', gen_random_uuid());
select t_eq('participation Warm-up : débloque aussi', (select locked::text from point_balances where user_id = t_uid(52)), '0');
-- retrait par l'organisation : possible même sur des zigollars verrouillés, sans jamais passer sous 0
select t_as(2); select admin_grant_points(t_uid(53), -4000, 'Correction de l''organisation'); reset role;
select t_eq('retrait d''organisation : solde réduit, verrou ajusté', (select balance::text || '/' || locked::text from point_balances where user_id = t_uid(53)), '6000/6000');
select t_as(2); select t_fail($$select admin_grant_points(t_uid(53), -999999, 'trop')$$, 'on ne passe pas sous 0'); reset role;

-- Organisation : montants sans plafond
select t_as(2);
select t_ok($$select admin_grant_points(t_uid(50), 25000000, 'Très gros montant')$$, 'un organisateur accorde 25 millions de zigollars');
select t_ok($$insert into shop_items(name, price, category) values ('Article hors de prix', 5000000, 'Divers')$$, 'un article peut dépasser 1 000 000');
reset role;
select t_eq('solde après le gros montant', (select balance::text from point_balances where user_id = t_uid(50)), '25009600');
