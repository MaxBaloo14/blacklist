-- Rappels de duel affichés sur le site (cloche de notifications) : 24 h puis 1 h avant le départ.
-- Aucun planificateur : la fonction est appelée par le site quand un pilote ou un organisateur est connecté ; elle ne notifie chaque rappel qu'une fois.
alter table challenges add column if not exists reminded_24h_at timestamptz, add column if not exists reminded_1h_at timestamptz;

create or replace function duel_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare c record; n int := 0; tz text := setting('timezone') #>> '{}'; at_txt text;
begin
  if auth.uid() is null then return 0; end if;
  for c in
    select * from challenges
    where status = 'scheduled' and scheduled_at > now() and scheduled_at <= now() + interval '24 hours'
      and (reminded_24h_at is null or (reminded_1h_at is null and scheduled_at <= now() + interval '1 hour'))
      and (is_admin() or auth.uid() in (challenger_id, defender_id))
    for update
  loop
    at_txt := to_char(c.scheduled_at at time zone tz, 'DD/MM HH24:MI');
    if c.scheduled_at <= now() + interval '1 hour' then
      if c.reminded_1h_at is null then
        update challenges set reminded_1h_at = now(), reminded_24h_at = coalesce(reminded_24h_at, now()) where id = c.id;
        perform _notify(c.challenger_id, 'duel_reminder', 'Your duel starts in 1 hour', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || at_txt, '/challenges');
        perform _notify(c.defender_id,   'duel_reminder', 'Your duel starts in 1 hour', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || at_txt, '/challenges');
        n := n + 1;
      end if;
    elsif c.reminded_24h_at is null then
      update challenges set reminded_24h_at = now() where id = c.id;
      perform _notify(c.challenger_id, 'duel_reminder', 'Your duel starts in 24 hours', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || at_txt, '/challenges');
      perform _notify(c.defender_id,   'duel_reminder', 'Your duel starts in 24 hours', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || at_txt, '/challenges');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function duel_reminders() from public, anon;
grant execute on function duel_reminders() to authenticated;
