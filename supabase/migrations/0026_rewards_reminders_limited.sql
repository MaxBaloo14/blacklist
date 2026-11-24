-- 0026 : récompense d'une suggestion retenue, rappels et récap des paris, activité de l'observateur, articles en édition limitée.

-- ===== 1. Suggestion retenue : zigollars pour l'auteur + mention « Circuit proposé par » =====
insert into settings(key, value, description) values ('suggestion_reward_zigollars', '5000', 'Zigollars offerts à l''auteur d''une suggestion de course retenue') on conflict (key) do nothing;
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (key in ('rewards','inactivity_days','challenge_response_hours','vehicle_classes','forbidden_vehicle_classes','podium_size','challenges_per_week','warmup_participation_zigollars','map_scale_m_per_px','duel_win_zigollars','suggestion_reward_zigollars') or is_admin());

alter table race_tracks add column if not exists suggested_by_name text;
create unique index if not exists point_suggestion_once on point_ledger(ref) where kind = 'suggestion';

-- une récompense de suggestion est un gain : elle débloque aussi les zigollars de bienvenue
create or replace function _points_add(p_user uuid, p_delta bigint, p_reason text, p_kind text, p_ref uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare b point_balances;
begin
  insert into point_balances(user_id, balance) values (p_user, 0) on conflict do nothing;
  select * into b from point_balances where user_id = p_user for update;
  if p_delta < 0 and p_kind <> 'admin' and b.balance - b.locked < -p_delta then
    if b.balance >= -p_delta then raise exception 'Tes zigollars de bienvenue sont verrouillés : ils se débloquent à ton premier gain (victoire en duel, Warm-up Race…).'; end if;
    raise exception 'Solde de zigollars insuffisant.';
  end if;
  if b.balance + p_delta < 0 then raise exception 'Solde de zigollars insuffisant.'; end if;
  update point_balances set
    balance = balance + p_delta,
    locked  = case
      when p_kind = 'welcome' then locked + p_delta
      when p_delta > 0 and p_kind in ('duel_win', 'warmup', 'bet_win', 'admin', 'suggestion') then 0
      else least(locked, balance + p_delta) end
  where user_id = p_user;
  insert into point_ledger(user_id, delta, reason, kind, ref) values (p_user, p_delta, p_reason, p_kind, p_ref);
end $$;
revoke execute on function _points_add(uuid, bigint, text, text, uuid) from public, anon, authenticated;

create or replace function admin_handle_suggestion(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s course_suggestions; amount bigint := coalesce((setting('suggestion_reward_zigollars') #>> '{}')::bigint, 0);
begin
  perform _require_admin(); perform _lock();
  if p_status not in ('accepted','declined') then raise exception 'Statut invalide.'; end if;
  select * into s from course_suggestions where id = p_id for update;
  if s.id is null then raise exception 'Suggestion introuvable.'; end if;
  if s.status <> 'pending' then raise exception 'Cette suggestion est déjà traitée.'; end if;
  update course_suggestions set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), handled_by = auth.uid(), handled_at = now() where id = s.id;
  perform _log('suggestion:' || p_status, 'course_suggestion', s.id::text, jsonb_build_object('note', p_note, 'zigollars', case when p_status = 'accepted' then amount end));
  if p_status = 'accepted' and amount > 0 then
    perform _points_add(s.user_id, amount, 'Suggestion retenue : ' || left(s.name, 60), 'suggestion', s.id);
    perform _notify(s.user_id, 'suggestion', 'Your course suggestion has been accepted', left(s.name, 80) || ' — +' || amount || ' zigollars', '/suggestion');
  else
    perform _notify(s.user_id, 'suggestion', 'Your course suggestion has been reviewed', left(s.name, 80) || ' — ' || p_status, '/suggestion');
  end if;
end $$;
revoke execute on function admin_handle_suggestion(uuid, text, text) from public, anon;
grant execute on function admin_handle_suggestion(uuid, text, text) to authenticated;

-- ===== 2. Rappels 1 h aussi pour les parieurs ; récap complet du pari après la course =====
create or replace function duel_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare c record; n int := 0; tz text := setting('timezone') #>> '{}'; at_txt text; bt record; label text;
begin
  if auth.uid() is null then return 0; end if;
  for c in
    select * from challenges ch
    where status = 'scheduled' and scheduled_at > now() and scheduled_at <= now() + interval '24 hours'
      and (reminded_24h_at is null or (reminded_1h_at is null and scheduled_at <= now() + interval '1 hour'))
      and (is_admin() or auth.uid() in (challenger_id, defender_id)
           or exists (select 1 from duel_bets b where b.challenge_id = ch.id and b.user_id = auth.uid()))
    for update
  loop
    at_txt := to_char(c.scheduled_at at time zone tz, 'DD/MM HH24:MI');
    label := _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || at_txt;
    if c.scheduled_at <= now() + interval '1 hour' then
      if c.reminded_1h_at is null then
        update challenges set reminded_1h_at = now(), reminded_24h_at = coalesce(reminded_24h_at, now()) where id = c.id;
        perform _notify(c.challenger_id, 'duel_reminder', 'Your duel starts in 1 hour', label, '/challenges');
        perform _notify(c.defender_id,   'duel_reminder', 'Your duel starts in 1 hour', label, '/challenges');
        for bt in select distinct user_id from duel_bets where challenge_id = c.id and status = 'open' loop
          perform _notify(bt.user_id, 'duel_reminder', 'A duel you bet on starts in 1 hour', label, '/boutique?tab=paris');
        end loop;
        n := n + 1;
      end if;
    elsif c.reminded_24h_at is null then
      update challenges set reminded_24h_at = now() where id = c.id;
      perform _notify(c.challenger_id, 'duel_reminder', 'Your duel starts in 24 hours', label, '/challenges');
      perform _notify(c.defender_id,   'duel_reminder', 'Your duel starts in 24 hours', label, '/challenges');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function duel_reminders() from public, anon;
grant execute on function duel_reminders() to authenticated;

create or replace function _settle_bets() returns trigger
language plpgsql security definer set search_path = public as $$
declare b duel_bets; win text; pay bigint; duel text;
begin
  if new.status = old.status then return new; end if;
  duel := _name(new.challenger_id) || ' vs ' || _name(new.defender_id);
  if new.status in ('completed','forfeited') and new.winner_id is not null then
    win := case when new.winner_id = new.challenger_id then 'challenger' else 'defender' end;
    for b in select * from duel_bets where challenge_id = new.id and status = 'open' loop
      if b.side = win then
        pay := floor(b.stake * b.odds);
        perform _points_add(b.user_id, pay, 'Pari gagné : ' || duel, 'bet_win', b.id);
        update duel_bets set status = 'won', payout = pay, settled_at = now() where id = b.id;
        perform _notify(b.user_id, 'bet', 'You won your bet', duel || ' · odds x' || to_char(b.odds, 'FM990.00') || ' · +' || (pay - b.stake) || ' zigollars', '/boutique?tab=paris');
      else
        update duel_bets set status = 'lost', settled_at = now() where id = b.id;
        perform _notify(b.user_id, 'bet', 'You lost your bet', duel || ' · odds x' || to_char(b.odds, 'FM990.00') || ' · -' || b.stake || ' zigollars', '/boutique?tab=paris');
      end if;
    end loop;
  elsif new.status = 'cancelled' then
    for b in select * from duel_bets where challenge_id = new.id and status = 'open' loop
      perform _points_add(b.user_id, b.stake, 'Pari remboursé (duel annulé)', 'bet_refund', b.id);
      update duel_bets set status = 'refunded', payout = b.stake, settled_at = now() where id = b.id;
      perform _notify(b.user_id, 'bet', 'Your bet has been refunded', duel || ' · +' || b.stake || ' zigollars', '/boutique?tab=paris');
    end loop;
  end if;
  return new;
end $$;

-- ===== 3. Activité du compte observateur (visible du staff uniquement) =====
create table if not exists observer_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('login','bet','order')),
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists observer_events_user_idx on observer_events (user_id, created_at desc);
alter table observer_events enable row level security;
create policy observer_events_read on observer_events for select using (is_admin());
revoke all on observer_events from anon, authenticated;
grant select on observer_events to authenticated;

create or replace function _observer_trace() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := new.user_id; txt text;
begin
  if not exists (select 1 from profiles where id = who and is_observer) then return new; end if;
  if tg_table_name = 'duel_bets' then
    select _name(c.challenger_id) || ' vs ' || _name(c.defender_id) into txt from challenges c where c.id = new.challenge_id;
    insert into observer_events(user_id, kind, detail) values (who, 'bet', txt || ' · ' || new.side || ' · ' || new.stake || ' zigollars (cote x' || to_char(new.odds, 'FM990.00') || ')');
  else
    insert into observer_events(user_id, kind, detail) values (who, 'order', new.item_name || ' · ' || new.price || ' zigollars');
  end if;
  return new;
end $$;
create trigger duel_bets_observer_trace  after insert on duel_bets  for each row execute function _observer_trace();
create trigger shop_orders_observer_trace after insert on shop_orders for each row execute function _observer_trace();

-- Connexion : appelée par le site après une connexion réussie (sans effet pour un compte ordinaire, une trace par 10 minutes au plus)
create or replace function log_observer_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid() and is_observer) then return; end if;
  if exists (select 1 from observer_events where user_id = auth.uid() and kind = 'login' and created_at > now() - interval '10 minutes') then return; end if;
  insert into observer_events(user_id, kind, detail) values (auth.uid(), 'login', null);
end $$;
revoke execute on function log_observer_login() from public, anon;
grant execute on function log_observer_login() to authenticated;

-- ===== 4. Articles en édition limitée (durée) =====
alter table shop_items add column if not exists ends_at timestamptz;
alter table shop_items add column if not exists limited boolean not null default false;
drop policy if exists shop_items_read on shop_items;
create policy shop_items_read on shop_items for select using ((active and (ends_at is null or ends_at > now())) or is_admin());

create or replace function shop_buy(p_item uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it shop_items; v_id uuid;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  perform _lock();
  select * into it from shop_items where id = p_item for update;
  if it.id is null or not it.active then raise exception 'Article indisponible.'; end if;
  if it.ends_at is not null and it.ends_at <= now() then raise exception 'Cette édition limitée est terminée.'; end if;
  if it.stock is not null and it.stock <= 0 then raise exception 'Article épuisé.'; end if;
  perform _points_add(me, -it.price, 'Boutique : ' || it.name, 'shop');
  if it.stock is not null then update shop_items set stock = stock - 1 where id = it.id; end if;
  insert into shop_orders(user_id, item_id, item_name, price) values (me, it.id, it.name, it.price) returning id into v_id;
  update point_ledger set ref = v_id where id = (select id from point_ledger where user_id = me and kind = 'shop' order by created_at desc limit 1);
  perform _notify_admins('shop_order', 'New shop order', _name(me) || ' — ' || it.name, '/admin/shop');
  return v_id;
end $$;
revoke execute on function shop_buy(uuid) from public, anon;
grant execute on function shop_buy(uuid) to authenticated;
