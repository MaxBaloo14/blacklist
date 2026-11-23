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


/** Points le long d'un tracé « M x y C … » (chaque courbe de Bézier est échantillonnée). */
export function samplePath(d: string, per = 14): [number, number][] {
  const n = nums(d); if (n.length < 2) return [];
  const out: [number, number][] = [[n[0], n[1]]];
  let px = n[0], py = n[1];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6);
    for (let k = 1; k <= per; k++) { const t = k / per, u = 1 - t;
      out.push([u * u * u * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); }
    px = x3; py = y3;
  }
  return out;
}

// Lettres « pixel » (5 × 7) pour le panneau START : aucune police nécessaire, le rendu est identique partout.
const GLYPH: Record<string, string[]> = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
};

/** Calque du plan, au format SVG (coordonnées du plan 1432 × 2000) : tracé rouge avec flèches, panneau START en lettres pixel et damier d'arrivée.
 *  Même rendu sur le serveur (image publiée) et dans l'aperçu. Ne contient que des nombres calculés : aucune donnée saisie par l'utilisateur. */
export function overlaySvg(d: string): string {
  const pts = samplePath(d); if (pts.length < 2) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
  const line = "M" + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(" L");
  let s = `<path d="${line}" fill="none" stroke="#2a0606" stroke-opacity=".55" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${line}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${line}" fill="none" stroke="#e01919" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;
  // flèches de sens, tous les ~150 px
  let acc = 0, next = 90;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const seg = Math.hypot(x1 - x0, y1 - y0); acc += seg;
    if (acc >= next) { next += 150; const a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
      s += `<g transform="translate(${r(x1)} ${r(y1)}) rotate(${r(a)})"><path d="M-5 -6 L3 0 L-5 6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`; }
  }
  // panneau START : lettres pixel sur plaque rouge, au-dessus du départ
  const px = 3.4, gap = 3.4, gw = 5 * px, word = "START";
  const w = word.length * gw + (word.length - 1) * gap, h = 7 * px, padX = 11, padY = 9;
  const cx = sx, cy = sy - 38, x0 = cx - w / 2 - padX, y0 = cy - h / 2 - padY;
  s += `<path d="M${r(cx - 8)} ${r(y0 + h + 2 * padY)} L${r(cx)} ${r(sy - 11)} L${r(cx + 8)} ${r(y0 + h + 2 * padY)} Z" fill="#a01616" stroke="#fff" stroke-width="2"/>`;
  s += `<rect x="${r(x0)}" y="${r(y0)}" width="${r(w + 2 * padX)}" height="${r(h + 2 * padY)}" rx="4" fill="#a01616" stroke="#fff" stroke-width="2.4"/>`;
  [...word].forEach((ch, k) => GLYPH[ch].forEach((row, j) => [...row].forEach((bit, i) => { if (bit === "1") s += `<rect x="${r(cx - w / 2 + k * (gw + gap) + i * px)}" y="${r(cy - h / 2 + j * px)}" width="${px}" height="${px}" fill="#fff"/>`; })));
  s += `<circle cx="${r(sx)}" cy="${r(sy)}" r="7" fill="#e01919" stroke="#fff" stroke-width="2.6"/>`;
  // arrivée : petit damier
  const cell = 5, g = cell * 4;
  s += `<rect x="${r(ex - g / 2 - 3)}" y="${r(ey - g / 2 - 3)}" width="${g + 6}" height="${g + 6}" rx="3" fill="#fff" stroke="#c62828" stroke-width="2"/>`;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) s += `<rect x="${r(ex - g / 2 + i * cell)}" y="${r(ey - g / 2 + j * cell)}" width="${cell}" height="${cell}" fill="#111"/>`;
  return s;
}

/** Distance d'un tracé en kilomètres (longueur de la courbe × échelle de la carte en mètres par pixel), arrondie à 0,1 km. */
export function routeKm(d: string, mPerPx: number): number {
  const pts = samplePath(d, 10); let px = 0;
  for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return Math.round((px * mPerPx) / 100) / 10;
}
/** Longueur d'un tracé en pixels de la carte. */
export function routePx(d: string): number {
  const pts = samplePath(d, 10); let px = 0;
  for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return px;
}
