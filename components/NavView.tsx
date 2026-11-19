import Link from "next/link";
import { logout } from "@/app/actions/auth";
import LangSwitch from "./LangSwitch";
import MobileNav from "./MobileNav";
import ActiveLink from "./ActiveLink";
import NotifBell from "./NotifBell";

export type { NavLink } from "@/lib/navlinks";
import type { NavLink } from "@/lib/navlinks";

/**
 * Barre de navigation : logo à gauche, liens CENTRÉS sur une seule ligne, drapeaux collés au bord droit.
 * Connecté, il y a plus de liens : le menu complet n'apparaît qu'à partir de 1500 px, en dessous c'est le menu déroulant.
 */
export default function NavView({ links, loggedIn, logoutLabel, unread = 0, showBell = false }: { links: NavLink[]; loggedIn: boolean; logoutLabel: string; unread?: number; showBell?: boolean }) {
  const bp = loggedIn
    ? { grid: "min-[1500px]:grid-cols-[1fr_auto_1fr]", show: "min-[1500px]:flex", hide: "min-[1500px]:hidden", block: "min-[1500px]:block" }
    : { grid: "xl:grid-cols-[1fr_auto_1fr]", show: "xl:flex", hide: "xl:hidden", block: "xl:block" };
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-ink/85 backdrop-blur-md">
      <div className={`mx-auto grid h-[68px] max-w-[1680px] grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-6 ${bp.grid}`}>
        <Link href="/" className="font-display flex items-center gap-3 whitespace-nowrap text-[26px] tracking-wider">
          <span>BLACK<b className="text-red">LIST</b></span>
          <small className="font-cond hidden border-l border-white/20 pl-3 text-[11px] font-semibold tracking-[.3em] text-metal min-[1700px]:inline">BOOBOO CREW</small>
        </Link>

        <div className={`font-cond hidden items-center justify-center gap-x-1.5 whitespace-nowrap text-[14px] font-semibold tracking-[.14em] ${bp.show}`}>
          {links.map((l) => (
            <ActiveLink key={l.href} href={l.href} external={l.external} className={`tab ${l.login ? "tab-login" : ""}`}>
              {l.label}{!!l.badge && <span className="ml-1.5 inline-block min-w-5 bg-ink px-1 text-center text-[11px] text-white">{l.badge}</span>}
            </ActiveLink>
          ))}
          {loggedIn && <form action={logout}><button className="tab !text-metal">{logoutLabel}</button></form>}
        </div>
        <div className={`hidden ${bp.block}`} aria-hidden />

        <div className={`flex items-center gap-3 ${bp.hide}`}>
          {showBell && <NotifBell unread={unread} />}
          <LangSwitch />
          <div className="hidden md:block"><MobileNav links={links} logout={loggedIn ? <form action={logout}><button className="font-display border-b border-white/10 py-4 text-left text-4xl uppercase tracking-wide text-metal">{logoutLabel}</button></form> : null} /></div>
        </div>
      </div>
      {/* Drapeaux collés au bord droit de l'écran quand le menu complet est affiché */}
      <div className={`absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-3 ${bp.show}`}>{showBell && <NotifBell unread={unread} />}<LangSwitch /></div>
    </nav>
  );
}
