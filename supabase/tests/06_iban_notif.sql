\echo ''
\echo '### 18. Notification « prime sans IBAN »'
reset role;
-- pilotes 21 (sans IBAN) et 23 (avec IBAN, renseigné au scénario 16) ; deux défis terminés fictifs pour porter les primes
insert into challenges(id, challenger_id, defender_id, challenger_position, defender_position, week_start, status, respond_by, validated_at, winner_id)
  values ('00000000-0000-0000-0000-0000000000b1', t_uid(21), t_uid(22), 13, 12, current_date-9, 'completed', now(), now(), t_uid(21)),
         ('00000000-0000-0000-0000-0000000000b2', t_uid(23), t_uid(24), 11, 10, current_date-9, 'completed', now(), now(), t_uid(23)),
         ('00000000-0000-0000-0000-0000000000b3', t_uid(21), t_uid(22), 13, 12, current_date-2, 'completed', now(), now(), t_uid(21));
select t_eq('pilote 21 sans IBAN au départ', (select count(*) from profiles where id = t_uid(21) and bank_iban is null)::text, '1');
insert into rewards(challenge_id, driver_id, rank_beaten, amount) values ('00000000-0000-0000-0000-0000000000b1', t_uid(21), 12, 500000);
select t_eq('prime sans IBAN : le pilote est prévenu', (select count(*) from notifications where user_id = t_uid(21) and kind = 'iban_missing')::text, '1');
select t_eq('le message annonce le montant', (select (body like '%$500000%')::text from notifications where user_id = t_uid(21) and kind = 'iban_missing'), 'true');
insert into rewards(challenge_id, driver_id, rank_beaten, amount) values ('00000000-0000-0000-0000-0000000000b3', t_uid(21), 12, 300000);
select t_eq('pas de doublon tant que la première alerte est non lue', (select count(*) from notifications where user_id = t_uid(21) and kind = 'iban_missing')::text, '1');
insert into rewards(challenge_id, driver_id, rank_beaten, amount) values ('00000000-0000-0000-0000-0000000000b2', t_uid(23), 10, 400000);
select t_eq('pilote avec IBAN : aucune alerte', (select count(*) from notifications where user_id = t_uid(23) and kind = 'iban_missing')::text, '0');
select t_as(21);
select t_fail($$select _notify_missing_iban()$$, 'la fonction interne n''est pas appelable depuis l''API');
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (alerte IBAN incluse)'
