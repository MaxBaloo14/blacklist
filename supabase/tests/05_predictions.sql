\echo ''
\echo '### 17. Pronostics et modèles de messages'
reset role;
-- duel a1 (pilotes 23 vs 24) est programmé dans le futur : on le repousse pour ce test
update challenges set scheduled_at = now() + interval '2 days' where id = '00000000-0000-0000-0000-0000000000a1';
select t_anon();
select t_fail($$select predict_duel('00000000-0000-0000-0000-0000000000a1','challenger')$$, 'anonyme ne vote pas');
select t_as(23);
select t_fail($$select predict_duel('00000000-0000-0000-0000-0000000000a1','challenger')$$, 'un duelliste ne vote pas sur son propre duel');
select t_as(22);
select t_ok($$select predict_duel('00000000-0000-0000-0000-0000000000a1','challenger')$$, 'un pilote tiers vote');
select t_ok($$select predict_duel('00000000-0000-0000-0000-0000000000a1','defender')$$, 'il peut changer son vote');
select t_fail($$select predict_duel('00000000-0000-0000-0000-0000000000a1','nimporte')$$, 'choix invalide refusé');
select t_fail($$insert into duel_predictions(challenge_id,user_id,pick) values ('00000000-0000-0000-0000-0000000000a1', t_uid(22), 'defender')$$, 'écriture directe refusée');
select t_as(21);
select t_ok($$select predict_duel('00000000-0000-0000-0000-0000000000a1','defender')$$, 'un autre pilote vote');
select t_eq('un vote par pilote : 1 vote visible pour soi', (select count(*) from duel_predictions)::text, '1');
select t_anon();
select t_eq('totaux publics : 0 pour le challenger, 2 pour le défendeur', (select challenger_votes||'/'||defender_votes from public_predictions where challenge_id='00000000-0000-0000-0000-0000000000a1'), '0/2');
select t_fail($$select * from duel_predictions$$, 'anonyme ne lit pas les votes individuels');
reset role;
update challenges set scheduled_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-0000000000a1';
select t_as(21);
select t_fail($$select predict_duel('00000000-0000-0000-0000-0000000000a1','challenger')$$, 'pronostic fermé après le départ');
reset role;
select t_as(22);
select t_eq('pilote : modèles de messages invisibles', (select count(*) from message_templates)::text, '0');
select t_fail($$insert into message_templates(kind,title,body) values ('vehicle','hack','xxx')$$, 'pilote ne crée pas de modèle');
select t_as(2);
select t_ok($$insert into message_templates(kind,title,body) values ('vehicle','Test modèle','Texte du modèle')$$, 'organisateur crée un modèle');
select t_eq('organisateur voit les modèles (9 de départ + 1)', (select count(*) from message_templates)::text, '10');
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (pronostics et modèles inclus)'
