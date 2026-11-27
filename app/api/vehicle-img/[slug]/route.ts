import { fetchThumb } from "@/lib/vehicle-image";
import images from "@/data/vehicle-images.json";

export const runtime = "nodejs";

const SOURCES = images as Record<string, string>;
const OK = "public, max-age=31536000, s-maxage=31536000, immutable";
const MISS = "public, max-age=600, s-maxage=600";

/** Miniature d'un véhicule de la liste. Le navigateur ne parle qu'à ce site : l'image d'origine est récupérée ici, réduite, puis gardée en cache.
 *  Seul un identifiant de la liste est accepté (jamais une adresse libre) : impossible de s'en servir pour joindre un autre serveur. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Object.hasOwn(SOURCES, slug)) return new Response(null, { status: 404, headers: { "Cache-Control": MISS } });
  // banc d'essai uniquement : une image de remplacement fournie par le serveur de test (jamais définie en production)
  const origin = process.env.VEHICLE_IMG_TEST_ORIGIN;
  try {
    const webp = await fetchThumb(origin ? `${origin}/__vehicle_img/${slug}` : SOURCES[slug], origin ? { fallbackProxy: null } : {});
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": OK } });
  } catch (e) {
    // la raison (courte, sans adresse) aide à diagnostiquer : « HTTP 403 », « timeout »…
    const why = e instanceof Error ? e.message.replace(/[^\w .:-]/g, "").slice(0, 60) : "erreur";
    return new Response(null, { status: 404, headers: { "Cache-Control": MISS, "X-Img-Why": why } });
  }
}
