-- 0003 : stockage des photos (Supabase Storage)
-- vehicle-photos : lecture publique (noms UUID non devinables), écriture dans son propre dossier uniquement
-- track-images   : lecture publique, écriture organisateurs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vehicle-photos', 'vehicle-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('track-images',   'track-images',   true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "vehicle photos public read" on storage.objects for select using (bucket_id in ('vehicle-photos','track-images'));
create policy "vehicle photos own upload"  on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vehicle photos own delete"  on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "track images admin write"   on storage.objects for insert to authenticated
  with check (bucket_id = 'track-images' and public.is_admin());
create policy "track images admin update"  on storage.objects for update to authenticated
  using (bucket_id = 'track-images' and public.is_admin());
create policy "track images admin delete"  on storage.objects for delete to authenticated
  using (bucket_id = 'track-images' and public.is_admin());

-- Temps réel pour l'animation du classement (si la publication existe)
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table blacklist_rankings, notifications, challenges;
  end if;
end $$;
