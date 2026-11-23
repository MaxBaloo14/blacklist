-- 0024 : suppression d'un compte pilote par un super administrateur.

-- Résumé de ce qui sera supprimé (pour la fiche pilote)
create or replace function driver_deletion_info(p_driver uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin();
  return jsonb_build_object(
    'duels',    (select count(*) from challenges where p_driver in (challenger_id, defender_id)),
    'active',   (select count(*) from challenges where p_driver in (challenger_id, defender_id) and status in ('awaiting_schedule','scheduled','awaiting_validation')),
    'rewards',  (select count(*) from rewards where driver_id = p_driver),
    'sanctions',(select count(*) from sanctions where driver_id = p_driver),
    'is_admin', exists (select 1 from user_roles where user_id = p_driver),
    'ranked',   exists (select 1 from blacklist_rankings where driver_id = p_driver));
end $$;
revoke execute on function driver_deletion_info(uuid) from public, anon;
grant execute on function driver_deletion_info(uuid) to authenticated;

-- Suppression définitive du compte. Sans historique : suppression simple. Avec historique de duels, de Cash Prize ou de sanctions :
-- refus, sauf si « p_force » (le dossier du pilote et ses duels sont alors supprimés avec lui). Jamais pendant un duel en cours, jamais un organisateur, jamais soi-même.
create or replace function admin_delete_account(p_driver uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare info jsonb; nm text;
begin
  perform _require_admin(); perform _lock();
  if not is_super_admin() then raise exception 'Seul un super administrateur peut supprimer un compte.' using errcode = '42501'; end if;
  if p_driver = auth.uid() then raise exception 'Tu ne peux pas supprimer ton propre compte.'; end if;
  if not exists (select 1 from profiles where id = p_driver) then raise exception 'Pilote introuvable.'; end if;
  info := driver_deletion_info(p_driver);
  if (info ->> 'is_admin')::boolean then raise exception 'Ce compte est un organisateur : retire d''abord ses droits.'; end if;
  if (info ->> 'active')::int > 0 then raise exception 'Un duel est en cours pour ce pilote : annule-le d''abord.'; end if;
  if ((info ->> 'duels')::int + (info ->> 'rewards')::int + (info ->> 'sanctions')::int) > 0 and not p_force then
    raise exception 'Ce pilote a un historique (% duel(s), % Cash Prize, % sanction(s)). Bannis-le plutôt pour le conserver, ou supprime-le avec son historique.', info ->> 'duels', info ->> 'rewards', info ->> 'sanctions';
  end if;
  nm := _name(p_driver);
  if p_force then
    delete from reward_payments where reward_id in (select id from rewards where driver_id = p_driver or challenge_id in (select id from challenges where p_driver in (challenger_id, defender_id)));
    delete from rewards where driver_id = p_driver or challenge_id in (select id from challenges where p_driver in (challenger_id, defender_id));
    delete from race_results where winner_id = p_driver;
    delete from challenges where p_driver in (challenger_id, defender_id);     -- les manches et résultats suivent (cascade)
    delete from sanctions where driver_id = p_driver;
    update warmup_events set winner_id = null where winner_id = p_driver;
  end if;
  delete from auth.users where id = p_driver;     -- profil, véhicules, notifications, zigollars, paris, commandes… suivent (cascade)
  perform _log('account:delete', 'profile', p_driver::text, jsonb_build_object('name', nm, 'force', p_force, 'history', info));
end $$;
revoke execute on function admin_delete_account(uuid, boolean) from public, anon;
grant execute on function admin_delete_account(uuid, boolean) to authenticated;
