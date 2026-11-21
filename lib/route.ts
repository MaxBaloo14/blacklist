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
