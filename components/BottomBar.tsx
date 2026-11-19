import { logout } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { buildNavLinks } from "@/lib/navlinks";
import BottomBarView from "./BottomBarView";

/** Barre d'onglets fixe en bas de l'écran sur téléphone : TOUTES les rubriques du menu, avec les mêmes noms, à faire défiler au doigt. */
export default async function BottomBar() {
  const [{ user, profile, isAdmin, unread }, t] = await Promise.all([getSession(), getT()]);
  const loggedIn = Boolean(user && profile);
  const links = buildNavLinks(t, { loggedIn, isAdmin });
  const items = [
    ...links,
    ...(loggedIn ? [{ href: "/notifications", label: "NOTIFICATIONS", badge: unread }] : []),
  ];
  return <BottomBarView items={items} label={t("Navigation rapide")} logout={user ? <form action={logout}><button type="submit" className="bottombar-item">{t("DÉCONNEXION")}</button></form> : null} />;
}
