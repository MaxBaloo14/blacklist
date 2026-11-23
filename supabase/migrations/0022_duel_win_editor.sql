-- 0022 : zigollars pour chaque duel gagné, brouillons et retouche des circuits dans l'éditeur.

insert into settings(key, value, description) values
  ('duel_win_zigollars', '2500', 'Zigollars offerts au vainqueur d''un duel disputé (pas pour un forfait), versés à la validation du résultat')
on conflict (key) do nothing;
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (key in ('rewards','inactivity_days','challenge_response_hours','vehicle_classes','forbidden_vehicle_classes','podium_size','challenges_per_week','warmup_participation_zigollars','map_scale_m_per_px','duel_win_zigollars') or is_admin());
create unique index if not exists point_duel_win_once on point_ledger(user_id, ref) where kind = 'duel_win';

create or replace function _resolve_challenge(p_challenge uuid, p_winner uuid, p_clip text, p_forfeit boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges; arr uuid[]; loser uuid; amount bigint; scope text := setting('vehicle_loss_scope') #>> '{}';
        cd int; cc int; make_reward boolean; wz bigint := coalesce((setting('duel_win_zigollars'))::bigint, 2500);
begin
  select * into c from challenges where id = p_challenge for update;
  loser := case when p_winner = c.challenger_id then c.defender_id else c.challenger_id end;

  -- cohérence : les positions doivent être inchangées depuis la création du défi
  if _rank_of(c.challenger_id) is distinct from c.challenger_position or _rank_of(c.defender_id) is distinct from c.defender_position then
    raise exception 'Le classement a changé depuis la création du défi : annule-le ou rétablis les positions.';
  end if;

  if p_winner = c.challenger_id then
    arr := _ranking_array();
    arr[c.defender_position]   := c.challenger_id;
    arr[c.challenger_position] := c.defender_id;
    perform _write_ranking(arr, 'duel', 'Duel #' || left(c.id::text,8), c.id);

    make_reward := (not p_forfeit) or (setting('forfeit_gives_reward'))::boolean;
    if make_reward then
      amount := ((setting('rewards')) ->> c.defender_position::text)::bigint;
      insert into rewards(challenge_id, driver_id, rank_beaten, amount, clip_url)
      values (c.id, c.challenger_id, c.defender_position, amount, p_clip);
      perform _notify(c.challenger_id, 'reward', 'You have received a Cash Prize', 'Prize for beating #' || c.defender_position || ' : $' || amount, '/profile?tab=rewards');
      perform _notify_admins('reward_pending', 'Cash Prize to pay', _name(c.challenger_id) || ' — $' || amount, '/admin/rewards');
    end if;
  end if;

  -- Perte du véhicule du podium
  cd := c.defender_position; cc := c.challenger_position;
  if p_winner = c.challenger_id and cd <= (setting('podium_size'))::int then
    perform _lose_vehicle(c.defender_id, 'Lost the podium duel against ' || _name(c.challenger_id));
  end if;
  if p_winner = c.defender_id and scope = 'both' and cc <= (setting('podium_size'))::int then
    perform _lose_vehicle(c.challenger_id, 'Lost the podium duel against ' || _name(c.defender_id));
  end if;

  update challenges set winner_id = p_winner, validated_by = auth.uid(), validated_at = now(), clip_url = coalesce(p_clip, clip_url),
         status = case when p_forfeit then 'forfeited'::challenge_status else 'completed'::challenge_status end,
         forfeit_by_id = case when p_forfeit then loser end where id = c.id;
  update profiles set last_duel_at = now(), inactivity_alerted_at = null where id in (c.challenger_id, c.defender_id);

  -- zigollars offerts au vainqueur d'un duel disputé (pas pour un forfait), une seule fois par duel
  if not p_forfeit and wz > 0 then
    perform _points_add(p_winner, wz, 'Victoire en duel', 'duel_win', c.id);
    perform _notify(p_winner, 'points', 'You earned zigollars for your victory', '+' || wz || ' zigollars', '/boutique?tab=historique');
  end if;

  perform _notify(p_winner, 'duel_won', 'Congratulations, you won the duel', null, '/profile?tab=history');
  perform _notify(loser,    'duel_lost', 'You lost the duel', null, '/profile?tab=history');
  perform _notify(c.challenger_id, 'duel_validated', 'Your race has been validated', null, '/profile?tab=history');
  perform _notify(c.defender_id,   'duel_validated', 'Your race has been validated', null, '/profile?tab=history');
end $$;

-- ===== Éditeur : points de passage conservés (pour retoucher un circuit) =====
alter table race_tracks add column if not exists editor_points jsonb, add column if not exists editor_follow boolean, add column if not exists editor_w int, add column if not exists editor_h int;

-- ===== Brouillons de circuits (réservés à l'organisation) =====
create table track_drafts (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  race_type   text not null default 'Sprint urbain' check (race_type in ('Sprint urbain','Circuit','Last Race','Warm-up')),
  difficulty  text not null default 'Medium' check (difficulty in ('Easy','Medium','Hard','Extreme')),
  description text check (char_length(description) <= 1000),
  distance_km numeric(6,1) check (distance_km is null or (distance_km > 0 and distance_km < 1000)),
  points      jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) <= 60),
  follow      boolean not null default true,
  map_w       int not null check (map_w between 100 and 20000),
  map_h       int not null check (map_h between 100 and 20000),
  updated_at  timestamptz not null default now()
);
alter table track_drafts enable row level security;
create policy drafts_admin on track_drafts for all using (is_admin()) with check (is_admin());
revoke all on track_drafts from anon, authenticated;
grant select, insert, update, delete on track_drafts to authenticated;   -- limité aux organisateurs par la RLS

