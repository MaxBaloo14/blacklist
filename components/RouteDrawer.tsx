"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { smoothPath, type Pt } from "@/lib/route";

const MAX_POINTS = 120;

/** Éditeur de tracé sur la carte en noir et blanc.
 *  Clic / toucher dans le vide : pose un point · Clic sur un point : le sélectionne · Glisser un point : le déplace · bouton : supprimer le point.
 *  Premier point = départ, dernier = arrivée. Les valeurs partent dans le formulaire (path, w, h). */
export default function RouteDrawer({ src = "/img/map-base.webp" }: { src?: string }) {
  const t = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [broken, setBroken] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  // l'image peut déjà être chargée avant l'hydratation (cache) : l'événement onLoad serait alors manqué
  useEffect(() => { const i = img.current; if (i?.complete) { if (i.naturalWidth) setSize({ w: i.naturalWidth, h: i.naturalHeight }); else setBroken(true); } }, []);
  // à l'ouverture, la carte est centrée sur la ville (là où se font la plupart des courses)
  useEffect(() => { const b = box.current; if (size && b) { b.scrollLeft = b.scrollWidth * 0.55 - b.clientWidth / 2; b.scrollTop = b.scrollHeight * 0.74 - b.clientHeight / 2; } }, [size]);
  const path = smoothPath(pts);
  const u = size ? size.w / 1000 : 1;

  const toMap = (e: { clientX: number; clientY: number }): Pt | null => {
    if (!size || !wrap.current) return null;
    const r = wrap.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * size.w, y = ((e.clientY - r.top) / r.height) * size.h;
    return [Math.round(Math.max(0, Math.min(size.w, x))), Math.round(Math.max(0, Math.min(size.h, y)))];
  };
  const add = (e: React.MouseEvent) => {
    if (justDragged.current) { justDragged.current = false; return; }
    const p = toMap(e); if (!p) return;
    setSel(null);
    setPts((a) => (a.length >= MAX_POINTS ? a : [...a, p]));
  };
  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { i, moved: false }; justDragged.current = true; setSel(i);   // le clic qui suit ne doit pas poser un nouveau point
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = toMap(e); if (!p) return;
    d.moved = true; setPts((a) => a.map((q, k) => (k === d.i ? p : q)));
  };
  const up = () => { if (drag.current) setTimeout(() => { justDragged.current = false; }, 60); drag.current = null; };
  const removeSel = () => { if (sel === null) return; setPts((a) => a.filter((_, k) => k !== sel)); setSel(null); };

  const last = pts.length - 1;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label={t("Outils de tracé")}>
        <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.4).toFixed(1)))} className="btn btn-ghost btn-sm !px-3" aria-label={t("Dézoomer")}><Minus size={16} /></button>
        <button type="button" onClick={() => setZoom((z) => Math.min(5, +(z + 0.4).toFixed(1)))} className="btn btn-ghost btn-sm !px-3" aria-label={t("Zoomer")}><Plus size={16} /></button>
        <button type="button" onClick={() => { setPts((p) => p.slice(0, -1)); setSel(null); }} disabled={!pts.length} className="btn btn-ghost btn-sm"><Undo2 size={16} /> {t("ANNULER LE DERNIER POINT")}</button>
        <button type="button" onClick={removeSel} disabled={sel === null} className="btn btn-ghost btn-sm"><Trash2 size={16} /> {t("SUPPRIMER LE POINT")}</button>
        <button type="button" onClick={() => { setPts([]); setSel(null); }} disabled={!pts.length} className="btn btn-ghost btn-sm"><RotateCcw size={16} /> {t("TOUT EFFACER")}</button>
        <span className="font-cond ml-auto text-sm tracking-[.14em] text-metal">{pts.length ? t("{n} point(s) posé(s)", { n: pts.length }) : t("Clique sur la carte pour poser le départ")}</span>
      </div>
      <div ref={box} className="route-drawer" tabIndex={0} aria-label={t("Carte à tracer : clique ou touche pour poser les points du parcours")}>
        {broken ? <p className="p-6 text-[#ff8a8a]">{t("La carte n'est pas disponible pour le moment.")}</p> : (
          <div ref={wrap} onClick={add} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ width: `${zoom * 100}%`, position: "relative", cursor: "crosshair" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={img} src={src} alt="" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => setBroken(true)} className="block h-auto w-full select-none" />
            {size && (
              <svg viewBox={`0 0 ${size.w} ${size.h}`} className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} aria-hidden>
                {path && <><path d={path} fill="none" stroke="#000" strokeOpacity=".6" strokeWidth={u * 7} strokeLinecap="round" strokeLinejoin="round" /><path d={path} fill="none" stroke="#e03232" strokeWidth={u * 4} strokeLinecap="round" strokeLinejoin="round" /></>}
                {pts.map((p, i) => (
                  <g key={i} onPointerDown={down(i)} data-point={i} style={{ pointerEvents: "all", cursor: "grab", touchAction: "none" }}>
                    <circle cx={p[0]} cy={p[1]} r={u * 11} fill="transparent" />
                    {i === 0 ? <><circle cx={p[0]} cy={p[1]} r={u * 8} fill="#c62828" stroke={sel === i ? "#ffd84a" : "#fff"} strokeWidth={u * 2.2} /><text x={p[0] + u * 13} y={p[1] + u * 5} fontSize={u * 16} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={u * 2.6} paintOrder="stroke" fontFamily="sans-serif">START</text></>
                      : i === last ? <rect x={p[0] - u * 8} y={p[1] - u * 8} width={u * 16} height={u * 16} fill="#fff" stroke={sel === i ? "#ffd84a" : "#c62828"} strokeWidth={u * 2.4} />
                      : <circle cx={p[0]} cy={p[1]} r={u * 4.2} fill={sel === i ? "#ffd84a" : "#fff"} stroke="#c62828" strokeWidth={u * 1.8} />}
                  </g>
                ))}
              </svg>
            )}
          </div>
        )}
      </div>
      <input type="hidden" name="path" value={path} /><input type="hidden" name="w" value={size?.w ?? ""} /><input type="hidden" name="h" value={size?.h ?? ""} />
      <p className="mt-2 text-xs text-metal">{t("Clique pour poser un point (le premier est le DÉPART, le dernier est l'ARRIVÉE). Glisse un point pour le déplacer, clique dessus puis « Supprimer le point » pour l'enlever. Pose des points rapprochés dans les virages.")}</p>
    </div>
  );
}
