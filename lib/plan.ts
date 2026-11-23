import "server-only";
import { headers } from "next/headers";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { FRAME, overlaySvg, planCrop, toPlanPath, type Crop } from "@/lib/plan-geom";
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

/** Calque du plan (tracé rouge, flèches, panneau START, arrivée) : le même rendu que l'aperçu du navigateur. */
function markers(d: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.w}" height="${FRAME.h}">${overlaySvg(d)}</svg>`);
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
  const webp = await sharp({ create: { width: FRAME.w, height: FRAME.h, channels: 3, background: "#000" } })
    .composite([{ input: crop, left: FRAME.hole.x, top: FRAME.hole.y }, { input: frame, left: 0, top: 0 }, { input: markers(planPath), left: 0, top: 0 }])
    .webp({ quality: 84 }).toBuffer();
  return { webp, path: planPath };
}
