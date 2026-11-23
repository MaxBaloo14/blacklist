/** Utilitaires pour les tracés SVG générés par tools/routes (chemin « M x y C … » en coordonnées de l'image). */
const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** Longueur approchée du tracé (somme des cordes entre les points d'arrivée de chaque courbe). */
export function routeLength(d: string): number {
  const n = nums(d); if (n.length < 4) return 0;
  let len = 0, px = n[0], py = n[1];
  for (let i = 2; i + 5 < n.length; i += 6) { const x = n[i + 4], y = n[i + 5]; len += Math.hypot(x - px, y - py); px = x; py = y; }
  return len;
}
export const routeStart = (d: string): [number, number] => { const n = nums(d); return [n[0] ?? 0, n[1] ?? 0]; };
export const routeEnd = (d: string): [number, number] => { const n = nums(d); return [n[n.length - 2] ?? 0, n[n.length - 1] ?? 0]; };

export type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Courbe lisse passant par les points posés (Catmull-Rom converti en Bézier), au même format « M x y C … » que les plans de course. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

/** Rectangle englobant le tracé, avec une marge (pour recadrer la carte autour du parcours). */
export function routeBox(d: string, w: number, h: number, pad = 0.18): { x: number; y: number; w: number; h: number } {
  const n = nums(d); const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
  if (!xs.length) return { x: 0, y: 0, w, h };
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const bw = Math.max(x1 - x0, w * 0.08), bh = Math.max(y1 - y0, h * 0.08);
  const side = Math.max(bw, bh * 0.75) * (1 + pad * 2); // cadre 4:3
  const vw = Math.min(w, side), vh = Math.min(h, side * 0.75);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.max(0, Math.min(w - vw, cx - vw / 2)), y: Math.max(0, Math.min(h - vh, cy - vh / 2)), w: vw, h: vh };
}
