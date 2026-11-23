"use client";
import { useMemo } from "react";
import RouteMap from "@/components/RouteMap";
import { useT } from "@/components/LangProvider";
import { FRAME, overlaySvg, planCrop, toPlanPath } from "@/lib/plan-geom";

/** Aperçu du plan tel qu'il sera publié : carte recadrée, cadre « PLAN DE COURSE », départ / arrivée et petite voiture animée sur le tracé. */
export default function PlanPreview({ path, w, h, src = "/img/map-base.webp", frame = "/img/plan-frame.webp" }: { path: string; w: number; h: number; src?: string; frame?: string }) {
  const t = useT();
  const plan = useMemo(() => {
    const c = planCrop(path, w, h); if (!c) return null;
    return { c, d: toPlanPath(path, c) };
  }, [path, w, h]);
  if (!plan) return <p className="req-card text-[#ffb3b3]">{t("Parcours trop étendu pour tenir dans un plan : rapproche le départ et l'arrivée.")}</p>;
  const { c, d } = plan; const H = FRAME.hole;
  const underlay = (
    <>
      <rect width={FRAME.w} height={FRAME.h} fill="#000" />
      <svg x={H.x} y={H.y} width={H.w} height={H.h} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="none"><image href={src} x={0} y={0} width={w} height={h} /></svg>
      <image href={frame} x={0} y={0} width={FRAME.w} height={FRAME.h} />
      <g dangerouslySetInnerHTML={{ __html: overlaySvg(d) }} />
    </>
  );
  return (
    <div className="plan-preview relative mx-auto w-full max-w-[380px] border border-white/10" data-plan-preview>
      <RouteMap key={d.length + ":" + d.slice(0, 40)} name={t("Aperçu du plan")} src="" w={FRAME.w} h={FRAME.h} path={d} underlay={underlay} />
    </div>
  );
}
