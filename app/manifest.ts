import type { MetadataRoute } from "next";

// Permet d'« installer » le site sur l'écran d'accueil du téléphone (obligatoire sur iPhone pour les notifications push).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BLACKLIST — BooBoo Crew", short_name: "BLACKLIST", description: "10 drivers. 10 positions. One king.",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#090a0c", theme_color: "#c62828", lang: "fr",
    icons: [{ src: "/img/favicon.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
