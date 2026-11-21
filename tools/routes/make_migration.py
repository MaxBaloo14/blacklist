#!/usr/bin/env python3
"""
Génère la migration SQL qui ajoute les circuits « plan de course » (image + tracé animé) et copie les images dans public/img/circuits.
  python3 tools/routes/make_migration.py tools/routes/courses.json supabase/migrations/0014_course_routes.sql
"""
import json, os, subprocess, sys, tempfile
from PIL import Image

cfg_path, out_sql = sys.argv[1], sys.argv[2]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
cfg = json.load(open(cfg_path, encoding="utf-8")); base = os.path.join(os.path.dirname(os.path.abspath(cfg_path)), cfg.get("dir", "."))
tmp = tempfile.mkdtemp()
res = os.path.join(tmp, "routes.json")
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "extract_routes.py"), cfg_path, "--out", res], check=True, stdout=subprocess.DEVNULL)
routes = json.load(open(res, encoding="utf-8"))
dest = os.path.join(root, "public", "img", "circuits"); os.makedirs(dest, exist_ok=True)

rows = []
for i, (c, r) in enumerate(zip(cfg["courses"], routes), 1):
    im = Image.open(os.path.join(base, c["file"])).convert("RGB")
    im.save(os.path.join(dest, f"course-{i}.webp"), "WEBP", quality=86, method=6)
    md = im.resize((900, round(im.size[1] * 900 / im.size[0])), Image.LANCZOS); md.save(os.path.join(dest, f"course-{i}-md.webp"), "WEBP", quality=82, method=6)
    assert "$" not in r["path"] and "'" not in r["path"]
    rows.append(f"""insert into race_tracks (name, image_path, start_point, end_point, distance_km, difficulty, race_type, status, route_path, route_w, route_h)
select 'Course {i}', '/img/circuits/course-{i}.webp', 'START', 'FINISH', null, 'Medium', 'Sprint urbain', 'active',
       $p${r['path']}$p$, {r['w']}, {r['h']}
where not exists (select 1 from race_tracks where image_path = '/img/circuits/course-{i}.webp');""")

sql = f"""-- Circuits « plan de course » : image de la carte + tracé rouge vectorisé, pour animer une petite voiture du DÉPART à l'ARRIVÉE.
-- Les images sont des fichiers du site (public/img/circuits) : image_path commençant par « / » = fichier statique, sinon fichier du stockage.
-- Le tracé a été extrait automatiquement des images (tools/routes). Les noms, la distance et la difficulté se modifient ensuite dans le Control Center.
alter table race_tracks add column if not exists route_path text, add column if not exists route_w int, add column if not exists route_h int;
alter table race_tracks drop constraint if exists race_tracks_route_check;
alter table race_tracks add constraint race_tracks_route_check check (route_path is null or (route_w > 0 and route_h > 0 and char_length(route_path) < 120000 and route_path ~ '^M[0-9. ,CLMZ-]+$'));
-- La distance n'est pas toujours connue pour une carte : elle devient facultative
alter table race_tracks alter column distance_km drop not null;

{chr(10).join(rows)}
"""
open(out_sql, "w", encoding="utf-8").write(sql)
print(out_sql, f"{len(sql) / 1024:.0f} Ko", [f"{r['length']:.0f}px" for r in routes])
