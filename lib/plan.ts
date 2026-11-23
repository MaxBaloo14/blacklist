import "server-only";
import { headers } from "next/headers";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

/** Lit un fichier du dossier public (disque, sinon via l'adresse du site). */
async function asset(name: string): Promise<Buffer> {
  try { return await fs.readFile(path.join(process.cwd(), "public", name)); } catch { /* sur l'hébergeur, le dossier public est servi par le site */ }
  const h = await headers(); const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("127.") || host?.startsWith("localhost") ? "http" : "https");
  const r = await fetch(`${proto}://${host}/${name}`); if (!r.ok) throw new Error("Ressource introuvable");
  return Buffer.from(await r.arrayBuffer());
}

/** Repères dessinés dans l'image (sans texte, pour ne dépendre d'aucune police) : départ = pastille rouge ▶, arrivée = damier. */
function markers(sx: number, sy: number, ex: number, ey: number): Buffer {
  const cell = 9, grid = 4; const g = cell * grid;
  let checker = "";
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) if ((i + j) % 2 === 0) checker += `<rect x="${ex - g / 2 + i * cell}" y="${ey - g / 2 + j * cell}" width="${cell}" height="${cell}" fill="#111"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.w}" height="${FRAME.h}">
    <rect x="${sx - 34}" y="${sy - 22}" width="68" height="44" rx="6" fill="#a31919" stroke="#fff" stroke-width="3"/>
    <polygon points="${sx - 9},${sy - 12} ${sx + 13},${sy} ${sx - 9},${sy + 12}" fill="#fff"/>
    <rect x="${ex - g / 2 - 5}" y="${ey - g / 2 - 5}" width="${g + 10}" height="${g + 10}" rx="4" fill="#fff" stroke="#c62828" stroke-width="3"/>
    <rect x="${ex - g / 2}" y="${ey - g / 2}" width="${g}" height="${g}" fill="#fff"/>${checker}</svg>`);
}

/** Fabrique l'image du plan : carte recadrée autour du parcours, cadre BooBoo Crew par-dessus, repères de départ et d'arrivée. */
export async function renderPlan(d: string, mapW: number, mapH: number): Promise<{ webp: Buffer; path: string } | { error: string }> {
  const c = planCrop(d, mapW, mapH);
  if (!c) return { error: "Parcours trop étendu pour tenir dans un plan : rapproche le départ et l'arrivée." };
  const [map, frame] = await Promise.all([asset("img/map-base.webp"), asset("img/plan-frame.webp")]);
  const meta = await sharp(map).metadata();
  if (meta.width !== mapW || meta.height !== mapH) return { error: "La carte a changé : recharge la page et retrace le parcours." };
  const crop = await sharp(map).extract({ left: Math.round(c.x), top: Math.round(c.y), width: Math.round(c.w), height: Math.round(c.h) })
    .resize(FRAME.hole.w, FRAME.hole.h, { fit: "fill", kernel: "lanczos3" }).modulate({ brightness: 1.05 }).toBuffer();
  const planPath = toPlanPath(d, c);
  const n = nums(planPath);
  const webp = await sharp({ create: { width: FRAME.w, height: FRAME.h, channels: 3, background: "#000" } })
    .composite([{ input: crop, left: FRAME.hole.x, top: FRAME.hole.y }, { input: frame, left: 0, top: 0 }, { input: markers(n[0], n[1], n[n.length - 2], n[n.length - 1]), left: 0, top: 0 }])
    .webp({ quality: 84 }).toBuffer();
  return { webp, path: planPath };
}
