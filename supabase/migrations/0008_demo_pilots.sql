-- Pilotes de démonstration : Coby #1, Oby #2, Chase #3 + un duel du podium Chase → Oby (place de #2).
-- Ces comptes n'ont pas de mot de passe (connexion impossible). Ils ne sont créés que si la Blacklist est encore vide,
-- pour ne jamais toucher à de vrais pilotes. L'organisateur les retire depuis « Classement » / « Pilotes » quand il veut.
do $$
declare
  cls text;
  names text[] := array['Coby','Oby','Chase'];
  cars  text[] := array['Karin Sultan RS','Annis Elegy RH','Vapid Dominator GT'];
  ids   uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  i int; duel uuid; fri timestamptz;
begin
  if exists (select 1 from blacklist_rankings where driver_id is not null) or exists (select 1 from profiles where phone_key in ('000001','000002','000003')) then
    raise notice 'Blacklist non vide : pilotes de démonstration non créés.';
    return;
  end if;
  select value #>> '{0}' into cls from settings where key = 'vehicle_classes';
  for i in 1..3 loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', ids[i], 'authenticated', 'authenticated', 'demo-' || lower(names[i]) || '@pilote.blacklist-bbc.app', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into profiles (id, first_name, last_name, phone, registration_status, entry_eligible, blacklist_entered_at)
    values (ids[i], names[i], ' ', '00000' || i, 'validated', true, now());
    insert into vehicles (owner_id, make_model, vehicle_class) values (ids[i], cars[i], cls);
    update vehicles set status = 'approved', reviewed_at = now() where owner_id = ids[i];
    update blacklist_rankings set driver_id = ids[i] where "position" = i;
    insert into ranking_history (driver_id, from_position, to_position, kind, reason) values (ids[i], null, i, 'manual', 'Pilote de démonstration');
  end loop;

  -- Duel du podium : Chase (#3) défie Oby (#2), programmé, meilleur des 3
  fri := (date '2027-01-02' + time '21:00') at time zone 'Europe/Paris';
  insert into challenges (challenger_id, defender_id, challenger_position, defender_position, is_podium, week_start, status, respond_by, scheduled_at, scheduled_by)
  values (ids[3], ids[2], 3, 2, true, date '2026-12-28', 'scheduled', now() + interval '48 hours', fri, ids[2]) returning id into duel;
  insert into challenge_races (challenge_id, race_no, kind, chosen_by) values (duel, 1, 'sprint', 'champion'), (duel, 2, 'sprint', 'challenger'), (duel, 3, 'last_race', 'organisation');
end $$;
