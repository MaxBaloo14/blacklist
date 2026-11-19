-- ===== Notifications push (Web Push) =====
-- Abonnements des appareils : un pilote ne voit et ne gère que les siens.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) between 20 and 600),
  p256dh     text not null,
  auth       text not null,
  lang       text not null default 'fr' check (lang in ('fr','en')),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_sub_own_read on push_subscriptions;
create policy push_sub_own_read on push_subscriptions for select using (user_id = auth.uid());
drop policy if exists push_sub_own_delete on push_subscriptions;
create policy push_sub_own_delete on push_subscriptions for delete using (user_id = auth.uid());
revoke all on push_subscriptions from anon, authenticated;
grant select, delete on push_subscriptions to authenticated;   -- l'écriture passe par le serveur du site, après vérification de la session

-- Clés VAPID du serveur : créées automatiquement au premier usage, jamais lisibles depuis le navigateur (RLS sans aucune règle).
create table if not exists push_keys (
  id          int primary key check (id = 1),
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);
alter table push_keys enable row level security;
revoke all on push_keys from anon, authenticated;

-- Suivi des envois : une notification n'est poussée qu'une seule fois.
alter table notifications add column if not exists push_sent_at timestamptz;

-- À chaque nouvelle notification d'un pilote abonné, on prévient le site (pg_net, appel asynchrone) qui envoie la notification push.
-- Aucun secret : le site ne fait confiance qu'à l'identifiant et relit lui-même la notification ; un échec n'empêche jamais la notification d'être créée.
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponible (%), les notifications push partiront via le rattrapage du site.', sqlerrm;
end $$;

create or replace function _push_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if exists (select 1 from pg_extension where extname = 'pg_net')
       and exists (select 1 from push_subscriptions where user_id = new.user_id) then
      perform net.http_post(
        url := 'https://blacklist-snowy.vercel.app/api/push/dispatch',
        body := jsonb_build_object('id', new.id),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 5000);
    end if;
  exception when others then
    null;   -- la push est un confort : jamais d'erreur côté pilote
  end;
  return new;
end $$;
revoke execute on function _push_dispatch() from public, anon, authenticated;
drop trigger if exists trg_notifications_push on notifications;
create trigger trg_notifications_push after insert on notifications for each row execute function _push_dispatch();
