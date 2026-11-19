"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CircleUser, Home, LogIn, Map, MessageCircle, ScrollText, Settings, Swords, Trophy, UserPlus } from "lucide-react";
import ActiveLink from "./ActiveLink";

const ICON_BY_HREF: Record<string, typeof Home> = {
  "/": Home, "/blacklist": Trophy, "/register": UserPlus, "/calendar": CalendarDays, "/race-network": Map, "/rules": ScrollText,
  "/profile": CircleUser, "/challenges": Swords, "/notifications": Bell, "/login": LogIn, "/admin": Settings,
};
export type BottomItem = { href: string; label: string; badge?: number; external?: boolean };

export default function BottomBarView({ items, label, logout }: { items: BottomItem[]; label: string; logout?: React.ReactNode }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: true });

  const measure = () => { const el = scroller.current; if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => {
    measure();
    // L'onglet de la page courante est amené dans la zone visible
    scroller.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [items.length]);

  return (
    <nav aria-label={label} className="bottombar md:hidden">
      <div className={`bottombar-fade bottombar-fade-l ${edge.left ? "on" : ""}`} aria-hidden />
      <div className={`bottombar-fade bottombar-fade-r ${edge.right ? "on" : ""}`} aria-hidden />
      <ul ref={scroller} onScroll={measure} className="bottombar-scroll">
        {items.map((it) => {
          const Icon = it.external ? MessageCircle : ICON_BY_HREF[it.href] ?? Home;
          return (
            <li key={it.href}>
              <ActiveLink href={it.href} external={it.external} className="bottombar-item">
                <span className="relative">
                  <Icon size={22} strokeWidth={1.9} aria-hidden />
                  {!!it.badge && <span className="bottombar-dot" aria-label={String(it.badge)}>{it.badge > 9 ? "9+" : it.badge}</span>}
                </span>
                <span>{it.label}</span>
              </ActiveLink>
            </li>
          );
        })}
        {logout && <li className="bottombar-logout">{logout}</li>}
      </ul>
    </nav>
  );
}
