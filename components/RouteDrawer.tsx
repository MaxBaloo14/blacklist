"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Route as RouteIcon, Trash2, Undo2 } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { smoothPath, type Pt } from "@/lib/route";
import { RoadNet, simplify } from "@/lib/roadnet";
import PlanPreview from "@/components/PlanPreview";
import { routeKm } from "@/lib/plan-geom";

const PLAYER_MAX_POINTS = 60;   // limite des joueurs ; l'organisation passe maxPoints={Infinity}
type Wp = { p: Pt; seg: Pt[] };   // point de passage + tracé depuis le point précédent (suit la route, ou ligne droite en mode libre)

/** Éditeur de tracé sur la carte en noir et blanc.
 *  Mode « Suivre les routes » (par défaut) : chaque clic s'accroche à la route la plus proche et le parcours épouse automatiquement les routes
 *  (plus court chemin) jusqu'au point précédent. Mode libre : ligne droite entre les points.
 *  Glisser un point le déplace, clic sur un point + « Supprimer » l'enlève. Premier point = départ, dernier = arrivée. */
export default function RouteDrawer({ src = "/img/map-base.webp", roads = "/img/map-roads.png", mPerPx = 6.5, initial, maxPoints = PLAYER_MAX_POINTS }: { src?: string; roads?: string; mPerPx?: number; maxPoints?: number; initial?: { points: Pt[]; follow: boolean } }) {
  const t = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [wps, setWps] = useState<Wp[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [broken, setBroken] = useState(false);
  const [follow, setFollow] = useState(true);
  const [net, setNet] = useState<RoadNet | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);
  const swallow = useRef(false);

  // l'image peut déjà être chargée avant l'hydratation (cache) : l'événement onLoad serait alors manqué
  useEffect(() => { const i = img.current; if (i?.complete) { if (i.naturalWidth) setSize({ w: i.naturalWidth, h: i.naturalHeight }); else setBroken(true); } }, []);
  useEffect(() => { let on = true; RoadNet.load(roads).then((n) => on && setNet(n)).catch(() => on && setFollow(false)); return () => { on = false; }; }, [roads]);
  // reprise d'un brouillon ou d'un circuit : les points de passage sont reposés et les tronçons recalculés
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !initial?.points.length || !size) return;
    if (initial.follow && !net) return;   // on attend le réseau routier
    restored.current = true; setFollow(initial.follow);
    const list: Wp[] = [];
    for (const p of initial.points) {
      if (!list.length) { list.push({ p, seg: [] }); continue; }
      const prev = list[list.length - 1].p;
      let seg: Pt[] = [prev, p];
      if (initial.follow && net) { const f2 = net.w / size.w; const r = net.route([Math.round(prev[0] * f2), Math.round(prev[1] * f2)], [Math.round(p[0] * f2), Math.round(p[1] * f2)]); if (r) seg = r.map((q) => [Math.round(q[0] / f2), Math.round(q[1] / f2)] as Pt); }
      list.push({ p, seg });
    }
    setWps(list);
    // la carte se centre sur le parcours repris
    requestAnimationFrame(() => { const b = box.current; if (!b) return; const xs = initial.points.map((q) => q[0]), ys = initial.points.map((q) => q[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2; b.scrollLeft = (cx / size.w) * b.scrollWidth - b.clientWidth / 2; b.scrollTop = (cy / size.h) * b.scrollHeight - b.clientHeight / 2; });
  }, [initial, net, size]);
  // à l'ouverture, la carte est centrée sur la ville (là où se font la plupart des courses)
  useEffect(() => { const b = box.current; if (size && b && !initial?.points.length) { b.scrollLeft = b.scrollWidth * 0.55 - b.clientWidth / 2; b.scrollTop = b.scrollHeight * 0.74 - b.clientHeight / 2; } }, [size]);

  // ligne brisée complète (pendant un déplacement, les deux tronçons voisins sont provisoirement droits)
  const dragI = drag.current?.moved ? drag.current.i : -1;
  const poly: Pt[] = wps.flatMap((w, i) => (i === 0 ? [w.p] : (i === dragI || i === dragI + 1 ? [wps[i - 1].p, w.p] : w.seg)));
  let path = "";
  if (poly.length >= 2) { for (const tol of [1.6, 2.5, 4, 7, 12]) { path = smoothPath(simplify(poly, tol)); if (path.length < 50000) break; } }
  const u = size ? size.w / 1000 : 1;
  const km = path ? routeKm(path, mPerPx) : 0;
  // le réseau routier peut avoir une autre résolution que la carte (carte haute définition) : on convertit dans les deux sens
  const f = net && size ? net.w / size.w : 1;
  const nt = (q: Pt): Pt => [q[0] * f, q[1] * f];
  const mp = (q: Pt): Pt => [Math.round(q[0] / f), Math.round(q[1] / f)];

  const toMap = (e: { clientX: number; clientY: number }): Pt | null => {
    if (!size || !wrap.current) return null;
    const r = wrap.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * size.w, y = ((e.clientY - r.top) / r.height) * size.h;
    return [Math.round(Math.max(0, Math.min(size.w, x))), Math.round(Math.max(0, Math.min(size.h, y)))];
  };
  /** Tronçon entre deux points : suit la route si le mode est actif, sinon ligne droite. Renvoie null (avec message) si impossible. */
  const link = (a: Pt, b: Pt): Pt[] | null => {
    if (!follow || !net) return [a, b];
    const r = net.route(nt(a).map(Math.round) as Pt, nt(b).map(Math.round) as Pt);
    const s = r ? r.map(mp) : null;
    if (!s) { setMsg(t("Ces deux points ne sont pas reliés par la route : choisis un autre endroit, ou désactive « Suivre les routes ».")); return null; }
    return s;
  };

  const add = (e: React.MouseEvent) => {
    if (swallow.current) { swallow.current = false; return; }
    const raw = toMap(e); if (!raw) return;
    setMsg(null); setSel(null);
    if (wps.length >= maxPoints) { setMsg(t("{n} points au maximum : supprime-en ou termine le parcours.", { n: maxPoints })); return; }
    let p = raw;
    if (follow) {
      if (!net) { setMsg(t("Chargement du réseau routier…")); return; }
      const sn = net.snap(nt(raw), Math.round(48 * f));
      const sp = sn ? mp(sn) : null;
      if (!sp) { setMsg(t("Aucune route à cet endroit : clique plus près d'une route, ou désactive « Suivre les routes ».")); return; }
      p = sp;
    }
    if (!wps.length) { setWps([{ p, seg: [] }]); return; }
    const seg = link(wps[wps.length - 1].p, p); if (!seg) return;
    setWps([...wps, { p, seg }]);
  };

  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { i, moved: false }; swallow.current = true; setSel(i); setMsg(null);   // le clic qui suit ne doit pas poser un nouveau point
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const raw = toMap(e); if (!raw) return;
    d.moved = true; setWps((a) => a.map((w, k) => (k === d.i ? { ...w, p: raw } : w)));
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    setTimeout(() => { swallow.current = false; }, 60);
    if (!d?.moved) return;
    // le point est reposé sur la route puis les deux tronçons voisins sont recalculés
    const i = d.i; let list = wps.slice();
    let p = list[i].p; if (follow && net) { const sn = net.snap(nt(p), Math.round(48 * f)); if (sn) p = mp(sn); }
    list[i] = { ...list[i], p };
    if (i > 0) { const s = link(list[i - 1].p, p); if (s) list[i] = { p, seg: s }; }
    if (i + 1 < list.length) { const s = link(p, list[i + 1].p); if (s) list[i + 1] = { ...list[i + 1], seg: s }; }
    setWps(list);
  };
  const removeSel = () => {
    if (sel === null) return;
    const list = wps.filter((_, k) => k !== sel);
    if (sel > 0 && sel < list.length + 0 && list[sel]) { const s = link(list[sel - 1].p, list[sel].p); if (s) list[sel] = { ...list[sel], seg: s }; }
    if (sel === 0 && list[0]) list[0] = { p: list[0].p, seg: [] };
    setWps(list); setSel(null);
  };

  const last = wps.length - 1;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label={t("Outils de tracé")}>
        <button type="button" onClick={() => setFollow((f) => !f)} aria-pressed={follow} className={`btn btn-sm ${follow ? "btn-red" : "btn-ghost"}`}><RouteIcon size={16} /> {follow ? t("SUIVRE LES ROUTES : OUI") : t("SUIVRE LES ROUTES : NON")}</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.4).toFixed(1)))} className="btn btn-ghost btn-sm !px-3" aria-label={t("Dézoomer")}><Minus size={16} /></button>
        <button type="button" onClick={() => setZoom((z) => Math.min(5, +(z + 0.4).toFixed(1)))} className="btn btn-ghost btn-sm !px-3" aria-label={t("Zoomer")}><Plus size={16} /></button>
        <button type="button" onClick={() => { setWps((p) => p.slice(0, -1)); setSel(null); setMsg(null); }} disabled={!wps.length} className="btn btn-ghost btn-sm"><Undo2 size={16} /> {t("ANNULER LE DERNIER POINT")}</button>
        <button type="button" onClick={removeSel} disabled={sel === null} className="btn btn-ghost btn-sm"><Trash2 size={16} /> {t("SUPPRIMER LE POINT")}</button>
        <button type="button" onClick={() => { setWps([]); setSel(null); setMsg(null); }} disabled={!wps.length} className="btn btn-ghost btn-sm"><RotateCcw size={16} /> {t("TOUT EFFACER")}</button>
        <span className="font-cond ml-auto text-sm tracking-[.14em] text-metal">{wps.length ? t("{n} point(s) posé(s)", { n: wps.length }) : t("Clique sur la carte pour poser le départ")}{km > 0 && <b data-distance className="ml-3 text-white">≈ {km.toFixed(1).replace(".", ",")} km</b>}</span>
      </div>
      {msg && <p role="status" className="mb-2 text-sm text-[#ffb3b3]">{msg}</p>}
      <div ref={box} className="route-drawer" tabIndex={0} data-roads={net ? "ready" : "loading"} aria-label={t("Carte à tracer : clique ou touche pour poser les points du parcours")}>
        {broken ? <p className="p-6 text-[#ff8a8a]">{t("La carte n'est pas disponible pour le moment.")}</p> : (
          <div ref={wrap} onClick={add} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ width: `${zoom * 100}%`, position: "relative", cursor: "crosshair" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={img} src={src} alt="" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => setBroken(true)} className="block h-auto w-full select-none" />
            {size && (
              <svg viewBox={`0 0 ${size.w} ${size.h}`} className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} aria-hidden>
                {path && <><path d={path} fill="none" stroke="#000" strokeOpacity=".6" strokeWidth={u * 5.5} strokeLinecap="round" strokeLinejoin="round" /><path d={path} fill="none" stroke="#e03232" strokeWidth={u * 3} strokeLinecap="round" strokeLinejoin="round" /></>}
                {wps.map((w, i) => (
                  <g key={i} onPointerDown={down(i)} data-point={i} style={{ pointerEvents: "all", cursor: "grab", touchAction: "none" }}>
                    <circle cx={w.p[0]} cy={w.p[1]} r={u * 9} fill="transparent" />
                    {i === 0 ? <><circle cx={w.p[0]} cy={w.p[1]} r={u * 4.2} fill="#c62828" stroke={sel === i ? "#ffd84a" : "#fff"} strokeWidth={u * 1.4} /><text x={w.p[0] + u * 7.5} y={w.p[1] + u * 3.6} fontSize={u * 11} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={u * 2} paintOrder="stroke" fontFamily="sans-serif">START</text></>
                      : i === last ? <rect x={w.p[0] - u * 4.2} y={w.p[1] - u * 4.2} width={u * 8.4} height={u * 8.4} fill="#fff" stroke={sel === i ? "#ffd84a" : "#c62828"} strokeWidth={u * 1.6} />
                      : <circle cx={w.p[0]} cy={w.p[1]} r={u * 2.6} fill={sel === i ? "#ffd84a" : "#fff"} stroke="#c62828" strokeWidth={u * 1.3} />}
                  </g>
                ))}
              </svg>
            )}
          </div>
        )}
      </div>
      {size && path && (
        <div className="mt-8">
          <div className="kicker mb-1">{t("APERÇU DU PLAN")}</div>
          <p className="mb-3 text-sm text-[#a5a9b0]">{t("Voici le plan tel qu'il sera publié, avec le cadre BooBoo Crew et la petite voiture qui suit ton parcours. Il se met à jour à chaque point.")}</p>
          <PlanPreview path={path} w={size.w} h={size.h} src={src} />
          {km > 0 && <p className="mt-3 text-center text-sm text-[#a5a9b0]">{t("Distance estimée")} : <b className="text-white">≈ {km.toFixed(1).replace(".", ",")} km</b></p>}
        </div>
      )}
      <input type="hidden" name="points" value={JSON.stringify(wps.map((w) => w.p))} /><input type="hidden" name="follow" value={follow ? "1" : "0"} /><input type="hidden" name="path" value={path} /><input type="hidden" name="w" value={size?.w ?? ""} /><input type="hidden" name="h" value={size?.h ?? ""} />
      <p className="mt-2 text-xs text-metal">{t("Clique sur une route pour poser un point : le parcours suit les routes tout seul jusqu'au point précédent (le premier point est le DÉPART, le dernier est l'ARRIVÉE). Pour passer par une route précise, pose un point dessus. Glisse un point pour le déplacer, clique dessus puis « Supprimer le point » pour l'enlever.")}</p>
    </div>
  );
}
