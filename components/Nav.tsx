import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { buildNavLinks } from "@/lib/navlinks";
import NavView from "./NavView";

export default async function Nav() {
  const [{ user, profile, isAdmin, unread: unreadAll }, t] = await Promise.all([getSession(), getT()]);
  const loggedIn = Boolean(user && profile);
  const unread = loggedIn ? unreadAll : 0;
  const links = buildNavLinks(t, { loggedIn, isAdmin });
  return <NavView links={links} loggedIn={Boolean(user)} logoutLabel={t("DÉCONNEXION")} unread={unread} showBell={loggedIn} />;
}
