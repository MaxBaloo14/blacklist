\echo ''
\echo '### 16. IBAN bancaire du pilote'
reset role;
select t_as(23);
select t_ok($$update profiles set bank_iban = 'FR76 3000 1234' where id = t_uid(23)$$, 'le pilote renseigne son IBAN');
select t_eq('le pilote relit son IBAN', (select bank_iban from profiles where id = t_uid(23)), 'FR76 3000 1234');
select t_fail($$update profiles set bank_iban = 'ab<script>' where id = t_uid(23)$$, 'format invalide refusé');
select t_rows('impossible de modifier l''IBAN d''un autre', $$update profiles set bank_iban = 'HACK 1234' where id = t_uid(24)$$, 0);
select t_eq('un autre pilote ne voit pas l''IBAN', (select count(*) from profiles where id = t_uid(23) and bank_iban is not null and t_uid(22) = auth.uid())::text, '0');
select t_as(22);
select t_eq('pilote tiers : IBAN d''autrui invisible', (select count(*) from profiles where id = t_uid(23))::text, '0');
select t_anon();
select t_eq('anonyme : IBAN invisible', (select count(*) from profiles where bank_iban is not null)::text, '0');
select t_eq('vue publique : pas de colonne IBAN', (select count(*) from information_schema.columns where table_name in ('public_driver','public_blacklist','public_duels') and column_name = 'bank_iban')::text, '0');
select t_as(2);
select t_eq('organisateur : lit l''IBAN pour payer', (select bank_iban from profiles where id = t_uid(23)), 'FR76 3000 1234');
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (IBAN inclus)'
