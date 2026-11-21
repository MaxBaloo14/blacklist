"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { routeEnd, routeLength, routeStart } from "@/lib/route";

type Props = { name: string; src: string; srcSet?: string; sizes?: string; w: number; h: number; path: string; active?: boolean; big?: boolean };

const SPEED = 140;      // vitesse de la voiture, en pixels de l'image par seconde (tranquille : on suit la course)
const HOLD = 3.2;       // pause à l'arrivée avant de repartir

/** Carte d'un circuit : l'image du plan + une petite voiture qui suit le tracé rouge du DÉPART à l'ARRIVÉE, en boucle. */
function RouteCar({ name, src, srcSet, sizes, w, h, path, active = true, big }: Props) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

  // L'animation ne tourne que lorsque la carte est visible (économie de batterie)
  useEffect(() => {
    const el = box.current, s = svg.current;
    if (!el || !s || reduced || !active) return;
    s.pauseAnimations();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) s.unpauseAnimations(); else s.pauseAnimations(); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, active]);

  const len = routeLength(path);
  const dur = Math.max(10, Math.min(36, len / SPEED));
  const cycle = dur + HOLD + 0.7;
  const f = dur / cycle;                                   // part du cycle passée à rouler
  const [sx, sy] = routeStart(path), [ex, ey] = routeEnd(path);
  const sc = w / 1432;                                      // échelle de la carte
  const k = sc * 1.9;                                       // la voiture garde la même taille relative sur toutes les cartes
  const trail = Math.min(0.12, 190 / Math.max(len, 1)) * 1000;
  const fm = (n: number) => n.toFixed(4);
  const car = (
    <g transform={`scale(${k})`}>
      <defs>
        <linearGradient id={`p${id}`} x1="0" y1="-16" x2="0" y2="16" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff5a52" /><stop offset=".45" stopColor="#d32f2f" /><stop offset="1" stopColor="#8e1414" /></linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="-10" x2="0" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3a4757" /><stop offset="1" stopColor="#0c1016" /></linearGradient>
        <linearGradient id={`b${id}`} x1="32" y1="0" x2="104" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff3b0" stopOpacity=".6" /><stop offset="1" stopColor="#fff3b0" stopOpacity="0" /></linearGradient>
        <radialGradient id={`h${id}`}><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      {/* faisceaux des phares */}
      <polygon points="32,-8 106,-30 106,30 32,8" fill={`url(#b${id})`} />
      {/* ombre portée */}
      <ellipse cx="2" cy="6" rx="40" ry="19" fill="#000" opacity=".28" /><ellipse cx="2" cy="5" rx="35" ry="16" fill="#000" opacity=".25" />
      {/* roues */}
      {[[-23, -17.5], [-23, 12.5], [14, -17.5], [14, 12.5]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="14" height="5" rx="2.2" fill="#0b0c0e" stroke="#2c3036" strokeWidth=".8" />)}
      {/* rétroviseurs */}
      <ellipse cx="8" cy="-16.2" rx="2.6" ry="1.7" fill="#a31f1f" stroke="#f4f4f4" strokeWidth=".9" /><ellipse cx="8" cy="16.2" rx="2.6" ry="1.7" fill="#a31f1f" stroke="#f4f4f4" strokeWidth=".9" />
      {/* aileron */}
      <rect x="-37.5" y="-14" width="5" height="28" rx="1.8" fill="#15171b" stroke="#f4f4f4" strokeWidth="1.2" />
      {/* carrosserie */}
      <path data-car="body" d="M-32 -9.5 C-32 -13.5 -25 -15.5 -15 -15.5 L11 -15 C23 -14 30 -10 34 -5.5 C35.8 -3.4 35.8 3.4 34 5.5 C30 10 23 14 11 15 L-15 15.5 C-25 15.5 -32 13.5 -32 9.5 Z" fill={`url(#p${id})`} stroke="#f4f4f4" strokeWidth="2.4" strokeLinejoin="round" />
      {/* bandes de course */}
      <rect x="-30" y="-5" width="62" height="2.6" fill="#f4f4f4" opacity=".95" /><rect x="-30" y="2.4" width="62" height="2.6" fill="#f4f4f4" opacity=".95" />
      {/* vitres et toit */}
      <path d="M7 -10.2 L19 -7.6 L19 7.6 L7 10.2 Z" fill={`url(#g${id})`} stroke="#05070a" strokeWidth=".8" />
      <path d="M-19 -9.6 L-12 -9.8 L-12 9.8 L-19 9.6 Z" fill={`url(#g${id})`} stroke="#05070a" strokeWidth=".8" />
      <rect x="-12" y="-9.2" width="19" height="18.4" rx="4.5" fill="#d32f2f" stroke="#7a1616" strokeWidth="1" />
      <path d="M-9 -7.5 L4 -7.5 L1 -3 L-9 -3 Z" fill="#fff" opacity=".28" />
      {/* feux avant et arrière */}
      <circle cx="33" cy="-6.6" r="5" fill={`url(#h${id})`} /><circle cx="33" cy="6.6" r="5" fill={`url(#h${id})`} />
      <rect x="30.5" y="-8.6" width="4" height="4.2" rx="1.4" fill="#fffbe0" /><rect x="30.5" y="4.4" width="4" height="4.2" rx="1.4" fill="#fffbe0" />
      <rect x="-32.4" y="-9" width="3.2" height="5.4" rx="1" fill="#ff3b3b" /><rect x="-32.4" y="3.6" width="3.2" height="5.4" rx="1" fill="#ff3b3b" />
    </g>
  );
  const animated = active && !reduced;
  return (
    <div ref={box} className="relative w-full overflow-hidden bg-ink3" style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} srcSet={srcSet} sizes={sizes} alt={name} loading={big ? "eager" : "lazy"} decoding="async" className={`absolute inset-0 size-full object-cover ${active ? "" : "grayscale opacity-70"}`} />
      <svg ref={svg} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 size-full" aria-hidden focusable="false">
        <defs><path id={`r${id}`} d={path} /></defs>
        {animated ? (
          <>
            {/* traînée lumineuse qui accompagne la voiture */}
            <path d={path} pathLength={1000} fill="none" stroke="#fff" strokeWidth={14 * sc} strokeLinecap="round" strokeDasharray={`${trail.toFixed(1)} 1000`} style={{ filter: "drop-shadow(0 0 5px #ff3b3b)" }}>
              <animate attributeName="stroke-dashoffset" values={`${trail.toFixed(1)};${(trail - 1000).toFixed(1)};${(trail - 1000).toFixed(1)}`} keyTimes={`0;${fm(f)};1`} dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;.95;.95;0;0" keyTimes={`0;0.02;${fm(f)};${fm(f + 0.02)};1`} dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" />
            </path>
            {/* onde à l'arrivée */}
            <circle cx={ex} cy={ey} r="0" fill="none" stroke="#fff" strokeWidth={6 * sc}>
              <animate attributeName="r" values={`0;0;${(120 * sc).toFixed(0)};${(120 * sc).toFixed(0)}`} keyTimes={`0;${fm(f)};${fm(Math.min(0.99, f + (1 - f) * 0.55))};1`} dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;.95;0;0" keyTimes={`0;${fm(f)};${fm(f + 0.002)};${fm(Math.min(0.99, f + (1 - f) * 0.55))};1`} dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" />
            </circle>
            <g>
              <animateMotion dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="0;1;1" keyTimes={`0;${fm(f)};1`}>
                <mpath href={`#r${id}`} />
              </animateMotion>
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={`0;0.02;${fm(f + (1 - f) * 0.55)};${fm(f + (1 - f) * 0.8)};1`} dur={`${cycle.toFixed(2)}s`} repeatCount="indefinite" />
              {car}
            </g>
          </>
        ) : (
          <g transform={`translate(${sx} ${sy})`}>{car}</g>
        )}
      </svg>
    </div>
  );
}

/** Carte + bouton « Agrandir » (la carte s'ouvre en grand, avec la voiture). */
export default function RouteMap(props: Props) {
  const t = useT();
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <RouteCar {...props} />
      <button type="button" onClick={() => { setOpen(true); dlg.current?.showModal(); }} className="route-zoom" aria-label={`${t("Agrandir la carte")} — ${props.name}`}><Maximize2 size={14} aria-hidden /> {t("AGRANDIR")}</button>
      <dialog ref={dlg} className="route-dialog" aria-label={props.name} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="route-dialog-head"><span className="font-display text-2xl uppercase tracking-wide">{props.name}</span><button type="button" onClick={() => dlg.current?.close()} aria-label={t("Fermer")} className="route-dialog-close"><X size={20} /></button></div>
        <div className="route-dialog-body">{open && <RouteCar {...props} srcSet={undefined} src={props.src.replace(/-md\.webp$/, ".webp")} sizes={undefined} big />}</div>
      </dialog>
    </>
  );
}
