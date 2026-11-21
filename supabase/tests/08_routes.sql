\echo ''
\echo '### 20. Plans de course avec tracé animé'
reset role;
select t_eq('5 plans de course créés', (select count(*) from race_tracks where route_path is not null)::text, '5');
select t_eq('chaque plan a une image du site et des dimensions', (select count(*) from race_tracks where route_path is not null and image_path like '/img/circuits/course-%.webp' and route_w > 0 and route_h > 0)::text, '5');
select t_eq('les tracés sont de vrais chemins (plus de 50 courbes)', (select count(*) from race_tracks where route_path is not null and array_length(string_to_array(route_path, 'C'), 1) > 50)::text, '5');
select t_eq('distance facultative : null accepté', (select count(*) from race_tracks where route_path is not null and distance_km is null)::text, '5');
select t_fail($$insert into race_tracks(name,start_point,end_point,difficulty,race_type,route_path,route_w,route_h) values ('Piège','A','B','Easy','Circuit','M0 0<script>',100,100)$$, 'tracé contenant du code refusé');
select t_fail($$insert into race_tracks(name,start_point,end_point,difficulty,race_type,route_path,route_w,route_h) values ('Piège2','A','B','Easy','Circuit','M0 0 C1 1 2 2 3 3',0,100)$$, 'dimensions nulles refusées');
select t_ok($$insert into race_tracks(name,start_point,end_point,difficulty,race_type,route_path,route_w,route_h) values ('Valide','A','B','Easy','Circuit','M0 0 C1 1 2 2 3 3',100,100)$$, 'tracé valide accepté');
select t_anon();
select t_eq('un visiteur lit les plans de course', (select count(*) from race_tracks where route_path is not null)::text, '6');
select t_rows('un visiteur ne modifie pas un tracé', $$update race_tracks set route_path = 'M0 0 C1 1 2 2 3 3' where name = 'Course 1'$$, 0);
select t_as(22);
select t_rows('un pilote ne modifie pas un tracé', $$update race_tracks set route_path = 'M0 0 C1 1 2 2 3 3' where name = 'Course 1'$$, 0);
reset role;
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (plans de course inclus)'
