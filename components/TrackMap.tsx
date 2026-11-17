/**
 * Carte animée d'un circuit : un tracé généré de façon stable à partir de l'identifiant du circuit,
 * parcouru en boucle par un point. Les circuits de type « Circuit » (ou départ = arrivée) forment une boucle fermée.
 */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type P = [number, number];
const f = (n: number) => n.toFixed(1);

/** Courbe lisse passant par les points (Catmull-Rom converti en Bézier). */
function smooth(pts: P[], closed: boolean) {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + " Z" : d;
}

export function trackPath(seed: string, closed: boolean) {
  const r = rng(seed);
  if (closed) {
    const n = 8;
    const pts: P[] = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2, k = 0.62 + r() * 0.5;
      return [150 + Math.cos(a) * 105 * k, 85 + Math.sin(a) * 58 * k];
    });
    return smooth(pts, true);
  }
  const n = 6;
  const pts: P[] = Array.from({ length: n }, (_, i) => [24 + (i / (n - 1)) * 252, 26 + r() * 118]);
  return smooth(pts, false);
}

export default function TrackMap({ id, name, loop, active, dur }: { id: string; name: string; loop: boolean; active: boolean; dur: number }) {
  const d = trackPath(id, loop);
  const pid = `g${id.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
  return (
    <svg viewBox="0 0 300 170" role="img" aria-label={name} className="block h-full w-full bg-ink3">
      <defs>
        <pattern id={pid} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#ffffff0d" /></pattern>
      </defs>
      <rect width="300" height="170" fill={`url(#${pid})`} />
      <path d={d} fill="none" stroke={active ? "#c62828" : "#781818"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.7} />
      <circle r="6" fill={active ? "#f4f4f4" : "#8a8f97"}>
        <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d} />
      </circle>
    </svg>
  );
}
