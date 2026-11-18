"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useT } from "@/components/LangProvider";
import type { Row } from "@/lib/types";

const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ") + " $";

export default function BlacklistBoard({ initial, rewards, base, limit }: { initial: Row[]; rewards: Row; base: string; limit?: number }) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>(initial);
  const [flashed, setFlashed] = useState<Set<string>>(new Set());
  const prev = useRef<Map<string, number>>(new Map(initial.filter((r) => r.driver_id).map((r) => [r.driver_id, r.position])));

  // Mise à jour en direct : si un duel est validé, les lignes glissent à leur nouvelle place
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/blacklist", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Row[] = await res.json();
        const changed = new Set<string>();
        next.forEach((r) => { if (r.driver_id && prev.current.has(r.driver_id) && prev.current.get(r.driver_id) !== r.position) changed.add(r.driver_id); });
        prev.current = new Map(next.filter((r) => r.driver_id).map((r) => [r.driver_id, r.position]));
        setRows(next);
        if (changed.size) { setFlashed(changed); setTimeout(() => alive && setFlashed(new Set()), 2600); }
      } catch { /* réseau : on réessaiera */ }
    };
    const t = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const shown = limit ? rows.slice(0, limit) : rows;
  const podium = shown.slice(0, 3), rest = shown.slice(3);
  const cardMotion = (key: string) => ({ layout: true as const, layoutId: key, transition: { type: "spring" as const, stiffness: 260, damping: 28 }, initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } });

  return (
    <LayoutGroup>
      {/* PODIUM : vrai podium à marches — #2 à gauche, #1 au centre (le plus haut), #3 à droite */}
      <div className="podium-stage relative grid gap-8 pb-8 lg:grid-cols-3 lg:items-end lg:gap-0">
        <div className="podium-floor pointer-events-none absolute inset-x-0 bottom-0 hidden lg:block" aria-hidden />
        <div className="podium-beam pointer-events-none absolute inset-x-0 -top-10 bottom-0 hidden lg:block" aria-hidden />
        <AnimatePresence initial={false}>
          {podium.map((r) => {
            const vacant = !r.driver_id, pos = Number(r.position);
            const key = r.driver_id ?? `vacant-${pos}`;
            const prize = rewards?.[String(pos)];
            const order = pos === 1 ? "lg:order-2" : pos === 2 ? "lg:order-1" : "lg:order-3";
            const step = pos === 1 ? "plinth-1" : pos === 2 ? "plinth-2" : "plinth-3";
            const inner = (
              <div className={`podium-col ${flashed.has(r.driver_id) ? "flash" : ""} ${vacant ? "opacity-70" : ""}`}>
                <div className="relative z-10 px-2 pb-5 text-center">
                  <div className="mb-2 flex min-h-6 flex-wrap items-center justify-center gap-2">
                    {pos === 1 && <span className="font-cond flex items-center gap-1.5 text-xs font-bold tracking-[.3em] text-red"><Crown size={16} className="crown-float" /> {t("LE ROI")}</span>}
                    {!vacant && <MoveBadge move={r.move} />}
                    {!vacant && r.in_duel && <span className="badge badge-red !py-0 pulse-soft">{t("EN DUEL")}</span>}
                  </div>
                  <strong className={`font-cond block truncate uppercase leading-tight tracking-wide ${vacant ? "text-xl text-metal" : pos === 1 ? "podium-name-1 text-[40px]" : "text-[30px]"}`}>{vacant ? t("Vacant") : `${r.first_name} ${r.last_name}`}</strong>
                  {vacant
                    ? <span className="font-cond mt-1 block text-sm uppercase tracking-[.2em] text-metal/70">{t("Ouvert au vainqueur de la Warm-up Race")}</span>
                    : <span className="font-cond block truncate text-xl tracking-wide text-[#cfcfcf]">{r.make_model ?? "—"}</span>}
                  {!vacant && (
                    <div className="font-cond mt-3 inline-flex items-center gap-4 border-y border-white/10 px-4 py-1.5 tracking-wide">
                      <span className="text-[22px] font-bold"><span className="text-ok">{r.wins}{t("V")}</span> / <span className="text-red">{r.losses}{t("D")}</span></span>
                      {prize ? <span className="text-[13px] text-metal">{t("Prime")} : {money(Number(prize))}</span> : null}
                    </div>
                  )}
                </div>
                <div className={`plinth ${step}`}><span className="plinth-num font-display">{pos}</span></div>
              </div>
            );
            return (
              <motion.div key={key} {...cardMotion(key)} whileHover={vacant ? undefined : { y: -4 }} className={order}>
                {vacant ? inner : <Link href={`${base}/${r.driver_id}`} className="block">{inner}</Link>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* #4 à #10 : lignes compactes, le détail s'ouvre au survol */}
      <div className="mt-10 grid gap-2">
        <AnimatePresence initial={false}>
          {rest.map((r) => {
            const vacant = !r.driver_id, pos = Number(r.position);
            const key = r.driver_id ?? `vacant-${pos}`;
            const prize = rewards?.[String(pos)];
            const inner = (
              <>
                <div className="rank-num font-display text-center text-[40px] leading-none sm:text-[48px]">{pos}</div>
                <div className="min-w-0">
                  {vacant ? (
                    <>
                      <strong className="font-cond text-xl uppercase tracking-wider text-metal">{t("Vacant")}</strong>
                      <span className="block text-[13px] tracking-wider text-metal/70">{t("Ouvert au vainqueur de la Warm-up Race")}</span>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-cond block truncate text-2xl uppercase leading-tight tracking-wide">{r.first_name} {r.last_name}</strong>
                        <MoveBadge move={r.move} />
                        {r.in_duel && <span className="badge badge-red !py-0 pulse-soft">{t("EN DUEL")}</span>}
                      </div>
                      <span className="text-[13px] tracking-wider text-metal">{prize ? `${t("Prime")} : ${money(Number(prize))}` : ""}</span>
                    </>
                  )}
                </div>
                <div className="font-cond flex min-w-0 items-center gap-3.5 text-lg tracking-wide text-[#cfcfcf]">
                  {!vacant && <span className="truncate">{r.make_model ?? "—"}</span>}
                </div>
                <div className="font-cond text-right text-[22px] font-bold tracking-wide">
                  {!vacant && <><span className="text-ok">{r.wins}{t("V")}</span> / <span className="text-red">{r.losses}{t("D")}</span></>}
                </div>
                {!vacant && (
                  <div className="font-cond hidden max-h-0 sm:col-span-3 sm:col-start-2 overflow-hidden text-[13px] tracking-[.18em] text-red opacity-0 transition-all duration-300 group-hover:max-h-8 group-hover:opacity-100 sm:block">
                    {r.vehicle_class ? <span className="text-metal">{String(r.vehicle_class).toUpperCase()} · </span> : null}{t("VOIR LA FICHE")} →
                  </div>
                )}
              </>
            );
            const cls = `group grid items-center gap-x-4 gap-y-1 row-card py-3.5 grid-cols-[56px_1fr] sm:grid-cols-[90px_1.3fr_1.3fr_110px] pr-5 ${flashed.has(r.driver_id) ? "flash" : ""} ${vacant ? "opacity-60" : ""} [&>*:nth-child(3)]:col-start-2 [&>*:nth-child(4)]:col-start-2 [&>*:nth-child(4)]:text-left sm:[&>*:nth-child(3)]:col-start-auto sm:[&>*:nth-child(4)]:col-start-auto sm:[&>*:nth-child(4)]:text-right`;
            return (
              <motion.div key={key} {...cardMotion(key)} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} whileHover={vacant ? undefined : { x: 6 }}>
                {vacant ? <div className={cls}>{inner}</div> : <Link href={`${base}/${r.driver_id}`} className={cls}>{inner}</Link>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

/** Mouvement des 7 derniers jours : ▲ gagné, ▼ perdu, NEW = entrée dans la Blacklist. */
function MoveBadge({ move }: { move: number | null | undefined }) {
  const t = useT();
  if (!move) return null;
  const up = move > 0;
  return <span className={`badge !py-0 ${up ? "badge-ok" : "badge-red"}`} title={t("Mouvement des 7 derniers jours")}>{up ? "▲" : "▼"} {Math.abs(move)}</span>;
}
