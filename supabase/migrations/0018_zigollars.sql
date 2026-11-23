-- 0018 : la monnaie du site devient le « zigollar » (textes envoyés par la base : notifications et erreurs).

create or replace function _points_add(p_user uuid, p_delta bigint, p_reason text, p_kind text, p_ref uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into point_balances(user_id, balance) values (p_user, 0) on conflict do nothing;
  begin
    update point_balances set balance = balance + p_delta where user_id = p_user;
  exception when check_violation then
    raise exception 'Solde de zigollars insuffisant.';
  end;
  insert into point_ledger(user_id, delta, reason, kind, ref) values (p_user, p_delta, p_reason, p_kind, p_ref);
end $$;

create or replace function admin_grant_points(p_user uuid, p_delta bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(); perform _lock();
  if p_delta = 0 or abs(p_delta) > 1000000 then raise exception 'Montant invalide.'; end if;
  if char_length(coalesce(p_reason, '')) < 3 then raise exception 'Un motif est requis.'; end if;
  perform _points_add(p_user, p_delta, p_reason, 'admin');
  perform _log('points:grant', 'profile', p_user::text, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  perform _notify(p_user, 'points', case when p_delta > 0 then 'Zigollars added to your balance' else 'Zigollars removed from your balance' end, p_reason, '/boutique?tab=historique');
end $$;

create or replace function place_bet(p_challenge uuid, p_side text, p_stake bigint) returns numeric
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c challenges; o record; v_odds numeric; v_id uuid;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_side not in ('challenger','defender') then raise exception 'Choix invalide.'; end if;
  if p_stake is null or p_stake < 500 or p_stake > 50000 or p_stake % 500 <> 0 then raise exception 'La mise doit être un montant rond (multiple de 500) compris entre 500 et 50 000 zigollars.'; end if;
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
        perform _notify(b.user_id, 'bet', 'You won your bet', '+' || pay || ' zigollars', '/boutique?tab=paris');
      else
        update duel_bets set status = 'lost', settled_at = now() where id = b.id;
        perform _notify(b.user_id, 'bet', 'You lost your bet', '-' || b.stake || ' zigollars', '/boutique?tab=paris');
      end if;
    end loop;
  elsif new.status = 'cancelled' then
    for b in select * from duel_bets where challenge_id = new.id and status = 'open' loop
      perform _points_add(b.user_id, b.stake, 'Pari remboursé (duel annulé)', 'bet_refund', b.id);
      update duel_bets set status = 'refunded', payout = b.stake, settled_at = now() where id = b.id;
      perform _notify(b.user_id, 'bet', 'Your bet has been refunded', '+' || b.stake || ' zigollars', '/boutique?tab=paris');
    end loop;
  end if;
  return new;
end $$;
