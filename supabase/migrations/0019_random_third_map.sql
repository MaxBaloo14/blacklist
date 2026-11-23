-- 0019 : 3e carte du Bo3 tirée au sort parmi toutes les cartes actives (y compris une carte déjà choisie par un duelliste).
create or replace function set_race_track(p_race uuid, p_track uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r challenge_races; c challenges; r3 challenge_races; t1 uuid; t2 uuid; pick uuid; other uuid; tname text;
begin
  select * into r from challenge_races where id = p_race;
  select * into c from challenges where id = r.challenge_id;
  if c.id is null then raise exception 'Manche introuvable.'; end if;
  if not (is_admin() or (r.chosen_by = 'champion' and auth.uid() = c.defender_id) or (r.chosen_by = 'challenger' and auth.uid() = c.challenger_id)) then
    raise exception 'Tu ne choisis pas le tracé de cette manche.' using errcode='42501';
  end if;
  if is_admin() then
    if c.status not in ('awaiting_schedule','scheduled') then raise exception 'Ce défi est clos.'; end if;
  elsif c.status <> 'scheduled' then
    raise exception 'La carte se choisit une fois la date du duel validée.';
  end if;
  if not exists(select 1 from race_tracks where id = p_track and status = 'active') then raise exception 'Circuit inactif ou inconnu.'; end if;
  update challenge_races set track_id = p_track where id = p_race;

  -- 3e carte du podium : tirée au sort parmi toutes les cartes actives (même une déjà choisie), dès que les deux autres sont connues
  select track_id into t1 from challenge_races where challenge_id = c.id and race_no = 1;
  select track_id into t2 from challenge_races where challenge_id = c.id and race_no = 2;
  select * into r3 from challenge_races where challenge_id = c.id and race_no = 3 and chosen_by = 'random' and track_id is null;
  if r3.id is not null and t1 is not null and t2 is not null then
    select id into pick from race_tracks where status = 'active' order by random() limit 1;
    update challenge_races set track_id = pick where id = r3.id;
    select name into tname from race_tracks where id = pick;
    perform _notify(c.challenger_id, 'track_chosen', 'The random track has been drawn', tname, '/challenges');
    perform _notify(c.defender_id,   'track_chosen', 'The random track has been drawn', tname, '/challenges');
  end if;
  if r.chosen_by in ('champion','challenger') and not is_admin() then
    other := case when auth.uid() = c.defender_id then c.challenger_id else c.defender_id end;
    select name into tname from race_tracks where id = p_track;
    perform _notify(other, 'track_chosen', 'A track has been chosen for your duel', tname, '/challenges');
  end if;
end $$;
