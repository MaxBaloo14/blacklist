\echo ''
\echo '### 24. Zigollars par victoire en duel et brouillons de circuits'
reset role;
select t_eq('chaque duel disputé et validé a rapporté 2 500 zigollars à son vainqueur', (select count(*)::text from point_ledger where kind = 'duel_win' and delta = 2500), (select count(*)::text from challenges where status = 'completed' and winner_id is not null and validated_by is not null));
select t_eq('chaque ligne de gain correspond au vainqueur du duel', (select count(*)::text from point_ledger l join challenges c on c.id = l.ref where l.kind = 'duel_win' and l.user_id = c.winner_id), (select count(*)::text from point_ledger where kind = 'duel_win'));
select t_eq('aucun gain pour un forfait', (select count(*)::text from point_ledger l join challenges c on c.id = l.ref where l.kind = 'duel_win' and c.status = 'forfeited'), '0');
select t_fail($$insert into point_ledger(user_id, delta, reason, kind, ref) select user_id, 2500, 'doublon', 'duel_win', ref from point_ledger where kind = 'duel_win' limit 1$$, 'pas de double versement pour un même duel');
select t_eq('réglage du gain lisible par un pilote', (select (value = '2500'::jsonb)::text from settings where key = 'duel_win_zigollars'), 'true');
select t_as(12); select t_rows('un pilote ne modifie pas le gain', $$update settings set value = '9999999' where key = 'duel_win_zigollars'$$, 0); reset role;

-- Brouillons : organisation uniquement
select t_as(12);
select t_fail($$insert into track_drafts(created_by, name, points, map_w, map_h) values (t_uid(12), 'Intrus', '[[1,1],[2,2]]', 1280, 1920)$$, 'un pilote ne crée pas de brouillon');
select t_eq('un pilote ne voit aucun brouillon', (select count(*)::text from track_drafts), '0');
reset role;
select t_as(2);
select t_ok($$insert into track_drafts(created_by, name, points, map_w, map_h, distance_km) values (t_uid(2), 'Brouillon', '[[100,100],[200,250]]', 1280, 1920, 4.2)$$, 'un organisateur crée un brouillon');
select t_fail($$insert into track_drafts(created_by, name, points, map_w, map_h) values (t_uid(2), 'Trop', (select jsonb_agg(jsonb_build_array(i, i)) from generate_series(1, 70) i), 1280, 1920)$$, 'plus de 60 points refusé');
select t_eq('l''organisateur retrouve son brouillon', (select count(*)::text from track_drafts), '1');
select t_ok($$update race_tracks set editor_points = '[[1,1],[2,2]]', editor_follow = true, editor_w = 1280, editor_h = 1920 where name = 'Course 1'$$, 'les points de passage se conservent sur un circuit');
reset role;
select t_as(12); select t_rows('un pilote ne modifie pas les points d''un circuit', $$update race_tracks set editor_points = '[]' where name = 'Course 1'$$, 0); reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (gains de duel et brouillons inclus)'
