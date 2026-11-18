import type { ReactNode } from "react";

export type Bar = { label: string; value: number; tip?: string };

/** Histogramme SVG : barres fines à bout arrondi sur une ligne de base, quadrillage discret, valeurs étiquetées seulement aux extrêmes,
 *  infobulle au survol (<title>) et tableau de données équivalent pour les lecteurs d'écran. Une seule série : le titre la nomme. */
export default function BarChart({ title, unit, bars, color = "#c62828", tableLabel, valueHeader, format = (n: number) => String(n) }: {
  title: string; unit?: string; bars: Bar[]; color?: string; tableLabel: string; valueHeader: string; format?: (n: number) => string; children?: ReactNode;
}) {
  const W = 560, H = 190, pl = 8, pr = 8, pt = 22, pb = 30;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const step = (W - pl - pr) / Math.max(1, bars.length);
  const bw = Math.min(26, step * 0.55);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const maxIdx = bars.reduce((m, b, i) => (b.value > bars[m].value ? i : m), 0);
  const total = bars.reduce((s, b) => s + b.value, 0);
  const labelAt = new Set([maxIdx, bars.length - 1].filter((i) => bars[i]?.value > 0));
  return (
    <figure className="chart">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-cond text-sm font-bold uppercase tracking-[.18em]">{title}</span>
        <span className="font-cond text-xs tracking-[.14em] text-metal">{unit ? `${unit} · ` : ""}{format(total)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${title} : ${bars.map((b) => `${b.label} ${format(b.value)}`).join(", ")}`}>
        {[0.5, 1].map((f) => <line key={f} x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} stroke="#ffffff14" strokeWidth="1" />)}
        <line x1={pl} x2={W - pr} y1={H - pb} y2={H - pb} stroke="#ffffff33" strokeWidth="1" />
        {bars.map((b, i) => {
          const x = pl + step * i + (step - bw) / 2, top = y(b.value), h = Math.max(b.value > 0 ? 3 : 0, H - pb - top);
          return (
            <g key={i} className="chart-bar">
              <rect x={pl + step * i} y={pt} width={step} height={H - pt - pb} fill="transparent" />
              {b.value > 0 && <path d={`M${x},${H - pb} V${H - pb - h + 4} Q${x},${H - pb - h} ${x + 4},${H - pb - h} H${x + bw - 4} Q${x + bw},${H - pb - h} ${x + bw},${H - pb - h + 4} V${H - pb} Z`} fill={color} />}
              <title>{b.tip ?? `${b.label} : ${format(b.value)}`}</title>
              {labelAt.has(i) && <text x={x + bw / 2} y={H - pb - h - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#f4f4f4" fontFamily="var(--font-cond)">{format(b.value)}</text>}
              {(bars.length <= 8 || i % 2 === (bars.length - 1) % 2) && <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#9ca1a9" fontFamily="var(--font-cond)">{b.label}</text>}
            </g>
          );
        })}
      </svg>
      <details className="mt-1">
        <summary className="font-cond cursor-pointer text-[11px] tracking-[.18em] text-metal hover:text-white">{tableLabel}</summary>
        <table className="tbl mt-2"><thead><tr><th>#</th><th>{valueHeader}</th></tr></thead><tbody>{bars.map((b, i) => <tr key={i}><td>{b.label}</td><td>{format(b.value)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
