# Sauvegardes et ping anti-pause

## Ping anti-pause (automatique)
Le workflow **Ping anti-pause** appelle le site toutes les 2 jours (`/api/health`, qui interroge réellement la base).
L'offre gratuite de Supabase met un projet en pause après environ 7 jours sans activité : ce ping l'évite.
Si le site ou la base ne répond plus, le job devient rouge et GitHub envoie un email.

> GitHub désactive les tâches planifiées d'un dépôt resté 60 jours sans aucun changement. Si le site n'est pas modifié pendant longtemps, relance les workflows depuis l'onglet *Actions*.

## Sauvegarde (hebdomadaire, chiffrée)
Le workflow **Sauvegarde de la base** s'exécute chaque dimanche (ou à la main : *Actions > Sauvegarde de la base > Run workflow*).
Il exporte le schéma, les données publiques et les comptes, puis **chiffre** le tout (AES-256) avant de le conserver 90 jours comme *artefact* du workflow.
Le dépôt étant public, une sauvegarde en clair exposerait téléphones et IBAN : elle n'est jamais publiée sans chiffrement.

### Mise en place (une seule fois)
1. GitHub > dépôt > *Settings > Secrets and variables > Actions > New repository secret*
2. Nom : `BACKUP_PASSPHRASE` — valeur : une phrase longue de ton choix. **Note-la dans un endroit sûr** : sans elle, les sauvegardes sont illisibles.

### Télécharger une sauvegarde
*Actions > Sauvegarde de la base > (dernier passage) > Artifacts > sauvegarde-chiffree*. Garde une copie sur ton ordinateur de temps en temps (les artefacts expirent après 90 jours).

### Déchiffrer
```bash
gpg --output backup.tar.gz --decrypt backup-AAAA-MM-JJ.tar.gz.gpg   # demande la phrase BACKUP_PASSPHRASE
mkdir restore && tar -xzf backup.tar.gz -C restore
```

### Restaurer dans un projet Supabase neuf
1. Créer le projet, puis appliquer le schéma : `supabase link --project-ref NOUVEAU_REF && supabase db push`.
2. Charger les comptes puis les données (dans cet ordre, `DB_URL` = adresse de connexion du nouveau projet) :
```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f restore/data-auth.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f restore/data-public.sql
```
3. Mettre à jour les variables Vercel (`NEXT_PUBLIC_SUPABASE_URL`, clés) vers le nouveau projet, puis redéployer.

### Ce qui n'est PAS sauvegardé
Les fichiers du stockage (vidéos des circuits, photos de véhicules) ne sont pas dans cette sauvegarde de base. Les vidéos de circuits sont faciles à renvoyer depuis le Control Center.
