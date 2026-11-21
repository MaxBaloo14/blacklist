#!/usr/bin/env python3
"""
Extrait le tracé ROUGE d'un « plan de course » (image) et le convertit en chemin SVG, du DÉPART (étiquette START) vers l'ARRIVÉE (médaille).
Sert à animer une petite voiture qui suit exactement le tracé sur la page Circuits.

  python3 tools/routes/extract_routes.py tools/routes/courses.json --debug /tmp/debug

Prérequis : Python 3, numpy, scipy, scikit-image, Pillow.
Le fichier de configuration liste pour chaque image : le fichier, un point près de la médaille (arrivée), et les zones du cadre à ignorer.
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, disk

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def red_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 185) & (g < 90) & (b < 90) & (r - g > 110)


def find_start_label(a, hint, pad=150):
    """Étiquette START : rectangle rouge sombre (plus sombre que le tracé). Renvoie (x0, y0, x1, y1)."""
    x, y = hint
    y0, x0 = max(0, y - 90), max(0, x - pad)
    reg = a[y0:y + 90, x0:x + pad]
    r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
    dark = (r > 110) & (r < 200) & (g < 45) & (b < 45)
    lab, k = ndi.label(ndi.binary_closing(dark, iterations=2))
    if k == 0: raise SystemExit("étiquette START introuvable")
    j = int(np.argmax(ndi.sum(dark, lab, range(1, k + 1)))) + 1
    sl = ndi.find_objects(lab)[j - 1]
    return (x0 + sl[1].start, y0 + sl[0].start, x0 + sl[1].stop, y0 + sl[0].stop)


def neighbors(sk, p):
    y, x = p
    return [(y + dy, x + dx) for dy, dx in N8 if 0 <= y + dy < sk.shape[0] and 0 <= x + dx < sk.shape[1] and sk[y + dy, x + dx]]


def prune(sk, min_len):
    """Supprime les petites branches parasites (moins de min_len pixels) qui se terminent en cul-de-sac."""
    sk = sk.copy()
    for _ in range(3):
        ends = [(y, x) for y, x in zip(*np.nonzero(sk)) if len(neighbors(sk, (y, x))) == 1]
        removed = False
        for e in ends:
            branch, prev, cur = [e], None, e
            while True:
                nb = [q for q in neighbors(sk, cur) if q != prev and q not in branch]
                if len(nb) != 1: break
                prev, cur = cur, nb[0]
                if len(neighbors(sk, cur)) > 2: break
                branch.append(cur)
                if len(branch) > min_len: break
            if len(branch) <= min_len and len(nb) >= 1:   # branche courte rattachée à un carrefour
                for q in branch: sk[q] = False
                removed = True
        if not removed: break
    return sk


def lookahead(sk, start, banned, steps=14):
    """Direction moyenne en avançant de `steps` pixels depuis `start` sans repasser par `banned`."""
    cur, seen = start, set(banned) | {start}
    pts = [start]
    for _ in range(steps):
        nb = [q for q in neighbors(sk, cur) if q not in seen]
        if not nb: break
        cur = min(nb, key=lambda q: (q[0] - cur[0]) ** 2 + (q[1] - cur[1]) ** 2)
        seen.add(cur); pts.append(cur)
    return pts


def trace(sk, start, finish_pts, gap=70, max_steps=60000):
    """Suit le tracé pixel par pixel. Franchit les petites coupures (lignes blanches qui passent dessus), repart en arrière dans les
    impasses (aller-retour sur une même rue) et traverse les croisements en allant tout droit."""
    pix = np.array(np.nonzero(sk)).T                     # (y, x)
    path, recent = [start], [start]
    visits = {start: 1}
    visited = {start}
    finish_set = set(finish_pts)
    junction = {tuple(p) for p in pix if len(neighbors(sk, tuple(p))) >= 3}
    for _ in range(max_steps):
        cur = path[-1]
        if cur in finish_set and len(path) > 30: break
        cand = [q for q in neighbors(sk, cur) if q not in recent[-25:]]
        if not cand:
            # 1) coupure dans le tracé : on saute vers le morceau non parcouru le plus proche
            unv = np.array([p for p in pix if tuple(p) not in visited])
            if len(unv) == 0: break
            dd = np.hypot(unv[:, 0] - cur[0], unv[:, 1] - cur[1])
            k = int(np.argmin(dd))
            if dd[k] <= gap:
                tgt = tuple(int(v) for v in unv[k])
                n = int(dd[k]) + 1
                for t in range(1, n):   # petit segment droit
                    q = (int(round(cur[0] + (tgt[0] - cur[0]) * t / n)), int(round(cur[1] + (tgt[1] - cur[1]) * t / n)))
                    path.append(q)
                path.append(tgt); visited.add(tgt); recent = [tgt]; visits[tgt] = 1
                continue
            # 2) impasse : on revient en arrière jusqu'au dernier carrefour s'il reste du tracé à découvrir
            if len(unv) < 40: break
            back = []
            for q in reversed(path[:-1]):
                back.append(q)
                if q in junction and len(back) > 6: break
            else:
                break
            path.extend(back); recent = list(back[-25:])
            continue
        back_pt = path[-min(len(path), 14)]
        hv = np.array([cur[0] - back_pt[0], cur[1] - back_pt[1]], float)
        nrm = np.linalg.norm(hv)
        hv = hv / nrm if nrm else hv
        best, bs = None, -9
        for q in cand:
            la = lookahead(sk, q, recent[-25:] + [cur])
            v = np.array([la[-1][0] - cur[0], la[-1][1] - cur[1]], float)
            n2 = np.linalg.norm(v)
            if n2 == 0: score = -1
            else:
                score = float(hv @ (v / n2)) if nrm else 0.0
                score += 0.01 * min(len(la), 14) - 0.35 * visits.get(q, 0)   # on préfère ce qui n'a pas encore été parcouru
            if score > bs: best, bs = q, score
        path.append(best); recent.append(best); visited.add(best); visits[best] = visits.get(best, 0) + 1
    return path


def smooth_resample(path, win=17, step=8.0):
    P = np.array([(x, y) for y, x in path], float)
    k = win // 2
    padded = np.vstack([np.repeat(P[:1], k, 0), P, np.repeat(P[-1:], k, 0)])
    sm = np.vstack([padded[i:i + win].mean(0) for i in range(len(P))])
    sm[0], sm[-1] = P[0], P[-1]
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(sm, axis=0).T))]
    n = max(8, int(d[-1] // step))
    t = np.linspace(0, d[-1], n)
    return np.c_[np.interp(t, d, sm[:, 0]), np.interp(t, d, sm[:, 1])], float(d[-1])


def to_svg(pts):
    """Courbe lisse (Catmull-Rom → Bézier) : la voiture tourne sans à-coups."""
    P = np.vstack([pts[0], pts, pts[-1]])
    d = [f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = p1 + (p2 - p0) / 6.0; c2 = p2 - (p3 - p1) / 6.0
        d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    return "".join(d)


def process(cfg, base, debug_dir):
    im = Image.open(os.path.join(base, cfg["file"])).convert("RGB")
    a = np.asarray(im).astype(int); H, W = a.shape[:2]
    label = find_start_label(a, tuple(cfg["start_hint"]))
    m = red_mask(a)
    for x0, y0, x1, y1 in cfg.get("exclude", []): m[y0:y1, x0:x1] = False
    lx0, ly0, lx1, ly1 = label; m[max(0, ly0 - 8):ly1 + 8, max(0, lx0 - 8):lx1 + 8] = False
    rad = cfg.get("close", 4)
    mc = ndi.binary_closing(m, structure=disk(rad))
    # on ne comble que les TOUT PETITS trous (flèches blanches dessinées sur le tracé) : les vraies boucles étroites doivent rester des boucles
    holes = ndi.binary_fill_holes(mc) & ~mc
    hl, hk = ndi.label(holes)
    if hk:
        hs = ndi.sum(holes, hl, range(1, hk + 1))
        mc = mc | np.isin(hl, [i + 1 for i, v in enumerate(hs) if v <= cfg.get("fill_holes", 1200)])
    lab, k = ndi.label(mc, structure=np.ones((3, 3)))
    sizes = ndi.sum(mc, lab, range(1, k + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= max(sizes) * cfg.get("keep_ratio", 0.04)]
    mc = np.isin(lab, keep)
    sk = skeletonize(mc)
    sk = prune(sk, cfg.get("prune", 22))
    ends = [(y, x) for y, x in zip(*np.nonzero(sk)) if len(neighbors(sk, (y, x))) == 1]
    cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2

    def dist_rect(e):
        y, x = e
        dx = max(lx0 - x, 0, x - lx1); dy = max(ly0 - y, 0, y - ly1)
        return math.hypot(dx, dy)
    mx, my = cfg["finish_hint"]
    start = min(ends, key=dist_rect) if ends else None
    others = [e for e in ends if e != start]
    finish = min(others, key=lambda e: math.hypot(e[1] - mx, e[0] - my)) if others else None
    finish_dist = math.hypot(finish[1] - mx, finish[0] - my) if finish else None
    # on arrête aussi le tracé à tout point du tracé très proche de la médaille si l'arrivée n'est pas un bout du tracé
    finish_pts = [finish] if finish else []
    path = trace(sk, start, finish_pts, gap=cfg.get("gap", 70))
    # le tracé doit commencer près de l'étiquette START : sinon on l'inverse
    if dist_rect(path[0]) > dist_rect(path[-1]): path = path[::-1]
    reached = bool(finish) and any(p in set(finish_pts) for p in path[-3:])
    visited = set(path)
    left = sk.copy()
    for p in visited: left[p] = False
    leftover = int(ndi.binary_dilation(left, iterations=2).sum() and left.sum())
    pts, length = smooth_resample(path)
    out = {"file": cfg["file"], "w": W, "h": H, "path": to_svg(pts), "length": round(length, 1), "start": [round(pts[0][0], 1), round(pts[0][1], 1)],
           "finish": [round(pts[-1][0], 1), round(pts[-1][1], 1)], "reached_finish_endpoint": reached,
           "ends_found": len(ends), "finish_endpoint_distance_to_medal": None if finish_dist is None else round(finish_dist, 1),
           "end_to_medal": round(math.hypot(pts[-1][0] - mx, pts[-1][1] - my), 1), "skeleton_px": int(sk.sum()), "traced_px": len(visited), "leftover_px": int(left.sum())}
    if debug_dir:
        os.makedirs(debug_dir, exist_ok=True)
        ov = im.copy(); d = ImageDraw.Draw(ov)
        d.rectangle([lx0, ly0, lx1, ly1], outline=(255, 255, 0), width=3)
        for e in ends: d.ellipse([e[1] - 9, e[0] - 9, e[1] + 9, e[0] + 9], outline=(255, 128, 0), width=3)
        d.line([tuple(p) for p in pts], fill=(0, 255, 255), width=4)
        for i in range(0, len(pts), max(1, len(pts) // 14)):
            x, y = pts[i]; d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(0, 255, 0))
        d.ellipse([pts[0][0] - 12, pts[0][1] - 12, pts[0][0] + 12, pts[0][1] + 12], outline=(0, 255, 0), width=4)
        d.ellipse([pts[-1][0] - 12, pts[-1][1] - 12, pts[-1][0] + 12, pts[-1][1] + 12], outline=(255, 0, 255), width=4)
        d.ellipse([mx - 14, my - 14, mx + 14, my + 14], outline=(255, 255, 255), width=3)
        for yy, xx in zip(*np.nonzero(left)): ov.putpixel((int(xx), int(yy)), (255, 0, 0))
        ov.save(os.path.join(debug_dir, cfg["file"].rsplit(".", 1)[0] + "-debug.png"))
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("config"); ap.add_argument("--debug"); ap.add_argument("--out", default=None)
    a = ap.parse_args()
    cfg = json.load(open(a.config, encoding="utf-8")); base = os.path.join(os.path.dirname(os.path.abspath(a.config)), cfg.get("dir", "."))
    res = []
    for c in cfg["courses"]:
        r = process(c, base, a.debug)
        res.append({**{k: v for k, v in r.items() if k != "path"}, "path_chars": len(r["path"])})
        c["_result"] = r
        print(json.dumps(res[-1], ensure_ascii=False))
    if a.out: json.dump([c["_result"] for c in cfg["courses"]], open(a.out, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main()
