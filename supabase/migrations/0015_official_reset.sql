-- 0015 : remise à zéro pour l'ouverture officielle.
-- Supprime les pilotes de démonstration (tout compte qui n'est pas organisateur) et toute l'activité de compétition :
-- duels, résultats, cash prizes, classement, historique, échauffements, sanctions, réserve, absences, notifications, pronostics.
-- Conservés : comptes organisateurs, règles et paramètres, véhicules autorisés (classes), actualités, modèles de messages,
-- journal d'administration, et les 5 plans de course animés. Les 3 anciens circuits de départ sont retirés.
do $$
begin
  -- compétition (ordre imposé par les clés étrangères)
  delete from reward_payments;
  delete from rewards;
  delete from race_results;
  delete from challenge_races;
  delete from challenges;
  delete from warmup_participants;
  delete from warmup_events;
  delete from sanctions;
  delete from duel_predictions;
  delete from reserve_drivers;
  delete from absences;
  delete from ranking_history;
  update blacklist_rankings set driver_id = null;

  -- anciens circuits de départ
  delete from race_tracks where route_path is null and name in ('Last Race — La Mesa', 'Cypress Loop', 'Palomino Run');

  -- comptes non organisateurs (supprime en cascade profil, véhicules, notifications, abonnements push)
  delete from auth.users where id not in (select user_id from user_roles);

  -- les organisateurs repartent d'un état neutre côté compétition
  delete from notifications;
  update profiles set blacklist_entered_at = null, last_duel_at = null, inactivity_alerted_at = null;
end $$;
