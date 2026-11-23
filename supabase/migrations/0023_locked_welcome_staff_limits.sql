-- 0023 : les zigollars de bienvenue sont verrouillés jusqu'au premier gain ; plus de plafond sur les montants saisis par l'organisation ; brouillons de circuits sans limite de points.

-- ===== Zigollars de bienvenue verrouillés =====
alter table point_balances add column if not exists locked bigint not null default 0 check (locked >= 0);

create or replace function _points_add(p_user uuid, p_delta bigint, p_reason text, p_kind text, p_ref uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare b point_balances;
begin
  insert into point_balances(user_id, balance) values (p_user, 0) on conflict do nothing;
  select * into b from point_balances where user_id = p_user for update;
  -- dépense : seuls les zigollars « disponibles » (solde - verrouillés) se dépensent ; l'organisation (kind 'admin') n'est pas concernée
  if p_delta < 0 and p_kind <> 'admin' and b.balance - b.locked < -p_delta then
    if b.balance >= -p_delta then raise exception 'Tes zigollars de bienvenue sont verrouillés : ils se débloquent à ton premier gain (victoire en duel, Warm-up Race…).'; end if;
    raise exception 'Solde de zigollars insuffisant.';
  end if;
  if b.balance + p_delta < 0 then raise exception 'Solde de zigollars insuffisant.'; end if;
  update point_balances set
    balance = balance + p_delta,
    locked  = case
      when p_kind = 'welcome' then locked + p_delta                                                          -- bonus d'inscription : verrouillé
      when p_delta > 0 and p_kind in ('duel_win', 'warmup', 'bet_win', 'admin') then 0                        -- premier gain : tout se débloque
      else least(locked, balance + p_delta) end
  where user_id = p_user;
  insert into point_ledger(user_id, delta, reason, kind, ref) values (p_user, p_delta, p_reason, p_kind, p_ref);
end $$;
revoke execute on function _points_add(uuid, bigint, text, text, uuid) from public, anon, authenticated;

-- Comptes existants : le bonus de bienvenue reste verrouillé tant qu'aucun gain n'a été enregistré
update point_balances b set locked = least(10000, b.balance)
where exists (select 1 from point_ledger l where l.user_id = b.user_id and l.kind = 'welcome')
  and not exists (select 1 from point_ledger l where l.user_id = b.user_id and (l.kind in ('duel_win', 'warmup', 'bet_win') or (l.kind = 'admin' and l.delta > 0)));

-- ===== Plus de plafond pour l'organisation =====
create or replace function admin_grant_points(p_user uuid, p_delta bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(); perform _lock();
  if p_delta = 0 or abs(p_delta) > 9000000000000000 then raise exception 'Montant invalide.'; end if;
  if char_length(coalesce(p_reason, '')) < 3 then raise exception 'Un motif est requis.'; end if;
  perform _points_add(p_user, p_delta, p_reason, 'admin');
  perform _log('points:grant', 'profile', p_user::text, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  perform _notify(p_user, 'points', case when p_delta > 0 then 'Zigollars added to your balance' else 'Zigollars removed from your balance' end, p_reason, '/boutique?tab=historique');
end $$;

alter table shop_items drop constraint if exists shop_items_price_check;
alter table shop_items add constraint shop_items_price_check check (price > 0 and price <= 9000000000000000);

-- ===== Brouillons : points de passage sans limite pratique =====
alter table track_drafts drop constraint if exists track_drafts_points_check;
alter table track_drafts add constraint track_drafts_points_check check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) <= 100000);
