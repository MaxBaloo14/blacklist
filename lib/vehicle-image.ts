import sharp from "sharp";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
/** Passerelle d'images du catalogue d'origine : elle contourne le blocage « hotlink » de certains sites (wikis, gtabase). Dernier recours. */
const FALLBACK_PROXY = "https://pdm-premium-deluxe-motorsport-558464922075.europe-west1.run.app/api/image-proxy?url=";

type Opts = { timeoutMs?: number; maxBytes?: number; fallbackProxy?: string | null };

async function download(url: string, headers: Record<string, string>, timeoutMs: number, maxBytes: number): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("protocole refusé");
  const res = await fetch(u, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (/^text\//i.test(type) || /json|xml|html/i.test(type)) throw new Error("pas une image");   // les types vagues (octet-stream…) sont tentés : sharp tranche
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("image trop lourde");
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = res.body?.getReader(); if (!reader) throw new Error("réponse vide");
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) { await reader.cancel(); throw new Error("image trop lourde"); } chunks.push(value); }
  return Buffer.concat(chunks);
}

/** Miniature WebP 480×300 d'une image distante. Plusieurs tentatives : en-têtes de navigateur avec le site d'origine comme référent
 *  (contourne le blocage des images « empruntées »), puis sans référent, puis via la passerelle du catalogue. Lève la dernière erreur si tout échoue. */
export async function fetchThumb(url: string, opts: Opts = {}): Promise<Buffer> {
  const { timeoutMs = 7000, maxBytes = 10 * 1024 * 1024, fallbackProxy = FALLBACK_PROXY } = opts;
  const origin = new URL(url).origin;
  const attempts: [string, Record<string, string>][] = [
    [url, { "User-Agent": BROWSER_UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: `${origin}/`, "Accept-Language": "fr,en;q=0.8" }],
    [url, { "User-Agent": "Mozilla/5.0 (compatible; BlacklistThumbs/1.0)", Accept: "image/*" }],
    ...(fallbackProxy ? [[fallbackProxy + encodeURIComponent(url), { "User-Agent": BROWSER_UA, Accept: "image/*" }] as [string, Record<string, string>]] : []),
  ];
  let last: unknown = new Error("aucune tentative");
  for (const [u, h] of attempts) {
    try {
      const raw = await download(u, h, timeoutMs, maxBytes);
      return await sharp(raw, { limitInputPixels: 40_000_000 }).rotate().resize(480, 300, { fit: "cover", position: "attention" }).webp({ quality: 72 }).toBuffer();
    } catch (e) { last = e; }
  }
  throw last;
}
