import { headers } from "next/headers";

// Limiteur en mémoire (par instance serveur). Suffisant contre les abus basiques ;
// pour une protection globale sur Vercel, brancher Upstash/Vercel KV ici (même interface).
const hits = new Map<string, number[]>();

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function rateLimit(bucket: string, max: number, windowMs: number, key?: string): Promise<boolean> {
  // Uniquement pour les tests automatiques (jamais défini en production) : sinon des dizaines de connexions depuis la même adresse seraient bloquées.
  if (process.env.DISABLE_RATE_LIMIT === "1" && process.env.VERCEL_ENV !== "production") return true;
  const id = `${bucket}:${key ?? (await clientIp())}`;
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(id, arr); return false; }
  arr.push(now);
  hits.set(id, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
