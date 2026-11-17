"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";

export default function Countdown({ to, label = "Temps restant" }: { to: string; label?: string }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="font-cond text-metal">…</span>;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="badge badge-red">{t("Délai dépassé")}</span>;
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  return (
    <span className="font-cond text-lg font-bold tracking-wider text-bone" aria-label={t(label)}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      <span className="ml-2 text-xs font-semibold uppercase tracking-[.2em] text-metal">{t(label)}</span>
    </span>
  );
}
