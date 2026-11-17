-- 0006 : le numéro de téléphone devient l'identifiant de connexion ; pseudo Discord et photo ne sont plus obligatoires.

-- 1) Pseudo Discord facultatif
alter table profiles alter column discord_tag drop not null;

-- 2) Photo du véhicule facultative
alter table vehicles alter column photo_path drop not null;

-- 3) Clé de connexion : le numéro sans espaces ni tirets (ex. "06 12-34" -> "061234")
alter table profiles add column if not exists phone_key text generated always as (regexp_replace(phone, '\D', '', 'g')) stored;
do $$ begin
  if exists (select phone_key from profiles group by phone_key having count(*) > 1) then
    raise notice 'Numéros en double : index unique non créé (à nettoyer manuellement).';
  else
    create unique index if not exists profiles_phone_key_unique on profiles (phone_key);
  end if;
end $$;

-- 4) Proposition de véhicule : photo facultative (si fournie, elle doit rester dans le dossier du pilote)
create or replace function propose_vehicle(p_make_model text, p_class text, p_photo_path text, p_is_shop boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cur uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  if p_is_shop then raise exception 'Les véhicules de boutique sont interdits.'; end if;
  if p_photo_path is not null and p_photo_path not like auth.uid()::text || '/%' then raise exception 'Photographie invalide.'; end if;
  if exists(select 1 from vehicles where owner_id = auth.uid() and status = 'pending') then
    raise exception 'Une demande d''homologation est déjà en cours.';
  end if;
  select id into v_cur from vehicles where owner_id = auth.uid() and status = 'approved';
  insert into vehicles(owner_id, make_model, vehicle_class, photo_path, replaces_vehicle_id)
  values (auth.uid(), trim(p_make_model), p_class, p_photo_path, v_cur) returning id into v_id;
  perform _notify_admins('vehicle_pending', 'Vehicle awaiting approval', _name(auth.uid()) || ' — ' || p_make_model, '/admin/vehicles');
  return v_id;
end $$;
