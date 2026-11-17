import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import MobileNav from "./MobileNav";

export default async function Nav() {
  const { supabase, user, profile, isAdmin } = await getSession();
  let unread = 0;
  if (supabase && user && profile) {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }
  const links: { href: string; label: string; badge?: number }[] = [
    { href: "/", label: "HOME" },
    { href: "/blacklist", label: "THE BLACKLIST" },
    ...(user && profile ? [] : [{ href: "/register", label: "REGISTER" }]),
    { href: "/race-network", label: "RACE NETWORK" },
    ...(user && profile
      ? [{ href: "/profile", label: "MY PROFILE" }, { href: "/challenges", label: "MY CHALLENGES" }, { href: "/notifications", label: "NOTIFICATIONS", badge: unread }]
      : isAdmin ? [{ href: "/admin", label: "CONTROL CENTER" }] : [{ href: "/login", label: "LOGIN" }]),
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
            <Link key={l.href} href={l.href} className={`relative py-1.5 text-[#d8d8d8] transition hover:text-white ${l.label === "LOGIN" ? "border border-red px-4 hover:bg-red" : ""}`}>
              {l.label}
              {!!l.badge && <span className="ml-1.5 inline-block min-w-5 bg-red px-1 text-center text-[11px] text-white">{l.badge}</span>}
            </Link>
          ))}
          {user && (
            <form action={logout}><button className="py-1.5 text-metal transition hover:text-white">LOGOUT</button></form>
          )}
        </div>
        <div className="flex items-center gap-3 md:hidden">
          {user && <form action={logout}><button className="font-cond text-xs tracking-[.2em] text-metal">LOGOUT</button></form>}
          <MobileNav links={links} />
        </div>
      </div>
    </nav>
  );
}
