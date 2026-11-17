"use client";
import Link from "next/link";
import { ArrowUpRight, Flag, MapPinned, Newspaper, Trophy } from "lucide-react";

const ICONS = { trophy: Trophy, map: MapPinned, flag: Flag, news: Newspaper } as const;

/** Rubrique cliquable : éclairage rouge qui suit le curseur, reflet qui balaie la carte, icône qui se soulève. */
export default function Tile({ href, icon, title, text, index }: { href: string; icon: keyof typeof ICONS; title: string; text: string; index: number }) {
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      style={{ "--i": index } as React.CSSProperties}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className="tile group flex min-h-[150px] flex-col justify-between border border-white/10 bg-ink2 p-5 transition duration-200 hover:-translate-y-1 hover:border-red"
    >
      <div className="flex items-start justify-between">
        <Icon size={22} className="tile-icon text-red" strokeWidth={1.75} />
        <ArrowUpRight size={18} className="text-metal transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
      </div>
      <div>
        <div className="font-display text-2xl uppercase leading-tight tracking-wide">{title}</div>
        <p className="mt-1 text-[13px] leading-snug text-[#a5a9b0]">{text}</p>
      </div>
    </Link>
  );
}
