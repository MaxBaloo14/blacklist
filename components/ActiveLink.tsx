"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Lien qui sait s'il correspond à la page courante (aria-current) : le style « onglet » s'en sert pour s'allumer. */
export default function ActiveLink({ href, exact, className, children, external }: { href: string; exact?: boolean; className?: string; children: ReactNode; external?: boolean }) {
  const path = usePathname() ?? "/";
  const active = !external && (exact || href === "/" ? path === href : path === href || path.startsWith(href + "/"));
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link href={href} aria-current={active ? "page" : undefined} className={className}>{children}</Link>;
}
