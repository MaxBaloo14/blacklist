// Parcours complet vérifié dans la base : inscription → validation → homologation → classement → défi → date → résultat → validation organisateur → prime.
import { execSync } from "node:child_process";
import { check, BASE } from "./lib.mjs";
const q = (sql) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${sql.replace(/"/g, '\\"')}\\""`).toString().trim();

check("5 pilotes inscrits", q("select count(*) from profiles") === "5");
check("tous les dossiers sont validés par l'organisation", q("select count(*) from profiles where registration_status='validated'") === "5");
check("5 véhicules homologués (jamais sans passage organisateur)", q("select count(*) from vehicles where status='approved'") === "5" && Number(q("select count(*) from vehicle_approvals where decision='approved'")) >= 5);
check("classement : positions 1 à 5 occupées, 6 à 10 vacantes", q("select count(*) from blacklist_rankings where driver_id is not null") === "5" && q("select min(position) from blacklist_rankings where driver_id is null") === "6");
check("duel disputé : #5 a battu #4 puis ils ont échangé leurs places", q("select p.first_name from blacklist_rankings r join profiles p on p.id=r.driver_id where r.position=4") === "Lio" && q("select p.first_name from blacklist_rankings r join profiles p on p.id=r.driver_id where r.position=5") === "Mika");
check("un résultat n'est jamais validé sans organisateur", q("select count(*) from challenges where status='completed' and validated_by is null and id in (select challenge_id from rewards)") === "0");
check("la validation est tracée dans le journal d'audit", Number(q("select count(*) from admin_logs where action='challenge:validate'")) >= 1 && Number(q("select count(*) from admin_logs where action='race:result'")) >= 1);
check("Cash Prize du rang battu créé pour le vainqueur (en attente de paiement)", q("select r.amount||'/'||r.status from rewards r join profiles p on p.id=r.driver_id where p.first_name='Lio'") === "800000/pending");
check("le pilote gagnant est notifié", Number(q("select count(*) from notifications n join profiles p on p.id=n.user_id where p.first_name='Lio' and n.kind in ('duel_won','reward','ranking_changed')")) >= 1);
check("historique du classement alimenté", Number(q("select count(*) from ranking_history")) >= 2);
// Sécurité côté API : un pilote ne peut pas appeler une action d'organisateur, un visiteur ne lit pas les primes
const anon = await fetch("http://127.0.0.1:54321/rest/v1/rewards?select=amount", { headers: { apikey: "sb_publishable_e2e" } });
check("visiteur anonyme : aucune prime lisible", anon.ok && (await anon.json()).length === 0);
const rpc = await fetch("http://127.0.0.1:54321/rest/v1/rpc/admin_set_ranking", { method: "POST", headers: { apikey: "sb_publishable_e2e", "content-type": "application/json" }, body: "{}" });
check("fonction d'organisateur inaccessible aux visiteurs", rpc.status >= 400);
const home = await fetch(BASE + "/"); check("le site répond", home.ok);
