-- Quand un Cash Prize est créé pour un pilote qui n'a pas encore renseigné son IBAN, on le prévient (une seule alerte non lue à la fois).
create or replace function _notify_missing_iban() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.driver_id and bank_iban is null)
     and not exists (select 1 from notifications where user_id = new.driver_id and kind = 'iban_missing' and read_at is null) then
    insert into notifications (user_id, kind, title, body, link)
    values (new.driver_id, 'iban_missing', 'Add your IBAN to receive your Cash Prize',
            'Your Cash Prize of $' || new.amount || ' cannot be paid until you add your bank IBAN in your profile.', '/profile');
  end if;
  return new;
end $$;
revoke execute on function _notify_missing_iban() from public, anon, authenticated;
drop trigger if exists trg_rewards_missing_iban on rewards;
create trigger trg_rewards_missing_iban after insert on rewards for each row execute function _notify_missing_iban();

-- Rattrapage : primes déjà en attente dont le pilote n'a pas d'IBAN
insert into notifications (user_id, kind, title, body, link)
select distinct on (r.driver_id) r.driver_id, 'iban_missing', 'Add your IBAN to receive your Cash Prize',
       'Your Cash Prize of $' || r.amount || ' cannot be paid until you add your bank IBAN in your profile.', '/profile'
from rewards r join profiles p on p.id = r.driver_id
where r.status = 'pending' and p.bank_iban is null
  and not exists (select 1 from notifications n where n.user_id = r.driver_id and n.kind = 'iban_missing' and n.read_at is null)
order by r.driver_id, r.created_at desc;
