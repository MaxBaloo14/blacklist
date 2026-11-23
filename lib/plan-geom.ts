/** Géométrie du plan de course (partagée entre le serveur qui fabrique l'image et l'aperçu du navigateur). */
/** Cadre « PLAN DE COURSE » BooBoo Crew (1432 × 2000) : la carte se place dans l'ouverture centrale. */
export const FRAME = { w: 1432, h: 2000, hole: { x: 33, y: 223, w: 1397, h: 1745 } };
const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

export type Crop = { x: number; y: number; w: number; h: number };

/** Zone de la carte reprise dans le plan : centrée sur le parcours, au format de l'ouverture du cadre. Null si le parcours est trop étendu. */
export function planCrop(d: string, mapW: number, mapH: number, pad = 0.16): Crop | null {
  const n = nums(d); if (n.length < 4) return null;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ratio = FRAME.hole.w / FRAME.hole.h;
  const maxW = Math.min(mapW, mapH * ratio);
  const need = Math.max((x1 - x0) * (1 + pad * 2), (y1 - y0) * (1 + pad * 2) * ratio, mapW * 0.14);
  if (need > maxW) return null;
  const w = need, h = need / ratio;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.max(0, Math.min(mapW - w, cx - w / 2)), y: Math.max(0, Math.min(mapH - h, cy - h / 2)), w, h };
}

/** Convertit un tracé en coordonnées de la carte vers les coordonnées du plan (image 1432 × 2000). */
export function toPlanPath(d: string, c: Crop): string {
  const n = nums(d); const r = (v: number) => Math.round(v * 10) / 10;
  const k = FRAME.hole.w / c.w;
  let out = "";
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = r(FRAME.hole.x + (n[i] - c.x) * k), y = r(FRAME.hole.y + (n[i + 1] - c.y) * k);
    out += i === 0 ? `M${x} ${y}` : (i - 2) % 6 === 0 ? ` C${x} ${y}` : ` ${x} ${y}`;
  }
  return out;
}

