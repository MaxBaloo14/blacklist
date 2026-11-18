\echo ''
\echo '### 15. Rappels de duel sur le site (24 h puis 1 h)'
reset role;
insert into challenges(id, challenger_id, defender_id, challenger_position, defender_position, week_start, status, respond_by, scheduled_at)
  values ('00000000-0000-0000-0000-0000000000a1', t_uid(23), t_uid(24), 11, 10, current_date, 'scheduled', now() + interval '1 day', now() + interval '23 hours'),
         ('00000000-0000-0000-0000-0000000000a2', t_uid(21), t_uid(22), 13, 12, current_date, 'scheduled', now() + interval '1 day', now() + interval '3 days');
select t_anon();
select t_fail($$select duel_reminders()$$, 'anonyme : rappels refusés');
select t_as(21);
select t_eq('pilote sans duel proche : aucun rappel', duel_reminders()::text, '0');
select t_as(23);
select t_eq('duel dans 23 h : un rappel 24 h', duel_reminders()::text, '1');
select t_eq('rappel rejoué : pas de doublon', duel_reminders()::text, '0');
reset role;
select t_eq('les DEUX pilotes sont notifiés (24 h)', (select count(*) from notifications where kind='duel_reminder' and title='Your duel starts in 24 hours' and user_id in (t_uid(23), t_uid(24)))::text, '2');
update challenges set scheduled_at = now() + interval '30 minutes' where id = '00000000-0000-0000-0000-0000000000a1';
select t_as(24);
select t_eq('duel dans 30 min : un rappel 1 h', duel_reminders()::text, '1');
select t_eq('rappel 1 h rejoué : pas de doublon', duel_reminders()::text, '0');
reset role;
select t_eq('les DEUX pilotes sont notifiés (1 h)', (select count(*) from notifications where kind='duel_reminder' and title='Your duel starts in 1 hour' and user_id in (t_uid(23), t_uid(24)))::text, '2');
select t_eq('duel dans 3 jours : aucun rappel', (select count(*) from notifications where kind='duel_reminder' and user_id in (t_uid(21), t_uid(22)))::text, '0');
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (rappels inclus)'
