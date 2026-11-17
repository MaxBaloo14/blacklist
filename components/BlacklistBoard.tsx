"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useT } from "@/components/LangProvider";
import type { Row } from "@/lib/types";

const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ") + " $";

function Photo({ url, big }: { url: string | null; big?: boolean }) {
  const size = big ? "h-[84px] w-[150px]" : "h-[52px] w-[92px]";
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" loading="lazy" className={`${size} shrink-0 border border-white/10 object-cover`} />
    : <div className={`${size} shrink-0 border border-white/10 bg-[repeating-linear-gradient(135deg,#1a1c21_0_8px,#15171b_8px_16px)]`} />;
}

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
  return (
    <LayoutGroup>
      <div className="grid gap-2.5">
        <AnimatePresence initial={false}>
          {shown.map((r) => {
            const king = r.position === 1;
            const vacant = !r.driver_id;
            const key = r.driver_id ?? `vacant-${r.position}`;
            const photo = r.photo_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${r.photo_path}` : null;
            const prize = rewards?.[String(r.position)];
            const inner = (
              <>
                <div className={`rank-num font-display text-center leading-none ${king ? "!text-red text-[96px] drop-shadow-[0_0_30px_#c6282866] sm:text-[120px]" : "text-[44px] sm:text-[56px]"}`}>{r.position}</div>
                <div className="min-w-0">
                  {king && <div className="font-cond mb-1.5 flex items-center gap-2 text-xs font-bold tracking-[.3em] text-red"><Crown size={14} /> {t("LE ROI")}</div>}
                  {vacant ? (
                    <>
                      <strong className="font-cond text-xl uppercase tracking-wider text-metal">{t("Vacant")}</strong>
                      <span className="block text-[13px] tracking-wider text-metal/70">{t("Ouvert au vainqueur de la Warm-up Race")}</span>
                    </>
                  ) : (
                    <>
                      <strong className={`font-cond block truncate uppercase leading-tight tracking-wide ${king ? "text-[34px]" : "text-2xl"}`}>{r.first_name} {r.last_name}</strong>
                      <span className="text-[13px] tracking-wider text-metal">{prize ? `${t("Prime")} : ${money(Number(prize))}` : ""}</span>
                    </>
                  )}
                </div>
                <div className="font-cond flex min-w-0 items-center gap-3.5 text-lg tracking-wide text-[#cfcfcf]">
                  {!vacant && <><Photo url={photo} big={king} /><span className="truncate">{r.make_model ?? "—"}</span></>}
                </div>
                <div className="font-cond text-right text-[22px] font-bold tracking-wide">
                  {!vacant && <><span className="text-ok">{r.wins}{t("V")}</span> / <span className="text-red">{r.losses}{t("D")}</span></>}
                </div>
              </>
            );
            const cls = `grid items-center gap-x-4 gap-y-1 ${king ? "king-card py-7 grid-cols-[84px_1fr] sm:grid-cols-[140px_1.3fr_1.3fr_110px]" : "row-card py-3.5 grid-cols-[56px_1fr] sm:grid-cols-[90px_1.3fr_1.3fr_110px]"} pr-5 ${flashed.has(r.driver_id) ? "flash" : ""} ${vacant ? "opacity-60" : ""} [&>*:nth-child(3)]:col-start-2 [&>*:nth-child(4)]:col-start-2 [&>*:nth-child(4)]:text-left sm:[&>*:nth-child(3)]:col-start-auto sm:[&>*:nth-child(4)]:col-start-auto sm:[&>*:nth-child(4)]:text-right`;
            return (
              <motion.div key={key} layout transition={{ type: "spring", stiffness: 260, damping: 28 }} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} whileHover={{ x: 6 }}>
                {vacant ? <div className={cls}>{inner}</div> : <Link href={`${base}/${r.driver_id}`} className={cls}>{inner}</Link>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
