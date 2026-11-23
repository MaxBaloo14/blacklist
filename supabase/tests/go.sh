#!/bin/bash
# Recrée la base, applique les migrations puis joue tous les scénarios. Sortie condensée.
cd "$(dirname "$0")"
./run.sh >/dev/null 2>/tmp/run_err.txt || { cat /tmp/run_err.txt; exit 1; }
cat 0*_scenarios.sql 0[2-9]_*.sql 1[0-9]_*.sql 2>/dev/null > /tmp/all_scen.sql || cp 01_scenarios.sql /tmp/all_scen.sql
su postgres -c "psql -q -t -A -d bl_test -f /tmp/all_scen.sql" 2>&1 | grep -E "NOTICE|ERROR|FAIL|^###|DETAIL|CONTEXT|LINE" | sed -e 's/psql:[^ ]* //' -e 's/NOTICE:  //'
