/**
 * Clips intégrés : on n'accepte que des fournisseurs connus, et l'adresse d'intégration est RECONSTRUITE à partir d'un identifiant validé.
 * Une adresse quelconque n'est jamais placée dans un cadre : elle reste un simple lien.
 */
export type Clip = { provider: "youtube" | "twitch" | "twitch-vod" | "streamable" | "vimeo" | "file"; id: string; label: string; url: string };

const YT = /^[A-Za-z0-9_-]{11}$/;
const TW_SLUG = /^[A-Za-z0-9_-]{5,120}$/;

export function parseClip(raw?: string | null): Clip | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id = parts[0] === "watch" ? u.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(parts[0] ?? "") ? parts[1] : null;
    if (id && YT.test(id)) return { provider: "youtube", id, label: "YouTube", url: u.toString() };
  }
  if (host === "youtu.be" && parts[0] && YT.test(parts[0])) return { provider: "youtube", id: parts[0], label: "YouTube", url: u.toString() };

  if (host === "clips.twitch.tv" && parts[0] && TW_SLUG.test(parts[0])) return { provider: "twitch", id: parts[0], label: "Twitch", url: u.toString() };
  if (host === "twitch.tv" || host === "m.twitch.tv") {
    if (parts[1] === "clip" && parts[2] && TW_SLUG.test(parts[2])) return { provider: "twitch", id: parts[2], label: "Twitch", url: u.toString() };
    if (parts[0] === "videos" && /^\d{4,15}$/.test(parts[1] ?? "")) return { provider: "twitch-vod", id: parts[1], label: "Twitch", url: u.toString() };
  }
  if (host === "streamable.com") {
    const id = parts[0] === "e" || parts[0] === "o" ? parts[1] : parts[0];
    if (id && /^[a-z0-9]{4,12}$/i.test(id)) return { provider: "streamable", id, label: "Streamable", url: u.toString() };
  }
  if (host === "vimeo.com" && /^\d{5,12}$/.test(parts[0] ?? "")) return { provider: "vimeo", id: parts[0], label: "Vimeo", url: u.toString() };
  if (/\.(mp4|webm)$/i.test(u.pathname) && !u.username && !u.password) return { provider: "file", id: u.toString(), label: "Vidéo", url: u.toString() };
  return null;
}

/** Adresse du cadre d'intégration (twitch exige le nom de domaine du site : `parent`). */
export function embedUrl(c: Clip, parentHost: string): string {
  switch (c.provider) {
    case "youtube": return `https://www.youtube-nocookie.com/embed/${c.id}?autoplay=1&rel=0`;
    case "twitch": return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(c.id)}&parent=${encodeURIComponent(parentHost)}&autoplay=true`;
    case "twitch-vod": return `https://player.twitch.tv/?video=v${c.id}&parent=${encodeURIComponent(parentHost)}&autoplay=true`;
    case "streamable": return `https://streamable.com/e/${c.id}?autoplay=1`;
    case "vimeo": return `https://player.vimeo.com/video/${c.id}?autoplay=1`;
    case "file": return c.id;
  }
}
