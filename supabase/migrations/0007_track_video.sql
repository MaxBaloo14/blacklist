-- 0007 : vidéo facultative pour un circuit (petite vidéo muette en boucle)
alter table race_tracks add column if not exists video_path text;

-- Le stockage des circuits accepte maintenant les vidéos MP4 / WebM (20 Mo max). Ces limites sont appliquées par Supabase Storage lui-même.
update storage.buckets
   set file_size_limit = 20971520,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
 where id = 'track-images';
