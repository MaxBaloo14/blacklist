import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { logout } from "@/app/actions/auth";
import LangSwitch from "./LangSwitch";
import MobileNav from "./MobileNav";

export default async function Nav() {
  const [{ user, profile, isAdmin, unread: unreadAll }, t] = await Promise.all([getSession(), getT()]);
  const unread = user && profile ? unreadAll : 0;
  const links: { href: string; label: string; badge?: number; login?: boolean }[] = [
    { href: "/", label: t("ACCUEIL") },
    { href: "/blacklist", label: t("LA BLACKLIST") },
    ...(user && profile ? [] : [{ href: "/register", label: t("INSCRIPTION") }]),
    { href: "/race-network", label: t("CIRCUITS") },
    ...(user && profile
      ? [{ href: "/profile", label: t("MON PROFIL") }, { href: "/challenges", label: t("MES DÉFIS") }, { href: "/notifications", label: "NOTIFICATIONS", badge: unread }]
      : isAdmin ? [{ href: "/admin", label: "CONTROL CENTER" }] : [{ href: "/login", label: t("CONNEXION"), login: true }]),
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-ink/85 backdrop-blur-md">
      <div className="wrap flex h-[68px] items-center justify-between gap-6">
        <Link href="/" className="font-display flex items-center gap-3 text-[26px] tracking-wider">
          <span>BLACK<b className="text-red">LIST</b></span>
          <small className="font-cond hidden border-l border-white/20 pl-3 text-[11px] font-semibold tracking-[.3em] text-metal lg:inline">BOOBOO CREW</small>
        </Link>
        <div className="font-cond hidden items-center gap-6 text-[14px] font-semibold tracking-[.14em] md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`relative py-1.5 text-[#d8d8d8] transition hover:text-white ${l.login ? "border border-red px-4 hover:bg-red" : ""}`}>
              {l.label}
              {!!l.badge && <span className="ml-1.5 inline-block min-w-5 bg-red px-1 text-center text-[11px] text-white">{l.badge}</span>}
            </Link>
          ))}
          {user && <form action={logout}><button className="py-1.5 text-metal transition hover:text-white">{t("DÉCONNEXION")}</button></form>}
          <LangSwitch />
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <LangSwitch />
          <MobileNav links={links} logout={user ? <form action={logout}><button className="font-display border-b border-white/10 py-4 text-left text-4xl uppercase tracking-wide text-metal">{t("DÉCONNEXION")}</button></form> : null} />
        </div>
      </div>
    </nav>
  );
}
