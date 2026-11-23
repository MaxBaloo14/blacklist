-- 0017 : retire le circuit de test « Winewood Sprint » (nom enregistré en majuscules, ignoré par 0016).
delete from race_tracks where lower(name) = 'winewood sprint' and route_path is null;
