#!/bin/bash
# Test de restauration d'une sauvegarde chiffrée (jamais sur la vraie base).
#   BACKUP_PASSPHRASE=… bash scripts/restore-test.sh <dossier contenant backup-AAAA-MM-JJ.tar.gz.gpg>
# Déchiffre, recrée une base jetable (stub Supabase), rejoue schéma + comptes + données, puis COMPARE le nombre de lignes
# de chaque table avec le contenu de la sauvegarde. Code de sortie non nul au moindre écart. Aucun contenu n'est affiché (comptes seulement).
# Variables : PGHOST/PGPORT/PGUSER/PGPASSWORD pour joindre PostgreSQL (par défaut : socket local, utilisateur postgres).
set -uo pipefail
SRC="${1:?Dossier de la sauvegarde manquant}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
DB="restore_check"
SU=0; [ -z "${PGHOST:-}" ] && [ "$(id -u)" = 0 ] && SU=1   # en root local : on passe par l'utilisateur postgres

FILE="$(ls -1 "$SRC"/backup-*.tar.gz.gpg 2>/dev/null | sort | tail -1)"
[ -n "$FILE" ] || { echo "ÉCHEC : aucun fichier backup-*.tar.gz.gpg dans $SRC"; exit 1; }
echo "Sauvegarde testée : $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d -o "$WORK/b.tar.gz" "$FILE" 2>/dev/null || { echo "ÉCHEC : déchiffrement impossible (phrase secrète incorrecte ou fichier corrompu)"; exit 1; }
mkdir "$WORK/out" && tar -xzf "$WORK/b.tar.gz" -C "$WORK/out" || { echo "ÉCHEC : archive illisible"; exit 1; }
for f in schema.sql data-public.sql; do [ -s "$WORK/out/$f" ] || { echo "ÉCHEC : $f absent ou vide"; exit 1; }; done
chmod -R a+rX "$WORK"; chmod a+x "$WORK"

# base jetable + stub (rôles, schéma auth/storage minimal)
if [ "$SU" = 1 ]; then
  su postgres -c "psql -X -q -c 'drop database if exists $DB' -c 'create database $DB'"
  su postgres -c "psql -X -q -d $DB -f $HERE/supabase/tests/00_stub.sql" >/dev/null 2>&1
else
  psql -X -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
  psql -X -q -d "$DB" -f "$HERE/supabase/tests/00_stub.sql" >/dev/null 2>&1
fi
apply() { # fichier -> nombre d'erreurs SQL tolérées (extensions/rôles propres à Supabase)
  local f="$1" log="$WORK/$(basename "$1").log"
  if [ "$SU" = 1 ]; then su postgres -c "psql -X -q -d $DB -f $f" >"$log" 2>&1; else psql -X -q -d "$DB" -f "$f" >"$log" 2>&1; fi
  grep -c "ERROR" "$log" || true
}
q() { if [ "$SU" = 1 ]; then su postgres -c "psql -X -At -d $DB -c \"$1\""; else psql -X -At -d "$DB" -c "$1"; fi; }

E1=$(apply "$WORK/out/schema.sql"); echo "schéma rejoué ($E1 erreur(s) tolérée(s))"
if [ -s "$WORK/out/data-auth.sql" ]; then
  # la vraie table auth.users a plus de colonnes que le stub : on ajoute (en texte) celles que la sauvegarde remplit
  cols=$(grep -m1 -E '^COPY "?auth"?\."?users"? ' "$WORK/out/data-auth.sql" | sed -E 's/^[^(]*\(//; s/\).*$//; s/"//g; s/, /\n/g')
  for c in $cols; do q "alter table auth.users add column if not exists \\\"$c\\\" text" >/dev/null 2>&1; done
  E2=$(apply "$WORK/out/data-auth.sql"); echo "comptes rejoués ($E2 erreur(s))"; else echo "pas de fichier de comptes (data-auth.sql) : les mots de passe ne seraient PAS restaurés"; fi
E3=$(apply "$WORK/out/data-public.sql"); echo "données rejouées ($E3 erreur(s))"

# comparaison : lignes attendues (COPY de la sauvegarde) / lignes présentes
count_copy() { awk -v pat="$2" '$0 ~ "^COPY \"?" pat "\"?\\.\"?" {gsub(/^COPY "?[a-z_]+"?\."?/,""); split($0,a,/[" (]/); t=a[1]; f=1; n[t]=0; next} /^\\\./{f=0; next} f{n[t]++} END{for(k in n) print k, n[k]}' "$1"; }
FAIL=0; TOTAL=0
while read -r table expected; do
  [ -z "$table" ] && continue
  got=$(q "select count(*) from public.\\\"$table\\\"" 2>/dev/null || echo "?")
  TOTAL=$((TOTAL + 1))
  if [ "$got" != "$expected" ]; then echo "ÉCART : public.$table attendu=$expected restauré=$got"; FAIL=1; fi
done < <(count_copy "$WORK/out/data-public.sql" public)
if [ -s "$WORK/out/data-auth.sql" ]; then
  exp=$(count_copy "$WORK/out/data-auth.sql" auth | awk '$1=="users"{print $2}'); got=$(q "select count(*) from auth.users" 2>/dev/null || echo "?")
  [ "${exp:-0}" = "$got" ] || { echo "ÉCART : auth.users attendu=${exp:-0} restauré=$got"; FAIL=1; }
fi
for t in profiles challenges race_tracks point_balances; do
  [ "$(q "select to_regclass('public.$t') is not null")" = "t" ] || { echo "MANQUE : la table public.$t n'existe pas après restauration"; FAIL=1; }
done
echo "profils restaurés : $(q 'select count(*) from public.profiles' 2>/dev/null) · comptes : $(q 'select count(*) from auth.users' 2>/dev/null) · tables comparées : $TOTAL"
if [ "$SU" = 1 ]; then su postgres -c "psql -X -q -c 'drop database if exists $DB'"; else psql -X -q -d postgres -c "drop database if exists $DB"; fi
[ "$FAIL" = 0 ] && echo "RESTAURATION VÉRIFIÉE : toutes les tables correspondent à la sauvegarde." || { echo "RESTAURATION INCOMPLÈTE : voir les écarts ci-dessus."; exit 1; }
