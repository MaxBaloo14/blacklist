-- IBAN bancaire du pilote : sert uniquement à lui verser son Cash Prize.
-- Lisible seulement par le pilote lui-même et les organisateurs (RLS de profiles) ; jamais exposé dans les vues publiques.
alter table profiles add column if not exists bank_iban text;
alter table profiles drop constraint if exists profiles_bank_iban_format;
alter table profiles add constraint profiles_bank_iban_format check (bank_iban is null or (char_length(bank_iban) between 3 and 40 and bank_iban ~ '^[A-Za-z0-9 -]+$'));
grant update (bank_iban) on profiles to authenticated;
