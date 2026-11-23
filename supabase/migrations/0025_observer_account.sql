-- ============================================================
-- Compte « observateur » : consulte le site et peut parier, mais n'est ni pilote ni visible des joueurs.
-- Aucun accès au Control Center (pas de rôle), invisible partout côté public ; seul le staff le voit (fiche pilote).
-- ============================================================
alter table profiles add column if not exists is_observer boolean not null default false;

-- Invisible des pages publiques (fiche pilote, classement des parieurs, participants Warm-up)
create or replace view public_driver as
select p.id, p.first_name, p.last_name, p.account_status, r."position",
       v.make_model, v.vehicle_class, v.photo_path,
       coalesce(s.wins,0) as wins, coalesce(s.losses,0) as losses, coalesce(s.challenges_won,0) as challenges_won,
       p.blacklist_entered_at as ranked_since
from profiles p
left join blacklist_rankings r on r.driver_id = p.id
left join vehicles v on v.owner_id = p.id and v.status = 'approved'
left join driver_stats s on s.driver_id = p.id
where p.registration_status = 'validated' and not p.is_observer;

create or replace view public_bettors as
select b.user_id as driver_id, p.first_name, p.last_name,
       count(*)::int as bets,
       (count(*) filter (where b.status = 'won'))::int as won,
       coalesce(sum(case when b.status = 'won' then b.payout - b.stake else -b.stake end), 0)::bigint as profit,
       coalesce(sum(b.stake), 0)::bigint as staked
from duel_bets b join profiles p on p.id = b.user_id
where b.status in ('won','lost') and p.registration_status = 'validated' and not p.is_observer
group by b.user_id, p.first_name, p.last_name;

create or replace view suggestion_board as
select s.id, s.name, s.description, s.route_path, s.route_w, s.route_h, s.created_at,
       p.first_name, p.last_name,
       (select count(*) from suggestion_votes v where v.suggestion_id = s.id)::int as votes,
       exists (select 1 from suggestion_votes v where v.suggestion_id = s.id and v.user_id = auth.uid()) as voted,
       (s.user_id = auth.uid()) as mine
from course_suggestions s join profiles p on p.id = s.user_id
where s.status = 'pending' and auth.uid() is not null;

-- L'observateur ne participe à rien : ni duel, ni Warm-up, ni véhicule, ni suggestion, ni réclamation
create or replace function _no_observer() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  who := (to_jsonb(new) ->> case tg_table_name
    when 'challenges' then 'challenger_id'
    when 'warmup_participants' then 'driver_id'
    when 'vehicles' then 'owner_id'
    else 'user_id' end)::uuid;
  if exists (select 1 from profiles where id = who and is_observer) then
    raise exception 'Ce compte observateur ne peut pas participer aux courses.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger challenges_no_observer       before insert on challenges          for each row execute function _no_observer();
create trigger warmup_no_observer           before insert on warmup_participants for each row execute function _no_observer();
create trigger vehicles_no_observer         before insert on vehicles            for each row execute function _no_observer();
create trigger suggestions_no_observer      before insert on course_suggestions  for each row execute function _no_observer();
create trigger claims_no_observer           before insert on claims              for each row execute function _no_observer();

-- Les zigollars d'un observateur ne sont jamais verrouillés : il ne peut pas « gagner » autrement qu'en pariant
create or replace function _welcome_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _points_add(new.id, 10000, 'Bonus de bienvenue', 'welcome');
  if new.is_observer then update point_balances set locked = 0 where user_id = new.id; end if;
  return new;
end $$;
