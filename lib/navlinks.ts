import { DISCORD_URL } from "@/lib/links";

export type NavLink = { href: string; label: string; badge?: number; login?: boolean; external?: boolean };

/** Liste des rubriques du menu : la même pour la barre du haut (ordinateur) et la barre du bas (téléphone). */
export function buildNavLinks(t: (s: string) => string, o: { loggedIn: boolean; isAdmin: boolean }): NavLink[] {
  return [
    { href: "/", label: t("ACCUEIL") },
    { href: "/blacklist", label: t("LA BLACKLIST") },
    ...(o.loggedIn ? [] : [{ href: "/register", label: t("INSCRIPTION") }]),
    { href: "/calendar", label: t("CALENDRIER") },
    { href: "/race-network", label: t("CIRCUITS") },
    { href: "/boutique", label: t("BOUTIQUE") },
    { href: "/rules", label: t("RÈGLEMENT") },
    { href: "/vehicles", label: t("VÉHICULES") },
    { href: DISCORD_URL, label: "DISCORD", external: true },
    ...(o.loggedIn
      ? [{ href: "/profile", label: t("MON PROFIL") }, { href: "/reclamation", label: t("RÉCLAMATION") }, { href: "/suggestion", label: t("SUGGESTION") }]
      : o.isAdmin ? [{ href: "/admin", label: "CONTROL CENTER" }] : [{ href: "/login", label: t("CONNEXION"), login: true }]),
  ];
}
