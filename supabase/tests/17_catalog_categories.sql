\echo ''
\echo '### 29. Catégories de la liste des véhicules autorisés'
reset role;
select t_eq('catégories de la liste ajoutées au réglage', (select (value ? 'Drift' and value ? 'Grosse cylindrées' and value ? 'Vans' and value ? 'Sportives Classiques')::text from settings where key = 'vehicle_classes'), 'true');
select t_eq('les anciennes catégories sont conservées', (select (value ? 'Muscle' and value ? 'Motos' and value ? 'Tout-terrain')::text from settings where key = 'vehicle_classes'), 'true');
select t_eq('aucun doublon dans le réglage', (select (jsonb_array_length(value) = (select count(distinct x) from jsonb_array_elements_text(value) x))::text from settings where key = 'vehicle_classes'), 'true');
select t_eq('« Supersportives » reste interdite', (select (value ? 'Supersportives')::text from settings where key = 'forbidden_vehicle_classes'), 'true');
insert into auth.users(id, email) values (t_uid(80), 'cat@test');
insert into profiles(id, first_name, last_name, phone, discord_tag, registration_status) values (t_uid(80), 'Cat', 'Egorie', '0680800', 'cat', 'validated');
select t_ok($$insert into vehicles(owner_id, make_model, vehicle_class) values (t_uid(80), 'Vapid Blade', 'Lowrider')$$, 'véhicule d''une catégorie de la liste accepté');
select t_fail($$insert into vehicles(owner_id, make_model, vehicle_class) values (t_uid(80), 'Truc', 'Inconnue')$$, 'catégorie inconnue toujours refusée');
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (suppression de compte incluse)'
