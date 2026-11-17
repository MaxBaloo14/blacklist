"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function MobileNav({ links, logout }: { links: { href: string; label: string; badge?: number; external?: boolean }[]; logout?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button aria-label="Menu" onClick={() => setOpen(true)} className="border border-white/20 p-2"><Menu size={20} /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-ink/95 backdrop-blur">
            <div className="wrap flex h-[68px] items-center justify-between">
              <span className="font-display text-2xl tracking-wider">BLACK<b className="text-red">LIST</b></span>
              <button aria-label="Close" onClick={() => setOpen(false)} className="border border-white/20 p-2"><X size={20} /></button>
            </div>
            <nav className="wrap mt-8 flex flex-col gap-1">
              {links.map((l, i) => (
                <motion.div key={l.href} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="font-display flex items-center justify-between border-b border-white/10 py-4 text-4xl uppercase tracking-wide">{l.label}</a>
                  ) : (
                    <Link href={l.href} onClick={() => setOpen(false)} className="font-display flex items-center justify-between border-b border-white/10 py-4 text-4xl uppercase tracking-wide">
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
    </div>
  );
}
