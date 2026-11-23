-- 0016 : points, boutique, paris à cotes, créneaux proposés, choix des cartes, stats du Hall of Fame.

-- ===== 1. Nettoyage : circuit de test retiré =====
delete from race_tracks where name = 'Winewood Sprint' and route_path is null;

-- ===== 2. Points : solde + historique (toute écriture passe par _points_add) =====
create table point_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0)
);
create table point_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      bigint not null,
  reason     text not null,
  kind       text not null,          -- welcome | bet_stake | bet_win | bet_refund | shop | shop_refund | admin
  ref        uuid,
  created_at timestamptz not null default now()
);
create index on point_ledger(user_id, created_at desc);
create unique index point_welcome_once on point_ledger(user_id) where kind = 'welcome';

alter table point_balances enable row level security;
alter table point_ledger   enable row level security;
create policy balance_own_read on point_balances for select using (user_id = auth.uid() or is_admin());
create policy ledger_own_read  on point_ledger   for select using (user_id = auth.uid() or is_admin());
revoke all on point_balances, point_ledger from anon, authenticated;
grant select on point_balances, point_ledger to authenticated;

create or replace function _points_add(p_user uuid, p_delta bigint, p_reason text, p_kind text, p_ref uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into point_balances(user_id, balance) values (p_user, 0) on conflict do nothing;
  begin
    update point_balances set balance = balance + p_delta where user_id = p_user;
  exception when check_violation then
    raise exception 'Solde de points insuffisant.';
  end;
  insert into point_ledger(user_id, delta, reason, kind, ref) values (p_user, p_delta, p_reason, p_kind, p_ref);
end $$;
revoke execute on function _points_add(uuid, bigint, text, text, uuid) from public, anon, authenticated;

-- 10 000 points offerts à chaque inscription
create or replace function _welcome_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _points_add(new.id, 10000, 'Bonus de bienvenue', 'welcome');
  return new;
end $$;
create trigger profiles_welcome_points after insert on profiles for each row execute function _welcome_points();
select _points_add(p.id, 10000, 'Bonus de bienvenue', 'welcome') from profiles p
where not exists (select 1 from point_ledger l where l.user_id = p.id and l.kind = 'welcome');

create or replace function admin_grant_points(p_user uuid, p_delta bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(); perform _lock();
  if p_delta = 0 or abs(p_delta) > 1000000 then raise exception 'Montant invalide.'; end if;
  if char_length(coalesce(p_reason, '')) < 3 then raise exception 'Un motif est requis.'; end if;
  perform _points_add(p_user, p_delta, p_reason, 'admin');
  perform _log('points:grant', 'profile', p_user::text, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  perform _notify(p_user, 'points', case when p_delta > 0 then 'Points added to your balance' else 'Points removed from your balance' end, p_reason, '/boutique?tab=historique');
end $$;
revoke execute on function admin_grant_points(uuid, bigint, text) from public, anon;
grant execute on function admin_grant_points(uuid, bigint, text) to authenticated;

-- ===== 3. Boutique =====
create table shop_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 300),
  category    text not null default 'Divers' check (char_length(category) between 2 and 40),
  price       bigint not null check (price > 0 and price <= 1000000),
  stock       int check (stock is null or stock >= 0),          -- null = illimité
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create table shop_orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    uuid references shop_items(id) on delete set null,
  item_name  text not null,
  price      bigint not null,
  status     text not null default 'pending' check (status in ('pending','delivered','cancelled')),
  note       text,
  created_at timestamptz not null default now(),
  handled_by uuid,
  handled_at timestamptz
);
create index on shop_orders(status, created_at desc);
create index on shop_orders(user_id, created_at desc);
alter table shop_items  enable row level security;
alter table shop_orders enable row level security;
create policy shop_items_read  on shop_items for select using (active or is_admin());
create policy shop_items_admin on shop_items for all using (is_admin()) with check (is_admin());
create policy shop_orders_read on shop_orders for select using (user_id = auth.uid() or is_admin());
revoke all on shop_items, shop_orders from anon, authenticated;
grant select on shop_items to anon, authenticated;
grant insert, update, delete on shop_items to authenticated;      -- limité aux organisateurs par la RLS
grant select on shop_orders to authenticated;
create trigger audit_shop_items after insert or update or delete on shop_items for each row execute function audit_changes();

create or replace function shop_buy(p_item uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it shop_items; v_id uuid;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  perform _lock();
  select * into it from shop_items where id = p_item for update;
  if it.id is null or not it.active then raise exception 'Article indisponible.'; end if;
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

create or replace function admin_shop_order(p_order uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o shop_orders;
begin
  perform _require_admin(); perform _lock();
  if p_status not in ('delivered','cancelled') then raise exception 'Statut invalide.'; end if;
  select * into o from shop_orders where id = p_order for update;
  if o.id is null then raise exception 'Commande introuvable.'; end if;
  if o.status <> 'pending' then raise exception 'Cette commande est déjà traitée.'; end if;
  update shop_orders set status = p_status, note = nullif(p_note, ''), handled_by = auth.uid(), handled_at = now() where id = o.id;
  if p_status = 'cancelled' then
    perform _points_add(o.user_id, o.price, 'Remboursement : ' || o.item_name, 'shop_refund', o.id);
    if o.item_id is not null then update shop_items set stock = stock + 1 where id = o.item_id and stock is not null; end if;
    perform _notify(o.user_id, 'shop', 'Your order has been cancelled and refunded', o.item_name || coalesce(' — ' || nullif(p_note, ''), ''), '/boutique?tab=historique');
  else
    perform _notify(o.user_id, 'shop', 'Your order has been delivered', o.item_name, '/boutique?tab=historique');
  end if;
  perform _log('shop:' || p_status, 'shop_order', o.id::text, jsonb_build_object('item', o.item_name, 'note', p_note));
end $$;
revoke execute on function admin_shop_order(uuid, text, text) from public, anon;
grant execute on function admin_shop_order(uuid, text, text) to authenticated;

insert into shop_items (name, description, category, price, sort) values
  ('Fusée de détresse',   'Signale ta position quand tout part de travers.',            'Accessoires',    500, 10),
  ('Jerrican d''essence', 'Ne tombe plus jamais en panne sèche.',                       'Accessoires',    400, 20),
  ('Kit de réparation',   'Remets ta caisse en état entre deux courses.',               'Accessoires',  1000, 30),
  ('Trousse de soins',    'De quoi te remettre d''aplomb après un accrochage.',         'Accessoires',   800, 40),
  ('Couteau',             'Arme blanche discrète, toujours utile.',                     'Armes blanches',1500, 50),
  ('Pied-de-biche',       'Arme blanche : simple, efficace, sans fioritures.',          'Armes blanches',1500, 60),
  ('Batte de baseball',   'Arme blanche : pour convaincre sans élever la voix.',        'Armes blanches',1800, 70),
  ('Gilet pare-balles',   'Protection légère pour les soirées qui tournent mal.',       'Protection',    3000, 80),
  ('Pétoire',             'Un petit pistolet de poche. Le dernier recours.',            'Armes',         4000, 90);

-- ===== 4. Paris à cotes =====
create table duel_bets (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  side         text not null check (side in ('challenger','defender')),
  stake        bigint not null check (stake between 500 and 50000 and stake % 500 = 0),
  odds         numeric(5,2) not null check (odds >= 1.01),
  status       text not null default 'open' check (status in ('open','won','lost','refunded')),
  payout       bigint not null default 0,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  unique (challenge_id, user_id)
);
create index on duel_bets(user_id, created_at desc);
alter table duel_bets enable row level security;
create policy bets_own_read on duel_bets for select using (user_id = auth.uid() or is_admin());
revoke all on duel_bets from anon, authenticated;
grant select on duel_bets to authenticated;

-- Cotes : force de chaque pilote (bilan lissé) + léger avantage au défié (placé juste au-dessus), marge de 8 %
create or replace function duel_odds(p_challenge uuid) returns table (challenger_odds numeric, defender_odds numeric)
language plpgsql stable security definer set search_path = public as $$
declare c challenges; wc int; lc int; wd int; ld int; sc numeric; sd numeric; edge numeric; pd numeric;
begin
  select * into c from challenges where id = p_challenge;
  if c.id is null then return; end if;
  select count(*) filter (where winner_id = c.challenger_id), count(*) filter (where winner_id <> c.challenger_id) into wc, lc
    from challenges where c.challenger_id in (challenger_id, defender_id) and status in ('completed','forfeited') and winner_id is not null;
  select count(*) filter (where winner_id = c.defender_id), count(*) filter (where winner_id <> c.defender_id) into wd, ld
    from challenges where c.defender_id in (challenger_id, defender_id) and status in ('completed','forfeited') and winner_id is not null;
  sc := (wc + 1)::numeric / (wc + lc + 2);
  sd := (wd + 1)::numeric / (wd + ld + 2);
  edge := case when c.is_podium then 1.15 else 1.10 end;
  pd := (sd * edge) / (sd * edge + sc);
  challenger_odds := round(least(6, greatest(1.15, 0.92 / (1 - pd))), 2);
  defender_odds   := round(least(6, greatest(1.15, 0.92 / pd)), 2);
  return next;
end $$;
revoke execute on function duel_odds(uuid) from public;
grant execute on function duel_odds(uuid) to anon, authenticated;

create or replace function place_bet(p_challenge uuid, p_side text, p_stake bigint) returns numeric
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c challenges; o record; v_odds numeric; v_id uuid;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_side not in ('challenger','defender') then raise exception 'Choix invalide.'; end if;
  if p_stake is null or p_stake < 500 or p_stake > 50000 or p_stake % 500 <> 0 then raise exception 'La mise doit être un montant rond (multiple de 500) compris entre 500 et 50 000 points.'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null or c.status <> 'scheduled' or c.scheduled_at is null or c.scheduled_at <= now() then raise exception 'Les paris sont fermés pour ce duel.'; end if;
  if me in (c.challenger_id, c.defender_id) then raise exception 'Tu ne peux pas parier sur ton propre duel.'; end if;
  if exists (select 1 from duel_bets where challenge_id = c.id and user_id = me) then raise exception 'Tu as déjà parié sur ce duel.'; end if;
  select * into o from duel_odds(c.id);
  v_odds := case when p_side = 'challenger' then o.challenger_odds else o.defender_odds end;
  insert into duel_bets(challenge_id, user_id, side, stake, odds) values (c.id, me, p_side, p_stake, v_odds) returning id into v_id;
  perform _points_add(me, -p_stake, 'Pari : ' || _name(c.challenger_id) || ' vs ' || _name(c.defender_id), 'bet_stake', v_id);
  return v_odds;
end $$;
revoke execute on function place_bet(uuid, text, bigint) from public, anon;
grant execute on function place_bet(uuid, text, bigint) to authenticated;

-- Règlement automatique dès que le résultat est validé (jamais avant) ; remboursement si le duel est annulé
create or replace function _settle_bets() returns trigger
language plpgsql security definer set search_path = public as $$
declare b duel_bets; win text; pay bigint;
begin
  if new.status = old.status then return new; end if;
  if new.status in ('completed','forfeited') and new.winner_id is not null then
    win := case when new.winner_id = new.challenger_id then 'challenger' else 'defender' end;
    for b in select * from duel_bets where challenge_id = new.id and status = 'open' loop
      if b.side = win then
        pay := floor(b.stake * b.odds);
        perform _points_add(b.user_id, pay, 'Pari gagné : ' || _name(new.challenger_id) || ' vs ' || _name(new.defender_id), 'bet_win', b.id);
        update duel_bets set status = 'won', payout = pay, settled_at = now() where id = b.id;
        perform _notify(b.user_id, 'bet', 'You won your bet', '+' || pay || ' pts', '/boutique?tab=paris');
      else
        update duel_bets set status = 'lost', settled_at = now() where id = b.id;
        perform _notify(b.user_id, 'bet', 'You lost your bet', '-' || b.stake || ' pts', '/boutique?tab=paris');
      end if;
    end loop;
  elsif new.status = 'cancelled' then
    for b in select * from duel_bets where challenge_id = new.id and status = 'open' loop
      perform _points_add(b.user_id, b.stake, 'Pari remboursé (duel annulé)', 'bet_refund', b.id);
      update duel_bets set status = 'refunded', payout = b.stake, settled_at = now() where id = b.id;
      perform _notify(b.user_id, 'bet', 'Your bet has been refunded', '+' || b.stake || ' pts', '/boutique?tab=paris');
    end loop;
  end if;
  return new;
end $$;
create trigger challenges_settle_bets after update of status on challenges for each row execute function _settle_bets();

-- ===== 5. Créneaux proposés par le challenger (entre 21 h et 00 h, heure de Paris) =====
create table challenge_slots (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  starts_at    timestamptz not null,
  unique (challenge_id, starts_at)
);
alter table challenge_slots enable row level security;
create policy slots_read on challenge_slots for select using (
  is_admin() or exists (select 1 from challenges c where c.id = challenge_id and auth.uid() in (c.challenger_id, c.defender_id)));
revoke all on challenge_slots from anon, authenticated;
grant select on challenge_slots to authenticated;

create or replace function _slot_ok(p_at timestamptz) returns boolean
language sql stable as $$
  select (p_at at time zone (setting('timezone') #>> '{}'))::time between time '21:00' and time '23:30'
$$;

alter table challenge_races drop constraint challenge_races_chosen_by_check;
alter table challenge_races add constraint challenge_races_chosen_by_check check (chosen_by in ('organisation','champion','challenger','random'));

drop function create_challenge(uuid);
create or replace function create_challenge(p_target uuid, p_slots timestamptz[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mypos int; tpos int; err text; v_id uuid; v_podium boolean; v_hours int; v_per_week int; ws date;
        tz text := setting('timezone') #>> '{}'; week_end timestamptz; s timestamptz;
begin
  if me is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
  perform _lock();
  mypos := _rank_of(me);
  if mypos is null then raise exception 'Seuls les pilotes de la Blacklist peuvent lancer un défi.'; end if;
  if mypos = 1 then raise exception 'Le #1 n''a personne à défier.'; end if;
  tpos := _rank_of(p_target);
  if tpos is null or tpos <> mypos - 1 then raise exception 'Tu ne peux défier que le pilote directement au-dessus de toi (#%).', mypos - 1; end if;

  err := _driver_ready(me);        if err is not null then raise exception '%', err; end if;
  err := _driver_ready(p_target);  if err is not null then raise exception '%', err; end if;

  if exists(select 1 from challenges where status in ('awaiting_schedule','scheduled','awaiting_validation')
            and (me in (challenger_id, defender_id) or p_target in (challenger_id, defender_id))) then
    raise exception 'Un défi est déjà en cours pour l''un des deux pilotes.';
  end if;

  ws := _week_start();
  v_per_week := (setting('challenges_per_week'))::int;
  if (select count(*) from challenges where challenger_id = me and week_start = ws and counts_for_week) >= v_per_week then
    raise exception 'Tu as déjà utilisé ton défi de la semaine.';
  end if;

  if p_slots is not null then
    if coalesce(array_length(p_slots, 1), 0) <> 3 or (select count(distinct x) from unnest(p_slots) x) <> 3 then raise exception 'Propose exactement 3 créneaux différents.'; end if;
    week_end := ((ws + 7)::timestamp) at time zone tz;
    foreach s in array p_slots loop
      if s <= now() then raise exception 'Chaque créneau doit être dans le futur.'; end if;
      if s >= week_end then raise exception 'Chaque créneau doit tomber dans la semaine en cours (avant le %).', to_char(ws + 6, 'DD/MM'); end if;
      if not _slot_ok(s) then raise exception 'Les créneaux doivent commencer entre 21 h 00 et 23 h 30 (heure de Paris).'; end if;
    end loop;
  end if;

  v_hours  := (setting('challenge_response_hours'))::int;
  v_podium := tpos <= (setting('podium_size'))::int;
  insert into challenges(challenger_id, defender_id, challenger_position, defender_position, is_podium, week_start, respond_by)
  values (me, p_target, mypos, tpos, v_podium, ws, now() + make_interval(hours => v_hours)) returning id into v_id;

  if p_slots is not null then insert into challenge_slots(challenge_id, starts_at) select v_id, unnest(p_slots); end if;

  -- Podium : 1 carte choisie par le challenger, 1 par le défié, 1 tirée au sort. Duel standard : la carte est choisie par le défié.
  if v_podium then
    insert into challenge_races(challenge_id, race_no, kind, chosen_by) values
      (v_id,1,'sprint','challenger'),(v_id,2,'sprint','champion'),(v_id,3,'last_race','random');
  else
    insert into challenge_races(challenge_id, race_no, kind, chosen_by) values (v_id,1,'standard','champion');
  end if;

  perform _notify(p_target, 'challenge_new', 'A new challenge has been issued',
    _name(me) || ' (#' || mypos || ') challenges you.', '/challenges');
  perform _notify(p_target, 'challenge_deadline', 'You have ' || v_hours || ' hours to schedule your duel',
    'Set a duel date within the current week before the deadline.', '/challenges');
  perform _notify(me, 'challenge_sent', 'Challenge sent', 'Your challenge against ' || _name(p_target) || ' is live.', '/challenges');
  perform _notify_admins('challenge_new', 'New challenge', _name(me) || ' → ' || _name(p_target), '/admin/challenges');
  update profiles set last_activity_at = now() where id = me;
  return v_id;
end $$;
revoke execute on function create_challenge(uuid, timestamptz[]) from public, anon;
grant execute on function create_challenge(uuid, timestamptz[]) to authenticated;

-- Le défié choisit parmi les créneaux proposés (s'il y en a)
create or replace function schedule_challenge(p_challenge uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges; week_end timestamptz; tz text := setting('timezone') #>> '{}';
begin
  perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null then raise exception 'Défi introuvable.'; end if;
  if auth.uid() is distinct from c.defender_id then raise exception 'Seul le pilote défié fixe la date du duel.' using errcode='42501'; end if;
  if c.status <> 'awaiting_schedule' then raise exception 'La date de ce défi est déjà fixée ou le défi est clos.'; end if;
  if now() > c.respond_by then raise exception 'Le délai est dépassé : contacte l''organisation.'; end if;
  if p_at <= now() then raise exception 'La date doit être dans le futur.'; end if;
  if exists (select 1 from challenge_slots where challenge_id = c.id) and not exists (select 1 from challenge_slots where challenge_id = c.id and starts_at = p_at) then
    raise exception 'Choisis l''un des créneaux proposés par le challenger.';
  end if;
  week_end := ((c.week_start + 7)::timestamp) at time zone tz;
  if p_at >= week_end then raise exception 'Le duel doit avoir lieu dans la semaine en cours (avant le %).', to_char((c.week_start + 6), 'DD/MM'); end if;
  update challenges set scheduled_at = p_at, scheduled_by = auth.uid(), status = 'scheduled' where id = c.id;
  perform _notify(c.defender_id,   'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/challenges');
  perform _notify(c.challenger_id, 'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/challenges');
  perform _notify_admins('challenge_scheduled', 'Duel scheduled', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/admin/challenges');
  update profiles set last_activity_at = now() where id = auth.uid();
end $$;

-- ===== 6. Choix des cartes une fois la date validée ; 3e carte du podium tirée au sort =====
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

  -- 3e carte du podium : tirée au sort dès que les deux autres sont connues (de préférence une carte différente)
  select track_id into t1 from challenge_races where challenge_id = c.id and race_no = 1;
  select track_id into t2 from challenge_races where challenge_id = c.id and race_no = 2;
  select * into r3 from challenge_races where challenge_id = c.id and race_no = 3 and chosen_by = 'random' and track_id is null;
  if r3.id is not null and t1 is not null and t2 is not null then
    select id into pick from race_tracks where status = 'active' and id not in (t1, t2) order by random() limit 1;
    if pick is null then select id into pick from race_tracks where status = 'active' order by random() limit 1; end if;
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

-- ===== 7. Hall of Fame : résultats course par course (duels validés) =====
create or replace view public_race_results as
select c.id as challenge_id, cr.race_no, rr.winner_id, c.challenger_id, c.defender_id, rr.recorded_at
from race_results rr
join challenge_races cr on cr.id = rr.challenge_race_id
join challenges c on c.id = cr.challenge_id
where c.status in ('completed','forfeited');
revoke all on public_race_results from anon, authenticated;
grant select on public_race_results to anon, authenticated;
