import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import BottomBarView, { type BottomItem } from "./BottomBarView";

/** Barre d'onglets fixe en bas de l'écran sur téléphone : les accès les plus utilisés, à portée de pouce. */
export default async function BottomBar() {
  const [{ user, profile, unread }, t] = await Promise.all([getSession(), getT()]);
  const loggedIn = Boolean(user && profile);
  const items: BottomItem[] = loggedIn
    ? [
        { href: "/blacklist", label: t("Classement"), icon: "trophy" },
        { href: "/calendar", label: t("Calendrier"), icon: "calendar" },
        { href: "/challenges", label: t("Défis"), icon: "swords" },
        { href: "/notifications", label: t("Alertes"), icon: "bell", badge: unread },
        { href: "/profile", label: t("Profil"), icon: "user" },
      ]
    : [
        { href: "/", label: t("Accueil"), icon: "home" },
        { href: "/blacklist", label: t("Classement"), icon: "trophy" },
        { href: "/calendar", label: t("Calendrier"), icon: "calendar" },
        { href: "/race-network", label: t("Circuits"), icon: "map" },
        { href: user ? "/admin" : "/login", label: user ? "Admin" : t("Connexion"), icon: "user" },
      ];
  return <BottomBarView items={items} label={t("Navigation rapide")} />;
}
