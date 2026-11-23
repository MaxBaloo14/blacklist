import { routeBox, routeEnd, routeStart } from "@/lib/route";

/** Aperçu d'un parcours suggéré : la carte recadrée autour du tracé rouge, départ et arrivée repérés. */
export default function RoutePreview({ path, w, h, src = "/img/map-base.webp", label }: { path: string; w: number; h: number; src?: string; label: string }) {
  const b = routeBox(path, w, h);
  const [sx, sy] = routeStart(path), [ex, ey] = routeEnd(path);
  const u = b.w / 100;   // unité relative au cadre
  return (
    <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} role="img" aria-label={label} className="block aspect-[4/3] w-full bg-ink3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <image href={src} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
      <path d={path} fill="none" stroke="#000" strokeOpacity=".55" strokeWidth={u * 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#e03232" strokeWidth={u * 0.9} strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <circle cx={sx} cy={sy} r={u * 1.3} fill="#c62828" stroke="#fff" strokeWidth={u * .35} />
        <text x={sx + u * 2.2} y={sy + u * 1} fontSize={u * 2.8} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={u * .5} paintOrder="stroke" fontFamily="sans-serif">START</text>
        <rect x={ex - u * 1.2} y={ey - u * 1.2} width={u * 2.4} height={u * 2.4} fill="#fff" stroke="#c62828" strokeWidth={u * .4} />
      </g>
    </svg>
  );
}
