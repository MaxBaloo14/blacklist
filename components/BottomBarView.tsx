"use client";
import { Bell, CalendarDays, Home, Map, Swords, Trophy, User } from "lucide-react";
import ActiveLink from "./ActiveLink";

const ICONS = { trophy: Trophy, calendar: CalendarDays, swords: Swords, bell: Bell, user: User, home: Home, map: Map };
export type BottomItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export default function BottomBarView({ items, label }: { items: BottomItem[]; label: string }) {
  return (
    <nav aria-label={label} className="bottombar md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          return (
            <li key={it.href}>
              <ActiveLink href={it.href} className="bottombar-item">
                <span className="relative">
                  <Icon size={22} strokeWidth={1.9} aria-hidden />
                  {!!it.badge && <span className="bottombar-dot" aria-label={String(it.badge)}>{it.badge > 9 ? "9+" : it.badge}</span>}
                </span>
                <span>{it.label}</span>
              </ActiveLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
