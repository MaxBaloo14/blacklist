# Tests automatiques et mise en ligne sans risque

## Lancer tous les tests
```bash
npm test            # tout : types, unitaires, base de données, parcours navigateur, accessibilité, téléphone, anglais
npm run test:quick  # rapide : types + unitaires + base de données
```
Les tests utilisent un environnement **isolé et jetable** (base PostgreSQL de test, faux Supabase, site compilé, navigateur).
Ils ne touchent **jamais** à la vraie base ni aux vrais secrets.

## Ce qui est vérifié
- **Base de données (RLS)** : règles du classement, défis, résultats, primes, IBAN privé, pronostics, rappels, notifications push, droits d'accès (visiteur / pilote / organisateur).
- **Parcours complet** : inscription → validation → homologation → classement → défi → date → résultat → validation organisateur → prime.
- **Notifications push** : abonnement, envoi chiffré réel vers un faux service push (déchiffré et contrôlé), nettoyage des appareils disparus, service worker, protections (adresses externes refusées).
- **Clips intégrés** : reconnaissance des liens, cadre isolé, liens inconnus jamais intégrés.
- **Sécurité** : accès refusé aux visiteurs et pilotes sur le Control Center, fonctions d'organisateur inaccessibles, envois invalides rejetés.
- **Accessibilité** (WCAG 2.1 AA, 21 pages), **téléphone** (aucun débordement), **anglais** (aucun texte resté en français).

## Mettre en ligne avec filet de sécurité
1. Envoyer d'abord sur la branche `staging` : `git push origin HEAD:staging`. Les tests automatiques se lancent (onglet *Actions* du dépôt). Aucun déploiement n'a lieu pour cette branche.
2. Si tout est vert, envoyer sur `main` : `git push origin HEAD:main`. Vercel met le site en ligne, et les migrations de base s'appliquent.
3. Si un test est rouge, rien n'est parti en production.
