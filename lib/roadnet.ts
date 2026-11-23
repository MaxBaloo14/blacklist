import type { Pt } from "@/lib/route";

/** Réseau routier de la carte : image d'1 pixel de large (public/img/map-roads.png, fabriquée par tools/map/make_roads.py).
 *  Sert à « accrocher » un clic à la route la plus proche et à calculer le chemin le plus court entre deux points (A*). */
export class RoadNet {
  readonly w: number; readonly h: number;
  private mask: Uint8Array; private g: Float32Array; private from: Int32Array; private seen: Int32Array; private run = 0;
  private heapI = new Int32Array(1 << 20); private heapF = new Float32Array(1 << 20);

  private constructor(w: number, h: number, mask: Uint8Array) {
    this.w = w; this.h = h; this.mask = mask;
    this.g = new Float32Array(w * h); this.from = new Int32Array(w * h); this.seen = new Int32Array(w * h);
  }

  static async load(url: string): Promise<RoadNet> {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const m = new Uint8Array(c.width * c.height); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
    return new RoadNet(c.width, c.height, m);
  }

  /** Pixel de route le plus proche (dans un rayon), ou null s'il n'y a aucune route à proximité. */
  snap([x, y]: Pt, r = 48): Pt | null {
    const cx = Math.round(x), cy = Math.round(y); let best = -1, bd = r * r + 1;
    for (let dy = -r; dy <= r; dy++) { const yy = cy + dy; if (yy < 0 || yy >= this.h) continue;
      for (let dx = -r; dx <= r; dx++) { const xx = cx + dx; if (xx < 0 || xx >= this.w) continue;
        const d = dx * dx + dy * dy; if (d < bd && this.mask[yy * this.w + xx]) { bd = d; best = yy * this.w + xx; } } }
    return best < 0 ? null : [best % this.w, Math.floor(best / this.w)];
  }

  /** Plus court chemin sur les routes entre deux pixels de route (A*, 8 voisins). Null si les deux points ne sont pas reliés. */
  route(a: Pt, b: Pt): Pt[] | null {
    const { w, h, mask, g, from, seen } = this; const run = ++this.run;
    const s = a[1] * w + a[0], t = b[1] * w + b[0]; const tx = b[0], ty = b[1];
    const hp = (i: number) => Math.hypot((i % w) - tx, Math.floor(i / w) - ty);
    let n = 0; const hi = this.heapI, hf = this.heapF;
    const push = (i: number, f: number) => { let k = n++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hi[k] = hi[p]; hf[k] = hf[p]; k = p; } hi[k] = i; hf[k] = f; };
    const pop = () => { const top = hi[0]; const li = hi[--n], lf = hf[n]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hi[k] = hi[c]; hf[k] = hf[c]; k = c; } hi[k] = li; hf[k] = lf; return top; };
    g[s] = 0; from[s] = -1; seen[s] = run; push(s, hp(s));
    let guard = 0;
    while (n > 0 && guard++ < 900000 && n < hi.length - 8) {
      const u = pop(); if (u === t) break;
      const ux = u % w, uy = (u - ux) / w, gu = g[u];
      for (let dy = -1; dy <= 1; dy++) { const vy = uy + dy; if (vy < 0 || vy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const vx = ux + dx; if (vx < 0 || vx >= w) continue;
          const v = vy * w + vx; if (!mask[v]) continue;
          const ng = gu + (dx && dy ? 1.4142 : 1);
          if (seen[v] !== run || ng < g[v]) { seen[v] = run; g[v] = ng; from[v] = u; push(v, ng + hp(v)); } } }
    }
    if (seen[t] !== run) return null;
    const out: Pt[] = []; for (let i = t; i !== -1; i = from[i]) out.push([i % w, Math.floor(i / w)]);
    return out.reverse();
  }
}

/** Simplifie une ligne brisée (Douglas-Peucker) : garde les virages, retire les pixels alignés. */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!; let md = 0, mi = -1;
    const [ax, ay] = pts[i], [bx, by] = pts[j]; const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((by - ay) * pts[k][0] - (bx - ax) * pts[k][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = k; } }
    if (md > tol && mi > 0) { keep[mi] = 1; stack.push([i, mi], [mi, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
