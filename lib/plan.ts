import "server-only";
import { headers } from "next/headers";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { FRAME, planCrop, toPlanPath, type Crop } from "@/lib/plan-geom";
export { FRAME, planCrop, toPlanPath };
export type { Crop };
const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** Lit un fichier du dossier public (disque, sinon via l'adresse du site). */
async function asset(name: string): Promise<Buffer> {
  try { return await fs.readFile(path.join(process.cwd(), "public", name)); } catch { /* sur l'hébergeur, le dossier public est servi par le site */ }
  const h = await headers(); const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("127.") || host?.startsWith("localhost") ? "http" : "https");
  const r = await fetch(`${proto}://${host}/${name}`); if (!r.ok) throw new Error("Ressource introuvable");
  return Buffer.from(await r.arrayBuffer());
}

/** Repères dessinés dans l'image (sans texte, pour ne dépendre d'aucune police) : départ = petite pastille rouge ▶, arrivée = petit damier. */
function markers(sx: number, sy: number, ex: number, ey: number): Buffer {
  const cell = 5, grid = 4; const g = cell * grid;
  let checker = "";
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) if ((i + j) % 2 === 0) checker += `<rect x="${ex - g / 2 + i * cell}" y="${ey - g / 2 + j * cell}" width="${cell}" height="${cell}" fill="#111"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.w}" height="${FRAME.h}">
    <rect x="${sx - 20}" y="${sy - 13}" width="40" height="26" rx="4" fill="#a31919" stroke="#fff" stroke-width="2"/>
    <polygon points="${sx - 5},${sy - 7} ${sx + 8},${sy} ${sx - 5},${sy + 7}" fill="#fff"/>
    <rect x="${ex - g / 2 - 3}" y="${ey - g / 2 - 3}" width="${g + 6}" height="${g + 6}" rx="3" fill="#fff" stroke="#c62828" stroke-width="2"/>
    <rect x="${ex - g / 2}" y="${ey - g / 2}" width="${g}" height="${g}" fill="#fff"/>${checker}</svg>`);
}

/** Fabrique l'image du plan : carte recadrée autour du parcours, cadre BooBoo Crew par-dessus, repères de départ et d'arrivée. */
export async function renderPlan(d: string, mapW: number, mapH: number): Promise<{ webp: Buffer; path: string } | { error: string }> {
  const c = planCrop(d, mapW, mapH);
  if (!c) return { error: "Parcours trop étendu pour tenir dans un plan : rapproche le départ et l'arrivée." };
  const [map, frame] = await Promise.all([asset("img/map-base.webp"), asset("img/plan-frame.webp")]);
  const meta = await sharp(map).metadata();
  // la carte a pu être remplacée par une version plus définie (même format) : le tracé est remis à l'échelle de la carte actuelle
  if (!meta.width || !meta.height || Math.abs(meta.width / meta.height - mapW / mapH) > 0.01) return { error: "La carte a changé : recharge la page et retrace le parcours." };
  const k = meta.width / mapW;
  const crop = await sharp(map).extract({ left: Math.round(c.x * k), top: Math.round(c.y * k), width: Math.round(c.w * k), height: Math.round(c.h * k) })
    .resize(FRAME.hole.w, FRAME.hole.h, { fit: "fill", kernel: "lanczos3" }).sharpen({ sigma: 1.6, m1: 1.2, m2: 3 }).linear(1.12, -10).toBuffer();
  const planPath = toPlanPath(d, c);
  const n = nums(planPath);
  const webp = await sharp({ create: { width: FRAME.w, height: FRAME.h, channels: 3, background: "#000" } })
    .composite([{ input: crop, left: FRAME.hole.x, top: FRAME.hole.y }, { input: frame, left: 0, top: 0 }, { input: markers(n[0], n[1], n[n.length - 2], n[n.length - 1]), left: 0, top: 0 }])
    .webp({ quality: 84 }).toBuffer();
  return { webp, path: planPath };
}
