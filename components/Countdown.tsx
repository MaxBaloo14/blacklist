"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";

/** Compte à rebours. `big` : grands chiffres façon tableau d'affichage (J / H / MIN / SEC), qui pulsent en rouge sous 24 h. */
export default function Countdown({ to, label = "Temps restant", big }: { to: string; label?: string; big?: boolean }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (now === null) return big ? <div className="cd-board" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="cd-cell"><span className="cd-digits">––</span></div>)}</div> : <span className="font-cond text-metal">…</span>;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="badge badge-red">{t("Délai dépassé")}</span>;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  if (!big) {
    const hh = Math.floor(ms / 3.6e6);
    return (
      <span className="font-cond text-lg font-bold tracking-wider text-bone" aria-label={t(label)}>
        {p(hh)}:{p(m)}:{p(s)}
        <span className="ml-2 text-xs font-semibold uppercase tracking-[.2em] text-metal">{t(label)}</span>
      </span>
    );
  }
  const cells: [number, string][] = [...(d > 0 ? [[d, t("JOURS")] as [number, string]] : []), [h, t("HEURES")], [m, t("MIN")], [s, t("SEC")]];
  return (
    <div className={`cd-board ${ms < 864e5 ? "cd-urgent" : ""}`} role="timer" aria-label={t(label)}>
      {cells.map(([v, l]) => (
        <div key={l} className="cd-cell"><span className="cd-digits">{p(v)}</span><span className="cd-label">{l}</span></div>
      ))}
    </div>
  );
}
