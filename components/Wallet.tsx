"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** balance = total ; locked = zigollars de bienvenue verrouillés jusqu'au premier gain ; available = ce qui se dépense. */
type Ctx = { balance: number | null; locked: number; available: number | null; refresh: () => void };
const WalletCtx = createContext<Ctx>({ balance: null, locked: 0, available: null, refresh: () => {} });
export const useWallet = () => useContext(WalletCtx);

/** Solde de zigollars partagé par la page : se remet à jour tout seul (toutes les 8 s, au retour sur l'onglet et après un achat ou un pari). */
export function WalletProvider({ initial, initialLocked = 0, children }: { initial: number | null; initialLocked?: number; children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(initial);
  const [locked, setLocked] = useState(initialLocked);
  useEffect(() => setBalance(initial), [initial]);
  useEffect(() => setLocked(initialLocked), [initialLocked]);
  const refresh = useCallback(async () => {
    if (initial === null) return;
    try {
      const r = await fetch("/api/wallet", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (typeof j.balance === "number") { setBalance(j.balance); setLocked(Number(j.locked) || 0); } }
    } catch { /* hors ligne : on garde la dernière valeur */ }
  }, [initial]);
  useEffect(() => {
    if (initial === null) return;
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const id = setInterval(tick, 8000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [initial, refresh]);
  return <WalletCtx.Provider value={{ balance, locked, available: balance === null ? null : Math.max(0, balance - locked), refresh }}>{children}</WalletCtx.Provider>;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");
export function WalletBalance({ className = "" }: { className?: string }) {
  const { balance } = useWallet();
  return balance === null ? null : <span className={className} aria-live="polite">{fmt(balance)} zigollars</span>;
}
/** Rappel sous le solde : les zigollars de bienvenue ne se dépensent qu'après le premier gain. */
export function WalletLock({ template }: { template: string }) {
  const { locked } = useWallet();
  return locked > 0 ? <p data-locked className="mt-2 text-sm text-[#ffd48a]">🔒 {template.replace("{n}", fmt(locked))}</p> : null;
}
