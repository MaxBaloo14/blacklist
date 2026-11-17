-- 0005 : circuits de départ (modifiables ou supprimables depuis le Control Center > Race tracks)
-- Idempotent : un circuit déjà présent (même nom) n'est pas recréé.
insert into race_tracks (name, race_type, start_point, end_point, distance_km, difficulty, status, description)
select v.name, v.race_type, v.start_point, v.end_point, v.distance_km, v.difficulty, v.status, v.description
from (values
  ('Last Race — La Mesa', 'Last Race',    'La Mesa',       'Port',          7.8::numeric,  'Hard',    'active',   'Tracé de la dernière manche des duels du podium.'),
  ('Cypress Loop',        'Circuit',      'Cypress Flats', 'Cypress Flats', 3.1::numeric,  'Easy',    'active',   'Boucle rapide autour de Cypress Flats.'),
  ('Palomino Run',        'Sprint urbain','Palomino',      'Observatoire',  11.4::numeric, 'Extreme', 'inactive', 'Long sprint urbain, actuellement fermé.')
) as v(name, race_type, start_point, end_point, distance_km, difficulty, status, description)
where not exists (select 1 from race_tracks t where t.name = v.name);
