"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useT } from "@/components/LangProvider";

export default function MobileNav({ links, logout }: { links: { href: string; label: string; badge?: number; external?: boolean }[]; logout?: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Menu ouvert : la page derrière ne défile plus, Échap ferme
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", esc); };
  }, [open]);

  // Le menu est affiché directement dans <body> : la barre du haut a un flou d'arrière-plan qui, sinon, le cantonnait à sa propre hauteur
  // (la page passait alors à travers le menu).
  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true" aria-label={t("Menu")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-ink pb-24">
          <div className="wrap flex h-[68px] items-center justify-between">
            <span className="font-display text-2xl tracking-wider">BLACK<b className="text-red">LIST</b></span>
            <button aria-label={t("Fermer")} onClick={() => setOpen(false)} className="border border-white/20 p-2"><X size={20} /></button>
          </div>
          <nav className="wrap mt-4 flex flex-col gap-1" aria-label={t("Menu")}>
            {links.map((l, i) => (
              <motion.div key={l.href} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.04 * i }}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="font-display flex items-center justify-between border-b border-white/10 py-3.5 text-4xl uppercase tracking-wide">{l.label}</a>
                ) : (
                  <Link href={l.href} onClick={() => setOpen(false)} className="font-display flex items-center justify-between border-b border-white/10 py-3.5 text-4xl uppercase tracking-wide">
                    {l.label}
                    {!!l.badge && <span className="badge badge-red">{l.badge}</span>}
                  </Link>
                )}
              </motion.div>
            ))}
            {logout}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div>
      <button aria-label={t("Menu")} aria-expanded={open} onClick={() => setOpen(true)} className="border border-white/20 p-2"><Menu size={20} /></button>
      {mounted && createPortal(overlay, document.body)}
    </div>
  );
}
