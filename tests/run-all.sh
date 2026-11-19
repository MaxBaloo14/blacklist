#!/bin/bash
# Lance TOUS les tests dans un environnement isolé et jetable : base PostgreSQL de test, faux Supabase, site compilé, navigateur.
# Aucun accès à la vraie base ni aux vrais secrets. Code de sortie non nul si un seul test échoue.
#   bash tests/run-all.sh          # tout
#   bash tests/run-all.sh quick    # sans le build ni les parcours navigateur (unitaires + base de données)
cd "$(dirname "$0")/.."
MODE="${1:-full}"
FAILED=(); PASSED=(); T0=$(date +%s)
run() {
  local name="$1"; shift
  local s=$(date +%s)
  echo; echo "━━━━ $name"
  if "$@" > "/tmp/test-$$.log" 2>&1; then PASSED+=("$name ($(( $(date +%s) - s )) s)"); tail -n 3 "/tmp/test-$$.log" | sed 's/^/   /'
  else FAILED+=("$name"); echo "   ÉCHEC — dernières lignes :"; grep -E "FAIL|ERROR|Error" "/tmp/test-$$.log" | head -12 | sed 's/^/   /'; tail -n 5 "/tmp/test-$$.log" | sed 's/^/   /'; fi
}
dbcheck() { out=$(bash supabase/tests/go.sh 2>&1); echo "$out" | tail -4; echo "$out" | grep -qE "^ERROR|FAIL  " && return 1; echo "$out" | grep -q "TOUS LES SCÉNARIOS PASSENT (push inclus)"; }

run "Types TypeScript" npx tsc --noEmit
run "Tests unitaires (clips, CSV…)" bash -c 'for f in tests/unit/*.test.mjs; do node --experimental-strip-types "$f" || exit 1; done'
run "Base de données : règles, droits d'accès, sécurité (RLS)" dbcheck

if [ "$MODE" != "quick" ]; then
  mkdir -p /tmp/e2e-media /tmp/shots/e2e
  [ -f /tmp/e2e-media/circuit.webm ] || ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=24:duration=3" -c:v libvpx -b:v 400k /tmp/e2e-media/circuit.webm 2>/dev/null
  head -c 21500000 /dev/zero > /tmp/e2e-media/big.mp4; printf 'pas une video, juste du texte' > /tmp/e2e-media/fake.mp4
  run "Préparation : base + faux Supabase + site compilé + 5 pilotes + duels" bash tests/e2e/fixture.sh build
  for spec in p00-flow p16 p17 p19 p20 p21 p22 p23 p25 p6 p7; do run "Parcours navigateur : $spec" node tests/e2e/$spec.mjs; done
  run "Accessibilité (WCAG 2.1 AA) sur 21 pages" node tests/e2e/axe.mjs
  run "Téléphone : aucune page ne déborde" node tests/e2e/mobile.mjs
  run "Anglais : aucun texte resté en français" node tests/e2e/en-scan.mjs
fi

echo; echo "════════════════════════════════════════"
echo "Durée : $(( $(date +%s) - T0 )) s — ${#PASSED[@]} réussi(s), ${#FAILED[@]} échec(s)"
for n in "${PASSED[@]}"; do echo "  ✓ $n"; done
for n in "${FAILED[@]}"; do echo "  ✗ $n"; done
[ ${#FAILED[@]} -eq 0 ]
