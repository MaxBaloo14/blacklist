export const MAX_IMAGE = 5 * 1024 * 1024;

/** Vérifie type, taille ET signature binaire (on ne se fie pas à l'extension / au MIME déclaré). */
export async function checkImage(file: File | null): Promise<{ ok: true; ext: string; type: string; bytes: Uint8Array } | { ok: false; message: string }> {
  if (!file || file.size === 0) return { ok: false, message: "Une photographie est requise." };
  if (file.size > MAX_IMAGE) return { ok: false, message: "Photographie trop lourde (5 Mo maximum)." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const is = (sig: number[], off = 0) => sig.every((b, i) => bytes[off + i] === b);
  if (is([0xff, 0xd8, 0xff])) return { ok: true, ext: "jpg", type: "image/jpeg", bytes };
  if (is([0x89, 0x50, 0x4e, 0x47])) return { ok: true, ext: "png", type: "image/png", bytes };
  if (is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8)) return { ok: true, ext: "webp", type: "image/webp", bytes };
  return { ok: false, message: "Format non supporté (JPEG, PNG ou WebP)." };
}
