-- ===== Pronostics : un pilote connecté vote pour le gagnant d'un duel programmé (un vote par duel, modifiable jusqu'au départ) =====
create table if not exists duel_predictions (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  pick         text not null check (pick in ('challenger','defender')),
  created_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table duel_predictions enable row level security;
drop policy if exists predictions_own_read on duel_predictions;
create policy predictions_own_read on duel_predictions for select using (user_id = auth.uid());
revoke all on duel_predictions from anon, authenticated;
grant select on duel_predictions to authenticated;   -- limité à ses propres votes par la RLS ; l'écriture passe uniquement par predict_duel()

create or replace function predict_duel(p_challenge uuid, p_pick text) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_pick not in ('challenger','defender') then raise exception 'Choix invalide.'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and account_status = 'active') then raise exception 'Compte inactif.'; end if;
  select * into c from challenges where id = p_challenge;
  if c.id is null or c.status <> 'scheduled' or c.scheduled_at is null or c.scheduled_at <= now() then raise exception 'Les pronostics sont fermés pour ce duel.'; end if;
  if auth.uid() in (c.challenger_id, c.defender_id) then raise exception 'Tu ne peux pas pronostiquer ton propre duel.'; end if;
  insert into duel_predictions (challenge_id, user_id, pick) values (p_challenge, auth.uid(), p_pick)
    on conflict (challenge_id, user_id) do update set pick = excluded.pick, created_at = now();
end $$;
revoke execute on function predict_duel(uuid, text) from public, anon;
grant execute on function predict_duel(uuid, text) to authenticated;

-- Totaux publics (aucun votant identifiable)
create or replace view public_predictions as
select challenge_id,
       count(*) filter (where pick = 'challenger')::int as challenger_votes,
       count(*) filter (where pick = 'defender')::int   as defender_votes
from duel_predictions group by challenge_id;
revoke all on public_predictions from anon, authenticated;
grant select on public_predictions to anon, authenticated;

-- ===== Modèles de messages de l'organisation (motifs de refus, d'annulation…) =====
create table if not exists message_templates (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('registration','vehicle','duel')),
  title      text not null check (char_length(title) between 2 and 80),
  body       text not null check (char_length(body) between 3 and 300),
  created_at timestamptz not null default now()
);
alter table message_templates enable row level security;
drop policy if exists templates_admin_all on message_templates;
create policy templates_admin_all on message_templates for all using (is_admin()) with check (is_admin());
revoke all on message_templates from anon;
grant select, insert, update, delete on message_templates to authenticated;   -- limité aux organisateurs par la RLS

insert into message_templates (kind, title, body)
select * from (values
  ('registration', 'Numéro de téléphone injoignable', 'Ton numéro de téléphone semble invalide ou injoignable : corrige-le dans ton profil puis recontacte l''organisation.'),
  ('registration', 'Dossier incomplet', 'Ton dossier est incomplet : vérifie ton nom, ton prénom et ton numéro, puis recontacte l''organisation.'),
  ('registration', 'Compte en double', 'Un compte existe déjà à ton nom : utilise-le pour te connecter.'),
  ('vehicle', 'Catégorie interdite', 'Cette catégorie de véhicule est interdite : choisis un véhicule d''une catégorie autorisée.'),
  ('vehicle', 'Véhicule de boutique', 'Les véhicules de boutique ne sont pas autorisés : propose un véhicule non issu de la boutique.'),
  ('vehicle', 'Modèle incorrect', 'Le modèle indiqué ne correspond pas à un véhicule officiel : corrige la marque et le modèle.'),
  ('duel', 'Pilote injoignable', 'Duel annulé : un des pilotes est resté injoignable malgré les relances de l''organisation.'),
  ('duel', 'Absence justifiée', 'Duel annulé suite à une absence justifiée d''un des pilotes.'),
  ('duel', 'Délai dépassé', 'Duel annulé : la date n''a pas été fixée dans le délai prévu.')
) as v(kind, title, body)
where not exists (select 1 from message_templates);
