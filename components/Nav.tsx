import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { DISCORD_URL } from "@/lib/links";
import NavView, { type NavLink } from "./NavView";

export default async function Nav() {
  const [{ user, profile, isAdmin, unread: unreadAll }, t] = await Promise.all([getSession(), getT()]);
  const loggedIn = Boolean(user && profile);
  const unread = loggedIn ? unreadAll : 0;
  const links: NavLink[] = [
    { href: "/", label: t("ACCUEIL") },
    { href: "/blacklist", label: t("LA BLACKLIST") },
    ...(loggedIn ? [] : [{ href: "/register", label: t("INSCRIPTION") }]),
    { href: "/race-network", label: t("CIRCUITS") },
    { href: "/rules", label: t("RÈGLEMENT") },
    { href: DISCORD_URL, label: "DISCORD", external: true },
    ...(loggedIn
      ? [{ href: "/profile", label: t("MON PROFIL") }, { href: "/challenges", label: t("MES DÉFIS") }, { href: "/notifications", label: "NOTIFICATIONS", badge: unread }]
      : isAdmin ? [{ href: "/admin", label: "CONTROL CENTER" }] : [{ href: "/login", label: t("CONNEXION"), login: true }]),
  ];
  return <NavView links={links} loggedIn={Boolean(user)} logoutLabel={t("DÉCONNEXION")} />;
}
