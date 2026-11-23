\echo ''
\echo '### 22. Réclamations et suggestions de course'
reset role;
select t_anon();
select t_fail($$select submit_claim('Titre valide', 'Un message assez long pour passer', '{}')$$, 'un visiteur ne réclame pas');
select t_fail($$select submit_suggestion('Ma course', null, 'M0 0 C1 1 2 2 3 3', 1000, 1000)$$, 'un visiteur ne suggère pas');
reset role;
select t_as(11);
select t_fail($$select submit_claim('ab', 'Un message assez long pour passer', '{}')$$, 'titre trop court');
select t_fail($$select submit_claim('Titre valide', 'court', '{}')$$, 'message trop court');
select t_fail($$select submit_claim('Titre valide', 'Un message assez long pour passer', array['ftp://x.y/z'])$$, 'lien non http refusé');
select t_fail($$select submit_claim('Titre valide', 'Un message assez long pour passer', array['javascript:alert(1)'])$$, 'lien javascript refusé');
select t_fail($$select submit_claim('Titre valide', 'Un message assez long pour passer', array['https://a.fr/1','https://a.fr/2','https://a.fr/3','https://a.fr/4','https://a.fr/5','https://a.fr/6'])$$, '6 liens refusés (max 5)');
select submit_claim('Résultat contesté', 'Le duel de dimanche a été mal enregistré, voici les preuves.', array['https://medal.tv/clips/abcd1234efgh', 'https://i.imgur.com/photo.png', '']);
select t_ok($$select submit_claim('Autre sujet', 'Un second message tout à fait recevable ici.', '{}')$$, 'deuxième réclamation acceptée');
select t_ok($$select submit_claim('Troisième', 'Un troisième message tout à fait recevable.', '{}')$$, 'troisième réclamation acceptée');
select t_fail($$select submit_claim('Quatrième', 'Un quatrième message tout à fait recevable.', '{}')$$, '4e réclamation en 24 h refusée');
reset role;
select t_eq('liens vides ignorés, 2 liens conservés', (select cardinality(links)::text from claims where title = 'Résultat contesté'), '2');
select t_eq('les organisateurs sont prévenus', (select (count(*) > 0)::text from notifications where kind = 'claim_new'), 'true');
select t_as(12);
select t_eq('un pilote ne voit pas les réclamations des autres', (select count(*)::text from claims), '0');
select t_fail($$update claims set status = 'resolved'$$, 'un pilote ne modifie pas une réclamation');
select t_fail($$insert into claims(user_id,title,message) values (t_uid(12),'Direct','Insertion directe interdite ici.')$$, 'écriture directe interdite');
select t_fail($$select admin_handle_claim((select id from claims limit 1), 'resolved', 'ok ok')$$, 'un pilote ne traite pas une réclamation');
reset role;
select t_as(11); select t_eq('le pilote voit ses 3 réclamations', (select count(*)::text from claims), '3'); reset role;
select t_as(2);
select t_eq('un organisateur voit tout', (select count(*)::text from claims), '3');
select t_fail($$select admin_handle_claim((select id from claims where title = 'Résultat contesté'), 'resolved', '')$$, 'réponse obligatoire pour clore');
select admin_handle_claim((select id from claims where title = 'Résultat contesté'), 'in_progress', null);
select admin_handle_claim((select id from claims where title = 'Résultat contesté'), 'resolved', 'Après visionnage, le résultat est corrigé.');
reset role;
select t_eq('réclamation clôturée avec réponse', (select status || '/' || left(admin_reply, 10) from claims where title = 'Résultat contesté'), 'resolved/Après visi');
select t_eq('le pilote est prévenu', (select count(*)::text from notifications where user_id = t_uid(11) and kind = 'claim'), '2');

-- Suggestions de course
select t_as(13);
select t_fail($$select submit_suggestion('Ma course', null, 'M0 0<script>', 1000, 1000)$$, 'tracé contenant du code refusé');
select t_fail($$select submit_suggestion('Ma course', null, 'M0 0 C1 1 2 2 3 3', 0, 1000)$$, 'dimensions nulles refusées');
select t_fail($$select submit_suggestion('ab', null, 'M0 0 C1 1 2 2 3 3', 1000, 1000)$$, 'nom trop court');
select submit_suggestion('Boucle du port', 'Départ au port, arrivée aux collines.', 'M100 100 C150 120 200 160 260 190 C300 210 350 250 420 300', 2000, 2000);
reset role;
select t_eq('suggestion en attente', (select status from course_suggestions where name = 'Boucle du port'), 'pending');
select t_eq('les organisateurs sont prévenus de la suggestion', (select (count(*) > 0)::text from notifications where kind = 'suggestion_new'), 'true');
select t_as(14); select t_eq('un pilote ne voit pas les suggestions des autres', (select count(*)::text from course_suggestions), '0');
select t_fail($$select admin_handle_suggestion((select id from course_suggestions limit 1), 'accepted', 'x')$$, 'un pilote ne traite pas une suggestion'); reset role;
select t_as(2); select admin_handle_suggestion((select id from course_suggestions where name = 'Boucle du port'), 'accepted', 'Retenue pour la saison.'); reset role;
select t_eq('suggestion acceptée', (select status from course_suggestions where name = 'Boucle du port'), 'accepted');
select t_eq('le pilote est prévenu de la décision', (select count(*)::text from notifications where user_id = t_uid(13) and kind = 'suggestion'), '1');
\echo ''
\echo '### TOUS LES SCÉNARIOS PASSENT (réclamations et suggestions incluses)'
