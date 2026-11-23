-- 0020 : réclamations (titre, message, plusieurs liens vidéo/image) et suggestions de course (tracé rouge sur la carte).

create or replace function _links_ok(l text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(char_length(x) between 10 and 500 and x ~ '^https?://[^[:space:]<>"]+$'), true) from unnest(l) x
$$;

-- ===== Réclamations =====
create table claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  message     text not null check (char_length(message) between 10 and 3000),
  links       text[] not null default '{}' check (cardinality(links) <= 5 and _links_ok(links)),
  status      text not null default 'open' check (status in ('open','in_progress','resolved','rejected')),
  admin_reply text check (char_length(admin_reply) <= 2000),
  handled_by  uuid,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);
create index on claims(status, created_at desc);
create index on claims(user_id, created_at desc);
alter table claims enable row level security;
create policy claims_read on claims for select using (user_id = auth.uid() or is_admin());
revoke all on claims from anon, authenticated;
grant select on claims to authenticated;      -- lecture limitée par la RLS ; l'écriture passe par les fonctions

create or replace function submit_claim(p_title text, p_message text, p_links text[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid; links text[] := coalesce(p_links, '{}');
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  p_title := btrim(coalesce(p_title, '')); p_message := btrim(coalesce(p_message, ''));
  if char_length(p_title) < 3 or char_length(p_title) > 120 then raise exception 'Le titre doit faire entre 3 et 120 caractères.'; end if;
  if char_length(p_message) < 10 or char_length(p_message) > 3000 then raise exception 'Le message doit faire entre 10 et 3 000 caractères.'; end if;
  links := array(select btrim(x) from unnest(links) x where btrim(x) <> '');
  if cardinality(links) > 5 then raise exception '5 liens au maximum.'; end if;
  if not _links_ok(links) then raise exception 'Chaque lien doit commencer par http:// ou https://.'; end if;
  if (select count(*) from claims where user_id = me and created_at > now() - interval '24 hours') >= 3 then raise exception 'Tu as déjà envoyé 3 réclamations aujourd''hui. Patiente ou complète une réclamation existante.'; end if;
  insert into claims(user_id, title, message, links) values (me, p_title, p_message, links) returning id into v_id;
  perform _notify_admins('claim_new', 'New claim', _name(me) || ' — ' || left(p_title, 80), '/admin/claims');
  update profiles set last_activity_at = now() where id = me;
  return v_id;
end $$;
revoke execute on function submit_claim(text, text, text[]) from public, anon;
grant execute on function submit_claim(text, text, text[]) to authenticated;

create or replace function admin_handle_claim(p_claim uuid, p_status text, p_reply text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c claims;
begin
  perform _require_admin();
  if p_status not in ('in_progress','resolved','rejected') then raise exception 'Statut invalide.'; end if;
  p_reply := nullif(btrim(coalesce(p_reply, '')), '');
  if p_status in ('resolved','rejected') and (p_reply is null or char_length(p_reply) < 3) then raise exception 'Une réponse est obligatoire pour clore la réclamation.'; end if;
  select * into c from claims where id = p_claim for update;
  if c.id is null then raise exception 'Réclamation introuvable.'; end if;
  update claims set status = p_status, admin_reply = coalesce(p_reply, admin_reply), handled_by = auth.uid(), handled_at = now() where id = c.id;
  perform _log('claim:' || p_status, 'claim', c.id::text, jsonb_build_object('reply', p_reply));
  perform _notify(c.user_id, 'claim', 'Your claim has been updated', left(c.title, 80) || ' — ' || p_status, '/reclamation');
end $$;
revoke execute on function admin_handle_claim(uuid, text, text) from public, anon;
grant execute on function admin_handle_claim(uuid, text, text) to authenticated;

-- ===== Suggestions de course =====
create table course_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 1000),
  route_path  text not null check (char_length(route_path) between 10 and 60000 and route_path ~ '^M[-0-9. ,CL]+$'),
  route_w     int not null check (route_w between 100 and 20000),
  route_h     int not null check (route_h between 100 and 20000),
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  admin_note  text check (char_length(admin_note) <= 1000),
  handled_by  uuid,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);
create index on course_suggestions(status, created_at desc);
create index on course_suggestions(user_id, created_at desc);
alter table course_suggestions enable row level security;
create policy suggestions_read on course_suggestions for select using (user_id = auth.uid() or is_admin());
revoke all on course_suggestions from anon, authenticated;
grant select on course_suggestions to authenticated;

create or replace function submit_suggestion(p_name text, p_description text, p_path text, p_w int, p_h int) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  p_name := btrim(coalesce(p_name, '')); p_description := nullif(btrim(coalesce(p_description, '')), '');
  if char_length(p_name) < 3 or char_length(p_name) > 60 then raise exception 'Le nom doit faire entre 3 et 60 caractères.'; end if;
  if (select count(*) from course_suggestions where user_id = me and status = 'pending') >= 5 then raise exception 'Tu as déjà 5 suggestions en attente. Attends la réponse de l''organisation.'; end if;
  begin
    insert into course_suggestions(user_id, name, description, route_path, route_w, route_h) values (me, p_name, p_description, p_path, p_w, p_h) returning id into v_id;
  exception when check_violation then
    raise exception 'Tracé invalide : place au moins 2 points sur la carte.';
  end;
  perform _notify_admins('suggestion_new', 'New course suggestion', _name(me) || ' — ' || left(p_name, 80), '/admin/suggestions');
  update profiles set last_activity_at = now() where id = me;
  return v_id;
end $$;
revoke execute on function submit_suggestion(text, text, text, int, int) from public, anon;
grant execute on function submit_suggestion(text, text, text, int, int) to authenticated;

create or replace function admin_handle_suggestion(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s course_suggestions;
begin
  perform _require_admin();
  if p_status not in ('accepted','declined') then raise exception 'Statut invalide.'; end if;
  select * into s from course_suggestions where id = p_id for update;
  if s.id is null then raise exception 'Suggestion introuvable.'; end if;
  update course_suggestions set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), handled_by = auth.uid(), handled_at = now() where id = s.id;
  perform _log('suggestion:' || p_status, 'course_suggestion', s.id::text, jsonb_build_object('note', p_note));
  perform _notify(s.user_id, 'suggestion', 'Your course suggestion has been reviewed', left(s.name, 80) || ' — ' || p_status, '/suggestion');
end $$;
revoke execute on function admin_handle_suggestion(uuid, text, text) from public, anon;
grant execute on function admin_handle_suggestion(uuid, text, text) to authenticated;
