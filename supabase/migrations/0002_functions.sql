-- ============================================================
-- 0002 : logique métier côté serveur (atomique, vérifiée, journalisée)
-- Aucune de ces fonctions ne fait confiance au navigateur :
-- l'identité vient de auth.uid(), les droits de user_roles.
-- ============================================================

-- ---------- Outils internes ----------
create or replace function _lock() returns void language sql as $$
  select pg_advisory_xact_lock(424242)      -- sérialise toute mutation de compétition
$$;

create or replace function _require_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then raise exception 'Accès réservé aux organisateurs.' using errcode = '42501'; end if;
end $$;

create or replace function _log(p_action text, p_type text, p_target text, p_details jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into admin_logs(admin_id, action, target_type, target_id, details) values (auth.uid(), p_action, p_type, p_target, p_details)
$$;

create or replace function _notify(p_user uuid, p_kind text, p_title text, p_body text default null, p_link text default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

create or replace function _notify_admins(p_kind text, p_title text, p_body text default null, p_link text default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, kind, title, body, link)
  select distinct user_id, p_kind, p_title, p_body, p_link from user_roles
$$;

create or replace function _rank_of(p_driver uuid) returns int language sql stable security definer set search_path = public as $$
  select "position" from blacklist_rankings where driver_id = p_driver
$$;

create or replace function _name(p_driver uuid) returns text language sql stable security definer set search_path = public as $$
  select first_name || ' ' || last_name from profiles where id = p_driver
$$;

create or replace function _week_start() returns date language sql stable as $$
  select date_trunc('week', now() at time zone (setting('timezone') #>> '{}'))::date
$$;

-- Le pilote peut-il participer ? (compte actif, inscription validée, véhicule homologué)
create or replace function _driver_ready(p_driver uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = p_driver;
  if p.id is null then return 'Pilote introuvable.'; end if;
  if p.account_status <> 'active' then return 'Le compte de ' || p.first_name || ' ' || p.last_name || ' n''est pas actif.'; end if;
  if p.registration_status <> 'validated' then return 'L''inscription de ' || p.first_name || ' ' || p.last_name || ' n''est pas validée.'; end if;
  if not exists(select 1 from vehicles where owner_id = p_driver and status = 'approved') then
    return 'Le véhicule de ' || p.first_name || ' ' || p.last_name || ' n''est pas homologué.';
  end if;
  return null;
end $$;

-- Réécrit tout le classement d'un coup et journalise chaque mouvement
create or replace function _write_ranking(p_new uuid[], p_kind text, p_reason text, p_challenge uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare old_arr uuid[]; i int; d uuid; op int; np int;
begin
  if array_length(p_new,1) is distinct from 10 then raise exception 'Le classement doit contenir 10 positions.'; end if;
  select array_agg(driver_id order by "position") into old_arr from blacklist_rankings;
  -- unicité vérifiée par contrainte différée
  for i in 1..10 loop
    update blacklist_rankings set driver_id = p_new[i] where "position" = i;
  end loop;
  -- historique + notifications pour tous les pilotes concernés
  for d in select distinct x from unnest(old_arr || p_new) x where x is not null loop
    select g into op from generate_subscripts(old_arr,1) g where old_arr[g] = d;
    select g into np from generate_subscripts(p_new,1) g where p_new[g] = d;
    if op is distinct from np then
      insert into ranking_history(driver_id, from_position, to_position, kind, reason, challenge_id, admin_id)
      values (d, op, np, p_kind, p_reason, p_challenge, auth.uid());
      perform _notify(d, 'ranking_changed', 'Your position in the Blacklist has changed',
        case when np is null then 'You have left the Blacklist.' else 'You are now #' || np || '.' end, '/profile');
      if op is null then update profiles set blacklist_entered_at = now() where id = d; end if;
      if np is null then update profiles set blacklist_entered_at = null where id = d; end if;
    end if;
  end loop;
end $$;

create or replace function _ranking_array() returns uuid[] language sql stable security definer set search_path = public as $$
  select array_agg(driver_id order by "position") from blacklist_rankings
$$;

-- ============================================================
-- PILOTE
-- ============================================================
create or replace function touch_activity() returns void language sql security definer set search_path = public as $$
  update profiles set last_activity_at = now() where id = auth.uid()
$$;

create or replace function mark_notifications_read() returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- Proposition de véhicule (nouveau véhicule ou changement), soumise à homologation
create or replace function propose_vehicle(p_make_model text, p_class text, p_photo_path text, p_is_shop boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cur uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode='42501'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  if p_is_shop then raise exception 'Les véhicules de boutique sont interdits.'; end if;
  if p_photo_path is null or p_photo_path not like auth.uid()::text || '/%' then raise exception 'Photographie invalide.'; end if;
  if exists(select 1 from vehicles where owner_id = auth.uid() and status = 'pending') then
    raise exception 'Une demande d''homologation est déjà en cours.';
  end if;
  select id into v_cur from vehicles where owner_id = auth.uid() and status = 'approved';
  insert into vehicles(owner_id, make_model, vehicle_class, photo_path, replaces_vehicle_id)
  values (auth.uid(), trim(p_make_model), p_class, p_photo_path, v_cur) returning id into v_id;
  perform _notify_admins('vehicle_pending', 'Vehicle awaiting approval', _name(auth.uid()) || ' — ' || p_make_model, '/admin/vehicles');
  return v_id;
end $$;

create or replace function cancel_vehicle_proposal() returns void language sql security definer set search_path = public as $$
  delete from vehicles where owner_id = auth.uid() and status = 'pending'
$$;

-- ---------- Création d'un défi ----------
create or replace function create_challenge(p_target uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mypos int; tpos int; err text; v_id uuid; v_podium boolean; v_hours int; v_per_week int; ws date;
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

  v_hours  := (setting('challenge_response_hours'))::int;
  v_podium := tpos <= (setting('podium_size'))::int;
  insert into challenges(challenger_id, defender_id, challenger_position, defender_position, is_podium, week_start, respond_by)
  values (me, p_target, mypos, tpos, v_podium, ws, now() + make_interval(hours => v_hours)) returning id into v_id;

  if v_podium then
    insert into challenge_races(challenge_id, race_no, kind, chosen_by) values
      (v_id,1,'sprint','champion'),(v_id,2,'sprint','challenger'),(v_id,3,'last_race','organisation');
  else
    insert into challenge_races(challenge_id, race_no, kind, chosen_by) values (v_id,1,'standard','organisation');
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

-- ---------- Programmation du duel par le pilote défié ----------
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
  week_end := ((c.week_start + 7)::timestamp) at time zone tz;
  if p_at >= week_end then raise exception 'Le duel doit avoir lieu dans la semaine en cours (avant le %).', to_char((c.week_start + 6), 'DD/MM'); end if;
  update challenges set scheduled_at = p_at, scheduled_by = auth.uid(), status = 'scheduled' where id = c.id;
  perform _notify(c.defender_id,   'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/challenges');
  perform _notify(c.challenger_id, 'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/challenges');
  perform _notify_admins('challenge_scheduled', 'Duel scheduled', _name(c.challenger_id) || ' vs ' || _name(c.defender_id) || ' — ' || to_char(p_at at time zone tz, 'DD/MM HH24:MI'), '/admin/challenges');
  update profiles set last_activity_at = now() where id = auth.uid();
end $$;

-- Choix du tracé d'une manche par la personne désignée (champion / challenger)
create or replace function set_race_track(p_race uuid, p_track uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r challenge_races; c challenges;
begin
  select * into r from challenge_races where id = p_race;
  select * into c from challenges where id = r.challenge_id;
  if c.id is null then raise exception 'Manche introuvable.'; end if;
  if not (is_admin() or (r.chosen_by = 'champion' and auth.uid() = c.defender_id) or (r.chosen_by = 'challenger' and auth.uid() = c.challenger_id)) then
    raise exception 'Tu ne choisis pas le tracé de cette manche.' using errcode='42501';
  end if;
  if c.status not in ('awaiting_schedule','scheduled') then raise exception 'Ce défi est clos.'; end if;
  if not exists(select 1 from race_tracks where id = p_track and status = 'active') then raise exception 'Circuit inactif ou inconnu.'; end if;
  update challenge_races set track_id = p_track where id = p_race;
end $$;

-- ============================================================
-- ADMIN — Pilotes & véhicules
-- ============================================================
create or replace function admin_validate_registration(p_driver uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_decision not in ('validated','rejected') then raise exception 'Décision invalide.'; end if;
  update profiles set registration_status = p_decision, registration_note = p_note where id = p_driver;
  perform _log('registration:' || p_decision, 'profile', p_driver::text, jsonb_build_object('note', p_note));
  perform _notify(p_driver, 'registration', case when p_decision = 'validated' then 'Your registration has been validated' else 'Your registration has been rejected' end, p_note, '/profile');
end $$;

create or replace function admin_set_account_status(p_driver uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_status not in ('active','suspended','banned') then raise exception 'Statut invalide.'; end if;
  if char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un motif est requis.'; end if;
  update profiles set account_status = p_status where id = p_driver;
  perform _log('account:' || p_status, 'profile', p_driver::text, jsonb_build_object('reason', p_reason));
  perform _notify(p_driver, 'account', 'Your account status is now: ' || p_status, p_reason, '/profile');
end $$;

create or replace function admin_review_vehicle(p_vehicle uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v vehicles;
begin
  perform _require_admin(); perform _lock();
  select * into v from vehicles where id = p_vehicle for update;
  if v.id is null then raise exception 'Véhicule introuvable.'; end if;
  if v.owner_id = auth.uid() then raise exception 'Un pilote ne peut pas homologuer son propre véhicule.'; end if;
  if p_decision not in ('approved','rejected','disqualified') then raise exception 'Décision invalide.'; end if;
  if p_decision in ('rejected','disqualified') and char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un motif est requis.'; end if;
  if p_decision in ('approved','rejected') and v.status <> 'pending' then raise exception 'Cette demande a déjà été traitée.'; end if;
  if p_decision = 'disqualified' and v.status <> 'approved' then raise exception 'Seul un véhicule homologué peut être disqualifié.'; end if;

  if p_decision = 'approved' then
    update vehicles set status = 'replaced' where owner_id = v.owner_id and status = 'approved';
  end if;
  update vehicles set status = p_decision::vehicle_status, rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now() where id = v.id;
  insert into vehicle_approvals(vehicle_id, reviewer_id, decision, reason) values (v.id, auth.uid(), p_decision, p_reason);
  perform _log('vehicle:' || p_decision, 'vehicle', v.id::text, jsonb_build_object('reason', p_reason, 'owner', v.owner_id));
  perform _notify(v.owner_id, 'vehicle_' || p_decision,
    case p_decision when 'approved' then 'Your vehicle has been approved'
                    when 'rejected' then 'Your vehicle has been rejected'
                    else 'Your vehicle has been disqualified' end, p_reason, '/profile?tab=garage');
end $$;

-- Perte de véhicule enregistrée à la main (confiscation)
create or replace function _lose_vehicle(p_driver uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update vehicles set status = 'lost', lost_at = now(), lost_reason = p_reason where owner_id = p_driver and status = 'approved';
  perform _notify(p_driver, 'vehicle_lost', 'Your vehicle has been confiscated',
    'You lost your engaged vehicle. Register a new valid vehicle and get it approved to race again.', '/profile?tab=garage');
  perform _notify_admins('vehicle_lost', 'Vehicle lost', _name(p_driver) || ' — ' || coalesce(p_reason,''), '/admin/vehicles');
end $$;

create or replace function admin_mark_vehicle_lost(p_driver uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(); perform _lock();
  if not exists(select 1 from vehicles where owner_id = p_driver and status = 'approved') then raise exception 'Ce pilote n''a pas de véhicule engagé.'; end if;
  perform _lose_vehicle(p_driver, p_reason);
  perform _log('vehicle:lost', 'profile', p_driver::text, jsonb_build_object('reason', p_reason));
end $$;

-- ============================================================
-- ADMIN — Défis
-- ============================================================
create or replace function admin_set_schedule(p_challenge uuid, p_at timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges; tz text := setting('timezone') #>> '{}';
begin
  perform _require_admin(); perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null then raise exception 'Défi introuvable.'; end if;
  if c.status not in ('awaiting_schedule','scheduled') then raise exception 'Ce défi est clos.'; end if;
  if char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un motif est requis.'; end if;
  update challenges set scheduled_at = p_at, scheduled_by = auth.uid(), status = 'scheduled', admin_note = p_reason where id = c.id;
  perform _log('challenge:set_schedule', 'challenge', c.id::text, jsonb_build_object('at', p_at, 'reason', p_reason));
  perform _notify(c.defender_id,   'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI') || ' (set by the organisation)', '/challenges');
  perform _notify(c.challenger_id, 'challenge_scheduled', 'Your duel has been scheduled', to_char(p_at at time zone tz, 'DD/MM HH24:MI') || ' (set by the organisation)', '/challenges');
end $$;

create or replace function admin_cancel_challenge(p_challenge uuid, p_reason text, p_free_week boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  perform _require_admin(); perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null then raise exception 'Défi introuvable.'; end if;
  if c.status in ('completed','cancelled','forfeited') then raise exception 'Ce défi est déjà clos.'; end if;
  if char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un justificatif est requis.'; end if;
  update challenges set status = 'cancelled', cancelled_by = auth.uid(), cancel_reason = p_reason,
         counts_for_week = case when p_free_week then false else counts_for_week end where id = c.id;
  perform _log('challenge:cancel', 'challenge', c.id::text, jsonb_build_object('reason', p_reason, 'free_week', p_free_week));
  perform _notify(c.challenger_id, 'challenge_cancelled', 'Your duel has been cancelled', p_reason, '/challenges');
  perform _notify(c.defender_id,   'challenge_cancelled', 'Your duel has been cancelled', p_reason, '/challenges');
end $$;

-- Application du résultat : classement, récompense, perte du véhicule, notifications
create or replace function _resolve_challenge(p_challenge uuid, p_winner uuid, p_clip text, p_forfeit boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges; arr uuid[]; loser uuid; amount bigint; scope text := setting('vehicle_loss_scope') #>> '{}';
        cd int; cc int; make_reward boolean;
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

  perform _notify(p_winner, 'duel_won', 'Congratulations, you won the duel', null, '/profile?tab=history');
  perform _notify(loser,    'duel_lost', 'You lost the duel', null, '/profile?tab=history');
  perform _notify(c.challenger_id, 'duel_validated', 'Your race has been validated', null, '/profile?tab=history');
  perform _notify(c.defender_id,   'duel_validated', 'Your race has been validated', null, '/profile?tab=history');
end $$;

create or replace function admin_declare_forfeit(p_challenge uuid, p_forfeiting uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges; winner uuid;
begin
  perform _require_admin(); perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null then raise exception 'Défi introuvable.'; end if;
  if c.status not in ('awaiting_schedule','scheduled') then raise exception 'Ce défi ne peut plus faire l''objet d''un forfait.'; end if;
  if p_forfeiting not in (c.challenger_id, c.defender_id) then raise exception 'Ce pilote ne participe pas au défi.'; end if;
  if char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un motif est requis.'; end if;
  winner := case when p_forfeiting = c.challenger_id then c.defender_id else c.challenger_id end;
  perform _resolve_challenge(c.id, winner, null, true);
  update challenges set admin_note = p_reason where id = c.id;
  perform _log('challenge:forfeit', 'challenge', c.id::text, jsonb_build_object('forfeiting', p_forfeiting, 'reason', p_reason));
end $$;

-- Saisie d'une manche par un organisateur ; calcule le vainqueur automatiquement
create or replace function admin_record_race_result(p_race uuid, p_winner uuid, p_clip text default null, p_notes text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r challenge_races; c challenges; w_ch int; w_df int; need int; decided uuid;
begin
  perform _require_admin(); perform _lock();
  select * into r from challenge_races where id = p_race;
  select * into c from challenges where id = r.challenge_id for update;
  if c.id is null then raise exception 'Manche introuvable.'; end if;
  if c.status not in ('scheduled','awaiting_validation') then raise exception 'Le défi doit être programmé pour saisir un résultat.'; end if;
  if p_winner not in (c.challenger_id, c.defender_id) then raise exception 'Le vainqueur doit être l''un des deux pilotes.'; end if;
  if c.winner_id is not null and not exists(select 1 from race_results where challenge_race_id = p_race) then
    raise exception 'Le duel est déjà décidé : cette manche n''est pas nécessaire.';
  end if;
  if r.race_no > 1 and (select count(*) from race_results rr join challenge_races x on x.id = rr.challenge_race_id
                         where x.challenge_id = c.id and x.race_no < r.race_no) < r.race_no - 1 then
    raise exception 'Saisis les manches dans l''ordre.';
  end if;

  insert into race_results(challenge_race_id, winner_id, recorded_by, clip_url, notes)
  values (p_race, p_winner, auth.uid(), p_clip, p_notes)
  on conflict (challenge_race_id) do update set winner_id = excluded.winner_id, recorded_by = auth.uid(), clip_url = excluded.clip_url, notes = excluded.notes, recorded_at = now();

  select count(*) filter (where rr.winner_id = c.challenger_id), count(*) filter (where rr.winner_id = c.defender_id)
    into w_ch, w_df from race_results rr join challenge_races x on x.id = rr.challenge_race_id where x.challenge_id = c.id;
  need := case when c.is_podium then 2 else 1 end;
  decided := case when w_ch >= need then c.challenger_id when w_df >= need then c.defender_id end;

  update challenges set challenger_wins = w_ch, champion_wins = w_df, winner_id = decided,
     status = case when decided is null then 'scheduled'::challenge_status else 'awaiting_validation'::challenge_status end,
     clip_url = coalesce(p_clip, clip_url) where id = c.id;
  perform _log('race:result', 'challenge_race', p_race::text, jsonb_build_object('winner', p_winner, 'score', w_ch || '-' || w_df));
  if decided is not null then
    perform _notify_admins('result_pending', 'Result awaiting validation', _name(c.challenger_id) || ' vs ' || _name(c.defender_id), '/admin/challenges');
  end if;
end $$;

create or replace function admin_validate_challenge(p_challenge uuid, p_clip text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  perform _require_admin(); perform _lock();
  select * into c from challenges where id = p_challenge for update;
  if c.id is null then raise exception 'Défi introuvable.'; end if;
  if c.status <> 'awaiting_validation' or c.winner_id is null then raise exception 'Aucun résultat à valider pour ce défi.'; end if;
  if (setting('require_clip_for_validation'))::boolean and coalesce(p_clip, c.clip_url, '') = '' then raise exception 'Un lien de clip est requis.'; end if;
  perform _resolve_challenge(c.id, c.winner_id, coalesce(p_clip, c.clip_url), false);
  perform _log('challenge:validate', 'challenge', c.id::text, jsonb_build_object('winner', c.winner_id, 'clip', coalesce(p_clip, c.clip_url)));
end $$;

-- ============================================================
-- ADMIN — Classement, sanctions, réserve
-- ============================================================
create or replace function admin_set_ranking(p_assignments jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare arr uuid[]; i int; d uuid;
begin
  perform _require_admin(); perform _lock();
  if char_length(coalesce(p_reason,'')) < 5 then raise exception 'Une justification (5 caractères minimum) est obligatoire.'; end if;
  arr := array_fill(null::uuid, array[10]);
  for i in 1..10 loop
    d := nullif(p_assignments ->> (i-1), '')::uuid;
    if d is not null and not exists(select 1 from profiles where id = d and registration_status = 'validated') then
      raise exception 'Le pilote en position % n''est pas valide.', i;
    end if;
    arr[i] := d;
  end loop;
  if (select count(x) <> count(distinct x) from unnest(arr) x) then raise exception 'Un pilote ne peut occuper qu''une position.'; end if;
  if exists(select 1 from challenges where status in ('awaiting_schedule','scheduled','awaiting_validation')) then
    raise exception 'Des défis sont en cours : clos-les ou annule-les avant de modifier le classement à la main.';
  end if;
  perform _write_ranking(arr, 'manual', p_reason);
  perform _log('ranking:manual', 'ranking', null, jsonb_build_object('reason', p_reason, 'new', arr));
end $$;

create or replace function admin_apply_sanction(p_driver uuid, p_type sanction_type, p_reason text, p_reserve uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare arr uuid[]; p int; q int; i int; rv reserve_drivers; tmp uuid;
begin
  perform _require_admin(); perform _lock();
  if char_length(coalesce(p_reason,'')) < 5 then raise exception 'Une décision motivée est obligatoire.'; end if;
  arr := _ranking_array();
  p := _rank_of(p_driver);
  if p is null then raise exception 'Ce pilote n''est pas dans la Blacklist.'; end if;
  if exists(select 1 from challenges where status in ('awaiting_schedule','scheduled','awaiting_validation') and p_driver in (challenger_id, defender_id)) then
    raise exception 'Ce pilote est engagé dans un défi en cours.';
  end if;

  if p_type = 'lose_two_positions' then
    q := least(p + 2, 10);
    for i in p..q-1 loop arr[i] := arr[i+1]; end loop;
    arr[q] := p_driver;
    perform _write_ranking(arr, 'sanction', p_reason);
  elsif p_type = 'removal' then
    for i in p..9 loop arr[i] := arr[i+1]; end loop;
    arr[10] := null;
    perform _write_ranking(arr, 'removal', p_reason);
  else
    select * into rv from reserve_drivers where id = p_reserve and status = 'waiting' for update;
    if rv.id is null then raise exception 'Choisis un réserviste en attente.'; end if;
    if _driver_ready(rv.driver_id) is not null then raise exception '%', _driver_ready(rv.driver_id); end if;
    arr[p] := rv.driver_id;
    perform _write_ranking(arr, 'reserve', p_reason);
    update reserve_drivers set status = 'promoted', left_at = now(), exit_reason = 'Replaces ' || _name(p_driver) where id = rv.id;
  end if;
  insert into sanctions(driver_id, type, reason, decided_by, details) values (p_driver, p_type, p_reason, auth.uid(), jsonb_build_object('from_position', p, 'reserve', p_reserve));
  perform _log('sanction:' || p_type, 'profile', p_driver::text, jsonb_build_object('reason', p_reason, 'from_position', p));
  perform _notify(p_driver, 'sanction', 'A sanction has been applied', p_reason, '/profile');
end $$;

create or replace function admin_record_absence(p_driver uuid, p_from date, p_to date, p_reason text, p_suspends boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if char_length(coalesce(p_reason,'')) < 3 then raise exception 'Un motif est requis.'; end if;
  insert into absences(driver_id, starts_on, ends_on, reason, suspends_inactivity, recorded_by) values (p_driver, p_from, p_to, p_reason, p_suspends, auth.uid());
  perform _log('absence:record', 'profile', p_driver::text, jsonb_build_object('from', p_from, 'to', p_to, 'reason', p_reason, 'suspends', p_suspends));
  perform _notify(p_driver, 'absence', 'Your absence has been recorded', p_reason, '/profile');
end $$;

create or replace function admin_add_reserve(p_driver uuid) returns void
language plpgsql security definer set search_path = public as $$
declare err text;
begin
  perform _require_admin(); perform _lock();
  err := _driver_ready(p_driver); if err is not null then raise exception '%', err; end if;
  if _rank_of(p_driver) is not null then raise exception 'Ce pilote est déjà dans la Blacklist.'; end if;
  insert into reserve_drivers(driver_id, added_by) values (p_driver, auth.uid());
  perform _log('reserve:add', 'profile', p_driver::text);
end $$;

create or replace function admin_remove_reserve(p_reserve uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update reserve_drivers set status = 'removed', left_at = now(), exit_reason = p_reason where id = p_reserve and status = 'waiting';
  perform _log('reserve:remove', 'reserve', p_reserve::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function admin_promote_reserve(p_reserve uuid, p_position int default null) returns void
language plpgsql security definer set search_path = public as $$
declare rv reserve_drivers; arr uuid[]; pos int; err text;
begin
  perform _require_admin(); perform _lock();
  select * into rv from reserve_drivers where id = p_reserve and status = 'waiting' for update;
  if rv.id is null then raise exception 'Réserviste introuvable.'; end if;
  err := _driver_ready(rv.driver_id); if err is not null then raise exception '%', err; end if;
  arr := _ranking_array();
  pos := coalesce(p_position, (select max("position") from blacklist_rankings where driver_id is null));
  if pos is null or arr[pos] is not null then raise exception 'Aucune position vacante à pourvoir.'; end if;
  arr[pos] := rv.driver_id;
  perform _write_ranking(arr, 'reserve', 'Promoted from reserve');
  update reserve_drivers set status = 'promoted', left_at = now(), exit_reason = 'Promoted to #' || pos where id = rv.id;
  perform _log('reserve:promote', 'reserve', p_reserve::text, jsonb_build_object('position', pos));
end $$;

-- ============================================================
-- ADMIN — Warm-up Race
-- ============================================================
create or replace function admin_create_warmup(p_at timestamptz, p_track uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform _require_admin();
  insert into warmup_events(scheduled_at, track_id, created_by) values (p_at, p_track, auth.uid()) returning id into v;
  perform _log('warmup:create', 'warmup', v::text, jsonb_build_object('at', p_at));
  return v;
end $$;

create or replace function admin_warmup_participant(p_event uuid, p_driver uuid, p_add boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e warmup_events; err text;
begin
  perform _require_admin(); perform _lock();
  select * into e from warmup_events where id = p_event;
  if e.status not in ('scheduled','running') then raise exception 'Cette édition est close.'; end if;
  if p_add then
    err := _driver_ready(p_driver); if err is not null then raise exception '%', err; end if;
    if _rank_of(p_driver) is not null then raise exception 'Ce pilote est déjà dans la Blacklist.'; end if;
    insert into warmup_participants(event_id, driver_id, registered_by) values (p_event, p_driver, auth.uid()) on conflict do nothing;
  else
    delete from warmup_participants where event_id = p_event and driver_id = p_driver;
  end if;
  perform _log(case when p_add then 'warmup:add' else 'warmup:remove' end, 'warmup', p_event::text, jsonb_build_object('driver', p_driver));
end $$;

create or replace function admin_warmup_status(p_event uuid, p_status warmup_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_status not in ('running','cancelled') then raise exception 'Statut non autorisé.'; end if;
  update warmup_events set status = p_status where id = p_event and status in ('scheduled','running');
  perform _log('warmup:' || p_status, 'warmup', p_event::text);
end $$;

create or replace function admin_record_warmup_winner(p_event uuid, p_winner uuid, p_notes text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(); perform _lock();
  if not exists(select 1 from warmup_participants where event_id = p_event and driver_id = p_winner) then raise exception 'Le vainqueur doit être un participant.'; end if;
  if exists(select 1 from warmup_events where id = p_event and validated_at is not null) then raise exception 'Résultat déjà validé.'; end if;
  update warmup_events set winner_id = p_winner, status = 'completed', notes = p_notes where id = p_event and status in ('scheduled','running','completed');
  perform _log('warmup:winner', 'warmup', p_event::text, jsonb_build_object('winner', p_winner));
end $$;

create or replace function admin_validate_warmup(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e warmup_events;
begin
  perform _require_admin(); perform _lock();
  select * into e from warmup_events where id = p_event for update;
  if e.winner_id is null or e.status <> 'completed' then raise exception 'Aucun vainqueur enregistré.'; end if;
  if e.validated_at is not null then raise exception 'Déjà validé.'; end if;
  update warmup_events set validated_by = auth.uid(), validated_at = now() where id = e.id;
  update profiles set entry_eligible = true where id = e.winner_id;
  perform _log('warmup:validate', 'warmup', e.id::text, jsonb_build_object('winner', e.winner_id));
  perform _notify(e.winner_id, 'warmup_won', 'You won the Warm-up Race', 'You are now eligible to enter the Blacklist at #10.', '/profile');
end $$;

-- Entrée au #10 d'un vainqueur éligible
create or replace function admin_enter_blacklist(p_driver uuid, p_displace boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare arr uuid[]; occ uuid; err text;
begin
  perform _require_admin(); perform _lock();
  if not exists(select 1 from profiles where id = p_driver and entry_eligible) then raise exception 'Ce pilote n''est pas éligible (Warm-up non validée).'; end if;
  err := _driver_ready(p_driver); if err is not null then raise exception '%', err; end if;
  arr := _ranking_array();
  occ := arr[10];
  if occ is not null then
    if not p_displace then raise exception 'Le #10 est occupé. Évincer l''occupant (envoyé en réserve) ?'; end if;
    if exists(select 1 from challenges where status in ('awaiting_schedule','scheduled','awaiting_validation') and occ in (challenger_id, defender_id)) then
      raise exception 'L''occupant du #10 est engagé dans un défi en cours.';
    end if;
    insert into reserve_drivers(driver_id, added_by) values (occ, auth.uid()) on conflict do nothing;
  end if;
  arr[10] := p_driver;
  perform _write_ranking(arr, 'entry', 'Warm-up Race winner');
  update profiles set entry_eligible = false where id = p_driver;
  perform _log('ranking:entry', 'profile', p_driver::text, jsonb_build_object('displaced', occ));
end $$;

-- ============================================================
-- ADMIN — Cash Prize
-- ============================================================
create or replace function admin_confirm_payment(p_reward uuid, p_proof text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r rewards;
begin
  perform _require_admin(); perform _lock();
  select * into r from rewards where id = p_reward for update;
  if r.id is null then raise exception 'Récompense introuvable.'; end if;
  if r.status = 'paid' then raise exception 'Déjà payée.'; end if;
  insert into reward_payments(reward_id, paid_by, proof_url, note) values (r.id, auth.uid(), p_proof, p_note);
  update rewards set status = 'paid' where id = r.id;
  perform _log('reward:paid', 'reward', r.id::text, jsonb_build_object('amount', r.amount, 'driver', r.driver_id, 'proof', p_proof));
  perform _notify(r.driver_id, 'reward_paid', 'Your Cash Prize has been paid', '$' || r.amount, '/profile?tab=rewards');
end $$;

create or replace function admin_set_reward_clip(p_reward uuid, p_clip text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update rewards set clip_url = p_clip where id = p_reward;
  update challenges set clip_url = p_clip where id = (select challenge_id from rewards where id = p_reward);
  perform _log('reward:clip', 'reward', p_reward::text, jsonb_build_object('clip', p_clip));
end $$;

-- ============================================================
-- Alertes (inactivité, délais de 48 h) — jamais de sanction automatique
-- ============================================================
create or replace function run_alerts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; o record; n_over int := 0; n_inact int := 0;
begin
  if auth.uid() is not null then perform _require_admin(); end if;   -- planificateur serveur : auth.uid() nul
  for c in select * from challenges where status = 'awaiting_schedule' and respond_by < now() and overdue_alerted_at is null loop
    update challenges set overdue_alerted_at = now() where id = c.id;
    perform _notify_admins('challenge_overdue', 'Duel date not set in time', _name(c.defender_id) || ' did not schedule vs ' || _name(c.challenger_id), '/admin/challenges');
    n_over := n_over + 1;
  end loop;
  for o in select * from inactivity_overview_raw() where needs_attention loop
    if (select inactivity_alerted_at from profiles where id = o.driver_id) is null then
      update profiles set inactivity_alerted_at = now() where id = o.driver_id;
      perform _notify(o.driver_id, 'inactivity', 'Your inactivity period requires attention', o.days_inactive || ' days without an official duel.', '/profile');
      perform _notify_admins('inactivity', 'Inactivity alert', _name(o.driver_id) || ' — ' || o.days_inactive || ' days', '/admin/inactivity');
      n_inact := n_inact + 1;
    end if;
  end loop;
  return jsonb_build_object('overdue', n_over, 'inactivity', n_inact);
end $$;

create or replace function inactivity_overview_raw() returns table(driver_id uuid, days_inactive int, needs_attention boolean)
language sql stable security definer set search_path = public as $$
  select p.id, inactivity_days(p.id), inactivity_days(p.id) >= (setting('inactivity_days'))::int
  from blacklist_rankings r join profiles p on p.id = r.driver_id
  where not exists(select 1 from absences a where a.driver_id = p.id and a.suspends_inactivity and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date))
$$;

-- ============================================================
-- Droits d'exécution : jamais pour les anonymes
-- ============================================================
-- Supabase accorde par défaut EXECUTE à anon/authenticated sur toute nouvelle fonction :
-- on retire tout, puis on n'accorde que les fonctions réellement publiques (les _internes restent inaccessibles via l'API).
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant  execute on function setting(text), is_admin(), is_super_admin() to anon, authenticated;
grant  execute on function inactivity_days(uuid) to authenticated;
grant  execute on function touch_activity(), mark_notifications_read(), propose_vehicle(text,text,text,boolean), cancel_vehicle_proposal(),
       create_challenge(uuid), schedule_challenge(uuid,timestamptz), set_race_track(uuid,uuid) to authenticated;
grant  execute on function
  admin_validate_registration(uuid,text,text), admin_set_account_status(uuid,text,text), admin_review_vehicle(uuid,text,text),
  admin_mark_vehicle_lost(uuid,text), admin_set_schedule(uuid,timestamptz,text), admin_cancel_challenge(uuid,text,boolean),
  admin_declare_forfeit(uuid,uuid,text), admin_record_race_result(uuid,uuid,text,text), admin_validate_challenge(uuid,text),
  admin_set_ranking(jsonb,text), admin_apply_sanction(uuid,sanction_type,text,uuid), admin_record_absence(uuid,date,date,text,boolean),
  admin_add_reserve(uuid), admin_remove_reserve(uuid,text), admin_promote_reserve(uuid,int), admin_create_warmup(timestamptz,uuid),
  admin_warmup_participant(uuid,uuid,boolean), admin_warmup_status(uuid,warmup_status), admin_record_warmup_winner(uuid,uuid,text),
  admin_validate_warmup(uuid), admin_enter_blacklist(uuid,boolean), admin_confirm_payment(uuid,text,text), admin_set_reward_clip(uuid,text),
  run_alerts() to authenticated;
