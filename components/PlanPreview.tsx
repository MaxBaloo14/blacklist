"use client";
import { useMemo } from "react";
import { RouteCar } from "@/components/RouteMap";
import { useT } from "@/components/LangProvider";
import { FRAME, planCrop, toPlanPath } from "@/lib/plan-geom";
import { routeEnd, routeStart } from "@/lib/route";

/** Aperçu du plan tel qu'il sera publié : carte recadrée, cadre « PLAN DE COURSE », départ / arrivée et petite voiture animée sur le tracé. */
export default function PlanPreview({ path, w, h, src = "/img/map-base.webp", frame = "/img/plan-frame.webp" }: { path: string; w: number; h: number; src?: string; frame?: string }) {
  const t = useT();
  const plan = useMemo(() => {
    const c = planCrop(path, w, h); if (!c) return null;
    return { c, d: toPlanPath(path, c) };
  }, [path, w, h]);
  if (!plan) return <p className="req-card text-[#ffb3b3]">{t("Parcours trop étendu pour tenir dans un plan : rapproche le départ et l'arrivée.")}</p>;
  const { c, d } = plan; const H = FRAME.hole;
  const [sx, sy] = routeStart(d), [ex, ey] = routeEnd(d);
  const cell = 5, g = cell * 4;
  const underlay = (
    <>
      <rect width={FRAME.w} height={FRAME.h} fill="#000" />
      <svg x={H.x} y={H.y} width={H.w} height={H.h} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="none"><image href={src} x={0} y={0} width={w} height={h} /></svg>
      <image href={frame} x={0} y={0} width={FRAME.w} height={FRAME.h} />
      <rect x={sx - 20} y={sy - 13} width={40} height={26} rx={4} fill="#a31919" stroke="#fff" strokeWidth={2} /><polygon points={`${sx - 5},${sy - 7} ${sx + 8},${sy} ${sx - 5},${sy + 7}`} fill="#fff" />
      <rect x={ex - g / 2 - 3} y={ey - g / 2 - 3} width={g + 6} height={g + 6} rx={3} fill="#fff" stroke="#c62828" strokeWidth={2} /><rect x={ex - g / 2} y={ey - g / 2} width={g} height={g} fill="#fff" />
      {Array.from({ length: 16 }, (_, k) => { const i = k % 4, j = Math.floor(k / 4); return (i + j) % 2 === 0 ? <rect key={k} x={ex - g / 2 + i * cell} y={ey - g / 2 + j * cell} width={cell} height={cell} fill="#111" /> : null; })}
    </>
  );
  return (
    <div className="plan-preview mx-auto w-full max-w-[380px] border border-white/10" data-plan-preview>
      <RouteCar key={d.length + ":" + d.slice(0, 40)} name={t("Aperçu du plan")} src="" w={FRAME.w} h={FRAME.h} path={d} underlay={underlay} />
    </div>
  );
}
