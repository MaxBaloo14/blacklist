-- 0021 : classement des parieurs, zigollars offerts aux participants des Warm-up Race, votes des pilotes sur les suggestions de course, échelle de la carte.

-- ===== Réglages =====
insert into settings(key, value, description) values
  ('warmup_participation_zigollars', '500', 'Zigollars offerts à chaque participant d''une Warm-up Race (versés à la validation du résultat)'),
  ('map_scale_m_per_px', '6.5', 'Échelle de la carte : mètres par pixel (à calibrer avec un parcours dont on connaît la distance)')
on conflict (key) do nothing;
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (key in ('rewards','inactivity_days','challenge_response_hours','vehicle_classes','forbidden_vehicle_classes','podium_size','challenges_per_week','warmup_participation_zigollars','map_scale_m_per_px') or is_admin());

-- ===== Zigollars pour chaque participation à une Warm-up Race (une seule fois par pilote et par édition) =====
create unique index if not exists point_warmup_once on point_ledger(user_id, ref) where kind = 'warmup';

create or replace function admin_validate_warmup(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e warmup_events; amount bigint := coalesce((setting('warmup_participation_zigollars'))::bigint, 500); d record;
begin
  perform _require_admin(); perform _lock();
  select * into e from warmup_events where id = p_event for update;
  if e.winner_id is null or e.status <> 'completed' then raise exception 'Aucun vainqueur enregistré.'; end if;
  if e.validated_at is not null then raise exception 'Déjà validé.'; end if;
  update warmup_events set validated_by = auth.uid(), validated_at = now() where id = e.id;
  update profiles set entry_eligible = true where id = e.winner_id;
  if amount > 0 then
    for d in select driver_id from warmup_participants where event_id = e.id loop
      perform _points_add(d.driver_id, amount, 'Participation à la Warm-up Race', 'warmup', e.id);
      perform _notify(d.driver_id, 'points', 'You earned zigollars for the Warm-up Race', '+' || amount || ' zigollars', '/boutique?tab=historique');
    end loop;
  end if;
  perform _log('warmup:validate', 'warmup', e.id::text, jsonb_build_object('winner', e.winner_id, 'zigollars_each', amount));
  perform _notify(e.winner_id, 'warmup_won', 'You won the Warm-up Race', 'You are now eligible to enter the Blacklist at #10.', '/profile');
end $$;

-- ===== Meilleurs parieurs (agrégats publics : aucun pari individuel n'est exposé) =====
create or replace view public_bettors as
select b.user_id as driver_id, p.first_name, p.last_name,
       count(*)::int as bets,
       (count(*) filter (where b.status = 'won'))::int as won,
       coalesce(sum(case when b.status = 'won' then b.payout - b.stake else -b.stake end), 0)::bigint as profit,
       coalesce(sum(b.stake), 0)::bigint as staked
from duel_bets b join profiles p on p.id = b.user_id
where b.status in ('won','lost') and p.registration_status = 'validated'
group by b.user_id, p.first_name, p.last_name;
revoke all on public_bettors from anon, authenticated;
grant select on public_bettors to anon, authenticated;

-- ===== Votes des pilotes sur les suggestions de course =====
create table suggestion_votes (
  suggestion_id uuid not null references course_suggestions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
alter table suggestion_votes enable row level security;
create policy votes_read on suggestion_votes for select using (user_id = auth.uid() or is_admin());
revoke all on suggestion_votes from anon, authenticated;
grant select on suggestion_votes to authenticated;

-- Vote : un par pilote et par suggestion ; un deuxième appel retire le vote. Renvoie true si le vote est actif.
create or replace function vote_suggestion(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s course_suggestions;
begin
  if me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = me and account_status = 'active' and registration_status = 'validated') then raise exception 'Compte inactif.'; end if;
  select * into s from course_suggestions where id = p_id;
  if s.id is null or s.status <> 'pending' then raise exception 'Cette suggestion n''est plus ouverte au vote.'; end if;
  if s.user_id = me then raise exception 'Tu ne peux pas voter pour ta propre suggestion.'; end if;
  if exists (select 1 from suggestion_votes where suggestion_id = p_id and user_id = me) then
    delete from suggestion_votes where suggestion_id = p_id and user_id = me; return false;
  end if;
  insert into suggestion_votes(suggestion_id, user_id) values (p_id, me);
  return true;
end $$;
revoke execute on function vote_suggestion(uuid) from public, anon;
grant execute on function vote_suggestion(uuid) to authenticated;

-- Tableau des suggestions ouvertes au vote (pilotes connectés uniquement)
create or replace view suggestion_board as
select s.id, s.name, s.description, s.route_path, s.route_w, s.route_h, s.created_at,
       p.first_name, p.last_name,
       (select count(*) from suggestion_votes v where v.suggestion_id = s.id)::int as votes,
       exists (select 1 from suggestion_votes v where v.suggestion_id = s.id and v.user_id = auth.uid()) as voted,
       (s.user_id = auth.uid()) as mine
from course_suggestions s join profiles p on p.id = s.user_id
where s.status = 'pending' and auth.uid() is not null;
revoke all on suggestion_board from anon, authenticated;
grant select on suggestion_board to authenticated;
