-- ============================================================
-- BLACKLIST — BOOBOO CREW
-- 0001 : schéma, RLS, vues publiques
-- Règle d'or : les données de compétition ne sont modifiables
-- QUE par les fonctions de 0002 (security definer), jamais en direct.
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- Types ----------
create type app_role         as enum ('admin','super_admin');
create type vehicle_status   as enum ('pending','approved','rejected','disqualified','lost','replaced');
create type challenge_status as enum ('awaiting_schedule','scheduled','awaiting_validation','completed','cancelled','forfeited');
create type reward_status    as enum ('pending','paid');
create type warmup_status    as enum ('scheduled','running','completed','cancelled');
create type sanction_type    as enum ('lose_two_positions','removal','replace_with_reserve');
create type reserve_status   as enum ('waiting','promoted','removed');

-- ---------- Paramètres configurables par l'organisation ----------
create table settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

insert into settings(key,value,description) values
 ('challenge_response_hours','48','Délai (heures) pour fixer la date d''un duel'),
 ('challenges_per_week','1','Nombre de défis lancés par challenger et par semaine'),
 ('inactivity_days','14','Jours sans duel avant alerte d''inactivité'),
 ('podium_size','3','Les duels contre un pilote classé de 1 à N sont des duels du podium (3 manches)'),
 ('timezone','"Europe/Paris"','Fuseau horaire utilisé pour définir la semaine (lundi-dimanche)'),
 ('rewards','{"1":2000000,"2":1500000,"3":1000000,"4":800000,"5":700000,"6":500000,"7":400000,"8":300000,"9":250000,"10":200000}','Cash Prize selon le rang du boss battu'),
 ('forbidden_vehicle_classes','["Supersportives"]','Catégories de véhicules interdites'),
 ('vehicle_classes','["Compactes","Coupés","Muscle","Sportives classiques","Sportives","Supersportives","Berlines","SUV","Tout-terrain","Motos"]','Catégories proposées à l''inscription'),
 ('vehicle_loss_scope','"defender"','Qui perd son véhicule au podium : "defender" (le boss battu) ou "both"'),
 ('require_clip_for_validation','false','Exiger un lien de clip pour valider un duel'),
 ('forfeit_gives_reward','false','Un forfait génère-t-il un Cash Prize ?');

create or replace function setting(p_key text) returns jsonb
language sql stable as $$ select value from settings where key = p_key $$;

-- ---------- Profils / rôles ----------
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  first_name           text not null check (char_length(first_name) between 1 and 60),
  last_name            text not null check (char_length(last_name)  between 1 and 60),
  phone                text not null check (char_length(phone) between 4 and 30),
  discord_tag          text not null check (char_length(discord_tag) between 2 and 40),
  account_status       text not null default 'active' check (account_status in ('active','suspended','banned')),
  registration_status  text not null default 'pending' check (registration_status in ('pending','validated','rejected')),
  registration_note    text,
  entry_eligible       boolean not null default false,
  blacklist_entered_at timestamptz,
  last_duel_at         timestamptz,
  inactivity_alerted_at timestamptz,
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    app_role not null,
  label   text,                       -- nom affiché dans le journal (ex. email de l'organisateur)
  primary key (user_id, role)
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from user_roles where user_id = auth.uid() and role in ('admin','super_admin'))
$$;
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from user_roles where user_id = auth.uid() and role = 'super_admin')
$$;

-- ---------- Véhicules ----------
create table vehicles (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id) on delete cascade,
  make_model          text not null check (char_length(make_model) between 2 and 80),
  vehicle_class       text not null,
  is_shop_vehicle     boolean not null default false check (not is_shop_vehicle),
  photo_path          text not null,
  status              vehicle_status not null default 'pending',
  rejection_reason    text,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  replaces_vehicle_id uuid references vehicles(id),
  lost_at             timestamptz,
  lost_reason         text,
  created_at          timestamptz not null default now()
);
-- Un seul véhicule officiel engagé par pilote (+ une seule demande en attente)
create unique index vehicles_one_approved on vehicles(owner_id) where status = 'approved';
create unique index vehicles_one_pending  on vehicles(owner_id) where status = 'pending';

create or replace function vehicles_validate() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'Un véhicule doit d''abord être soumis à homologation.'; end if;
    if new.vehicle_class in (select jsonb_array_elements_text(setting('forbidden_vehicle_classes'))) then
      raise exception 'La catégorie « % » est interdite.', new.vehicle_class;
    end if;
    if not (new.vehicle_class in (select jsonb_array_elements_text(setting('vehicle_classes')))) then
      raise exception 'Catégorie de véhicule inconnue.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_vehicles_validate before insert on vehicles for each row execute function vehicles_validate();

create table vehicle_approvals (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references vehicles(id) on delete cascade,
  reviewer_id uuid,
  decision    text not null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------- Classement ----------
create table blacklist_rankings (
  "position" int primary key check ("position" between 1 and 10),
  driver_id  uuid references profiles(id) on delete set null,
  constraint rankings_driver_unique unique (driver_id) deferrable initially deferred
);
insert into blacklist_rankings("position") select generate_series(1,10);

create table ranking_history (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid references profiles(id) on delete set null,
  from_position int,
  to_position   int,
  kind          text not null,   -- duel | sanction | manual | entry | removal | reserve
  reason        text,
  challenge_id  uuid,
  admin_id      uuid,
  created_at    timestamptz not null default now()
);

-- ---------- Circuits ----------
create table race_tracks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  image_path  text,
  start_point text not null,
  end_point   text not null,
  distance_km numeric(6,2) not null check (distance_km > 0),
  difficulty  text not null check (difficulty in ('Easy','Medium','Hard','Extreme')),
  description text,
  race_type   text not null check (race_type in ('Sprint urbain','Circuit','Last Race','Warm-up')),
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now()
);

-- ---------- Défis ----------
create table challenges (
  id                  uuid primary key default gen_random_uuid(),
  challenger_id       uuid not null references profiles(id),
  defender_id         uuid not null references profiles(id),
  challenger_position int not null,
  defender_position   int not null,
  is_podium           boolean not null default false,
  week_start          date not null,
  counts_for_week     boolean not null default true,
  status              challenge_status not null default 'awaiting_schedule',
  created_at          timestamptz not null default now(),
  respond_by          timestamptz not null,
  overdue_alerted_at  timestamptz,
  scheduled_at        timestamptz,
  scheduled_by        uuid,
  champion_wins       int not null default 0,   -- victoires du défié
  challenger_wins     int not null default 0,
  winner_id           uuid references profiles(id),
  validated_by        uuid,
  validated_at        timestamptz,
  clip_url            text,
  cancelled_by        uuid,
  cancel_reason       text,
  forfeit_by_id       uuid,
  admin_note          text,
  check (challenger_id <> defender_id),
  check (challenger_position = defender_position + 1)
);
create index on challenges(challenger_id, week_start);
create index on challenges(status);

create table challenge_races (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  race_no      int not null check (race_no between 1 and 3),
  kind         text not null check (kind in ('standard','sprint','last_race')),
  chosen_by    text not null check (chosen_by in ('organisation','champion','challenger')),
  track_id     uuid references race_tracks(id),
  unique (challenge_id, race_no)
);

create table race_results (
  id                uuid primary key default gen_random_uuid(),
  challenge_race_id uuid not null unique references challenge_races(id) on delete cascade,
  winner_id         uuid not null references profiles(id),
  recorded_by       uuid not null,            -- toujours un organisateur
  clip_url          text,
  notes             text,
  recorded_at       timestamptz not null default now()
);

-- ---------- Warm-up ----------
create table warmup_events (
  id           uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  track_id     uuid references race_tracks(id),
  status       warmup_status not null default 'scheduled',
  winner_id    uuid references profiles(id),
  validated_by uuid,
  validated_at timestamptz,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create table warmup_participants (
  event_id      uuid not null references warmup_events(id) on delete cascade,
  driver_id     uuid not null references profiles(id) on delete cascade,
  registered_by uuid,
  created_at    timestamptz not null default now(),
  primary key (event_id, driver_id)
);

-- ---------- Cash Prize ----------
create table rewards (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references challenges(id),
  driver_id    uuid not null references profiles(id),
  rank_beaten  int not null,
  amount       bigint not null check (amount >= 0),
  status       reward_status not null default 'pending',
  clip_url     text,
  created_at   timestamptz not null default now()
);
create table reward_payments (
  id         uuid primary key default gen_random_uuid(),
  reward_id  uuid not null unique references rewards(id),
  paid_by    uuid not null,
  paid_at    timestamptz not null default now(),
  proof_url  text,
  note       text
);

-- ---------- Divers ----------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, created_at desc);

create table absences (
  id                  uuid primary key default gen_random_uuid(),
  driver_id           uuid not null references profiles(id) on delete cascade,
  starts_on           date not null,
  ends_on             date,
  reason              text not null,
  suspends_inactivity boolean not null default true,
  recorded_by         uuid,
  created_at          timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table sanctions (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id),
  type       sanction_type not null,
  reason     text not null,
  decided_by uuid not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

create table reserve_drivers (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id) on delete cascade,
  status     reserve_status not null default 'waiting',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  exit_reason text,
  added_by   uuid
);
create unique index reserve_one_waiting on reserve_drivers(driver_id) where status = 'waiting';

create table announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 120),
  body         text not null,
  published    boolean not null default false,
  published_at timestamptz,
  author_id    uuid,
  created_at   timestamptz not null default now()
);

create table admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index on admin_logs(created_at desc);

-- ---------- Audit automatique des tables éditées directement par l'admin ----------
create or replace function audit_changes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_admin() then
    insert into admin_logs(admin_id, action, target_type, target_id, details)
    values (auth.uid(), lower(tg_op) || ':' || tg_table_name, tg_table_name,
            coalesce((to_jsonb(new)->>'id'), (to_jsonb(new)->>'key'), (to_jsonb(old)->>'id'), (to_jsonb(old)->>'key')),
            jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
  end if;
  return coalesce(new, old);
end $$;
create trigger audit_tracks   after insert or update or delete on race_tracks   for each row execute function audit_changes();
create trigger audit_news     after insert or update or delete on announcements for each row execute function audit_changes();
create trigger audit_settings after insert or update or delete on settings      for each row execute function audit_changes();
create trigger audit_profiles after update on profiles for each row
  when (old.account_status is distinct from new.account_status or old.first_name is distinct from new.first_name
        or old.last_name is distinct from new.last_name or old.phone is distinct from new.phone
        or old.discord_tag is distinct from new.discord_tag) execute function audit_changes();

-- ============================================================
-- Statistiques & vues
-- ============================================================
-- Stats publiques (security definer par défaut : n'expose que des colonnes sûres)
create view driver_stats as
select p.id as driver_id,
  (select count(*) from challenges c where c.winner_id = p.id and c.status in ('completed','forfeited'))::int as wins,
  (select count(*) from challenges c where p.id in (c.challenger_id, c.defender_id) and c.status in ('completed','forfeited') and c.winner_id <> p.id)::int as losses,
  (select count(*) from challenges c where c.challenger_id = p.id and c.winner_id = p.id and c.status in ('completed','forfeited'))::int as challenges_won
from profiles p;

create view public_blacklist as
select r."position", p.id as driver_id, p.first_name, p.last_name,
       v.make_model, v.vehicle_class, v.photo_path,
       coalesce(s.wins,0) as wins, coalesce(s.losses,0) as losses,
       p.blacklist_entered_at as ranked_since
from blacklist_rankings r
left join profiles p on p.id = r.driver_id
left join vehicles v on v.owner_id = p.id and v.status = 'approved'
left join driver_stats s on s.driver_id = p.id;

create view public_duels as
select c.id, c.challenger_position, c.defender_position, c.is_podium, c.status,
       c.scheduled_at, c.validated_at, c.champion_wins, c.challenger_wins, c.clip_url,
       ch.id as challenger_id, ch.first_name as challenger_first, ch.last_name as challenger_last,
       df.id as defender_id,   df.first_name as defender_first,   df.last_name as defender_last,
       c.winner_id
from challenges c
join profiles ch on ch.id = c.challenger_id
join profiles df on df.id = c.defender_id
where c.status in ('scheduled','completed','forfeited');

create view public_warmup_participants as
select wp.event_id, p.id as driver_id, p.first_name, p.last_name, v.make_model
from warmup_participants wp join profiles p on p.id = wp.driver_id
left join vehicles v on v.owner_id = p.id and v.status = 'approved';

create view public_driver as
select p.id, p.first_name, p.last_name, p.account_status, r."position",
       v.make_model, v.vehicle_class, v.photo_path,
       coalesce(s.wins,0) as wins, coalesce(s.losses,0) as losses, coalesce(s.challenges_won,0) as challenges_won,
       p.blacklist_entered_at as ranked_since
from profiles p
left join blacklist_rankings r on r.driver_id = p.id
left join vehicles v on v.owner_id = p.id and v.status = 'approved'
left join driver_stats s on s.driver_id = p.id
where p.registration_status = 'validated';

-- Jours d'inactivité (absences justifiées déduites)
create or replace function inactivity_days(p_driver uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare r timestamptz; total int; absent int;
begin
  -- réservé au pilote concerné et aux organisateurs (auth.uid() nul = tâche serveur)
  if auth.uid() is not null and not (is_admin() or auth.uid() = p_driver) then return null; end if;
  select coalesce(last_duel_at, blacklist_entered_at) into r from profiles where id = p_driver;
  if r is null then return 0; end if;
  total := current_date - r::date;
  select count(distinct d::date) into absent
  from absences a,
       generate_series(greatest(a.starts_on, r::date), least(coalesce(a.ends_on, current_date), current_date), interval '1 day') d
  where a.driver_id = p_driver and a.suspends_inactivity;
  return greatest(0, total - coalesce(absent,0));
end $$;

create view inactivity_overview as
select r."position", p.id as driver_id, p.first_name, p.last_name,
       inactivity_days(p.id) as days_inactive,
       (inactivity_days(p.id) >= (setting('inactivity_days'))::int) as needs_attention,
       exists(select 1 from absences a where a.driver_id = p.id and a.suspends_inactivity
              and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)) as on_justified_absence
from blacklist_rankings r join profiles p on p.id = r.driver_id
where is_admin();

create view reserve_queue as
select rd.id, rd.driver_id, rd.status, rd.joined_at, rd.left_at, rd.exit_reason,
       p.first_name, p.last_name, v.make_model,
       case when rd.status = 'waiting' then row_number() over (partition by rd.status order by rd.joined_at) end as queue_position
from reserve_drivers rd join profiles p on p.id = rd.driver_id
left join vehicles v on v.owner_id = p.id and v.status = 'approved'
where is_admin();

-- ============================================================
-- RLS
-- ============================================================
alter table settings            enable row level security;
alter table profiles            enable row level security;
alter table user_roles          enable row level security;
alter table vehicles            enable row level security;
alter table vehicle_approvals   enable row level security;
alter table blacklist_rankings  enable row level security;
alter table ranking_history     enable row level security;
alter table race_tracks         enable row level security;
alter table challenges          enable row level security;
alter table challenge_races     enable row level security;
alter table race_results        enable row level security;
alter table warmup_events       enable row level security;
alter table warmup_participants enable row level security;
alter table rewards             enable row level security;
alter table reward_payments     enable row level security;
alter table notifications       enable row level security;
alter table absences            enable row level security;
alter table sanctions           enable row level security;
alter table reserve_drivers     enable row level security;
alter table announcements       enable row level security;
alter table admin_logs          enable row level security;

-- Lecture publique (aucune donnée privée)
create policy settings_read      on settings      for select using (key in ('rewards','inactivity_days','challenge_response_hours','vehicle_classes','forbidden_vehicle_classes','podium_size','challenges_per_week') or is_admin());
create policy tracks_read        on race_tracks   for select using (true);
create policy rankings_read      on blacklist_rankings for select using (true);
create policy warmup_read        on warmup_events for select using (true);
create policy news_read          on announcements for select using (published or is_admin());
create policy ranking_hist_read  on ranking_history for select using (true);

-- Profils : ses propres infos, ou admin
create policy profiles_self_read  on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_upd   on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_upd  on profiles for update using (is_admin()) with check (is_admin());
-- Un pilote ne peut modifier que ses coordonnées (colonnes), jamais statut/éligibilité/etc.
revoke update on profiles from authenticated, anon;
grant  update (first_name, last_name, phone, discord_tag) on profiles to authenticated;
-- l'admin passe par les fonctions admin_* (security definer) pour les champs sensibles

create policy roles_self_read on user_roles for select using (user_id = auth.uid() or is_super_admin());
create policy roles_admin_read on user_roles for select using (is_admin());
create policy roles_super_write on user_roles for all using (is_super_admin()) with check (is_super_admin());

create policy vehicles_read on vehicles for select using (owner_id = auth.uid() or is_admin() or status = 'approved');
create policy approvals_read on vehicle_approvals for select using (is_admin() or exists(select 1 from vehicles v where v.id = vehicle_id and v.owner_id = auth.uid()));

create policy challenges_read on challenges for select using (auth.uid() in (challenger_id, defender_id) or is_admin());
create policy races_read on challenge_races for select using (exists(select 1 from challenges c where c.id = challenge_id and (auth.uid() in (c.challenger_id, c.defender_id) or is_admin() or c.status in ('completed','forfeited','scheduled'))));
create policy results_read on race_results for select using (true);

create policy wp_read on warmup_participants for select using (true);

create policy rewards_read on rewards for select using (driver_id = auth.uid() or is_admin());
create policy payments_read on reward_payments for select using (is_admin() or exists(select 1 from rewards r where r.id = reward_id and r.driver_id = auth.uid()));

create policy notif_read on notifications for select using (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
create policy notif_mark on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy absences_read on absences for select using (driver_id = auth.uid() or is_admin());
create policy sanctions_read on sanctions for select using (driver_id = auth.uid() or is_admin());
create policy reserve_read on reserve_drivers for select using (is_admin() or driver_id = auth.uid());
create policy logs_read on admin_logs for select using (is_admin());

-- Écritures directes admin autorisées uniquement sur contenu éditorial
create policy tracks_admin_write on race_tracks for all using (is_admin()) with check (is_admin());
create policy news_admin_write   on announcements for all using (is_admin()) with check (is_admin());
create policy settings_super_write on settings for all using (is_super_admin()) with check (is_super_admin());

-- Les vues publiques sont exécutées avec les droits du propriétaire : lecture seule
-- Les vues tournent avec les droits du propriétaire : on les verrouille en LECTURE SEULE
-- (sinon une vue simple comme driver_stats serait modifiable par un pilote, en contournant la RLS)
revoke all on driver_stats, public_blacklist, public_duels, public_warmup_participants, public_driver, inactivity_overview, reserve_queue from anon, authenticated;
grant select on driver_stats, public_blacklist, public_duels, public_warmup_participants, public_driver to anon, authenticated;
grant select on inactivity_overview, reserve_queue to authenticated;
