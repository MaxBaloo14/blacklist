\echo ''
\echo '### 23. Bonus Warm-up, meilleurs parieurs et votes sur les suggestions'
reset role;
-- Warm-up : 500 zigollars par participant, une seule fois (l'édition validée au scénario 12 avait des participants)
select t_eq('chaque participant de la Warm-up a reçu 500 zigollars', (select count(*)::text from point_ledger where kind = 'warmup' and delta = 500), (select count(*)::text from warmup_participants wp join warmup_events we on we.id = wp.event_id where we.validated_at is not null));
select t_eq('au moins un participant récompensé', (select (count(*) > 0)::text from point_ledger where kind = 'warmup'), 'true');
select t_fail($$insert into point_ledger(user_id, delta, reason, kind, ref) select user_id, 500, 'doublon', 'warmup', ref from point_ledger where kind = 'warmup' limit 1$$, 'pas de double versement pour une même édition');
select t_eq('réglage du bonus lisible par un pilote', (select (value = '500'::jsonb)::text from settings where key = 'warmup_participation_zigollars'), 'true');
select t_as(12); select t_eq('un pilote lit le réglage de l''échelle de la carte', (select count(*)::text from settings where key = 'map_scale_m_per_px'), '1'); reset role;
select t_as(12); select t_rows('un pilote ne modifie pas l''échelle', $$update settings set value = '1' where key = 'map_scale_m_per_px'$$, 0); reset role;

-- Meilleurs parieurs : agrégats publics des paris réglés
select t_anon();
select t_eq('un visiteur voit le classement des parieurs', (select (count(*) >= 2)::text from public_bettors), 'true');
select t_eq('bénéfice du gagnant = gain - mise', (select (profit > 0)::text from public_bettors where driver_id = t_uid(11)), 'true');
select t_eq('perte du perdant = - mise', (select profit::text from public_bettors where driver_id = t_uid(12)), '-2000');
select t_fail($$select * from duel_bets$$, 'les paris individuels restent privés');
reset role;

-- Votes sur les suggestions (la suggestion « Boucle du port » du scénario 22 est acceptée : on en crée une nouvelle)
insert into course_suggestions(id, user_id, name, route_path, route_w, route_h) values ('77777777-7777-7777-7777-777777777777', t_uid(13), 'Course à voter', 'M100 100 C150 120 200 160 260 190', 1280, 1920);
select t_anon(); select t_fail($$select * from suggestion_board$$, 'un visiteur ne voit pas le tableau des votes'); reset role;
select t_as(14);
select t_eq('le tableau montre la suggestion ouverte, sans vote', (select votes::text || '/' || voted::text || '/' || mine::text from suggestion_board where id = '77777777-7777-7777-7777-777777777777'), '0/false/false');
select t_eq('premier appel : vote enregistré', vote_suggestion('77777777-7777-7777-7777-777777777777')::text, 'true');
select t_eq('le vote est compté', (select votes::text || '/' || voted::text from suggestion_board where id = '77777777-7777-7777-7777-777777777777'), '1/true');
select t_eq('second appel : le vote est retiré', vote_suggestion('77777777-7777-7777-7777-777777777777')::text, 'false');
select t_eq('un seul vote par pilote', vote_suggestion('77777777-7777-7777-7777-777777777777')::text, 'true');
select t_fail($$insert into suggestion_votes(suggestion_id, user_id) values ('77777777-7777-7777-7777-777777777777', t_uid(14))$$, 'pas d''écriture directe des votes');
reset role;
select t_as(13);
select t_fail($$select vote_suggestion('77777777-7777-7777-7777-777777777777')$$, 'on ne vote pas pour sa propre suggestion');
select t_eq('l''auteur se voit marqué « mine »', (select mine::text from suggestion_board where id = '77777777-7777-7777-7777-777777777777'), 'true');
reset role;
select t_as(15); select t_eq('un autre pilote voit 1 vote et n''a pas voté', (select votes::text || '/' || voted::text from suggestion_board where id = '77777777-7777-7777-7777-777777777777'), '1/false'); reset role;
select t_as(2); select t_eq('un organisateur lit les votes', (select count(*)::text from suggestion_votes), '1'); reset role;
select t_as(15); select t_eq('un pilote ne lit que ses votes', (select count(*)::text from suggestion_votes), '0'); reset role;
select t_as(2); select admin_handle_suggestion('77777777-7777-7777-7777-777777777777', 'declined', 'Non retenue pour le test'); reset role;
select t_as(15); select t_fail($$select vote_suggestion('77777777-7777-7777-7777-777777777777')$$, 'plus de vote sur une suggestion traitée'); reset role;
select t_eq('une suggestion traitée sort du tableau', (select count(*)::text from suggestion_board where id = '77777777-7777-7777-7777-777777777777'), '0');
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (bonus Warm-up, parieurs et votes inclus)'
