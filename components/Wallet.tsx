"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { balance: number | null; refresh: () => void };
const WalletCtx = createContext<Ctx>({ balance: null, refresh: () => {} });
export const useWallet = () => useContext(WalletCtx);

/** Solde de zigollars partagé par la page : se remet à jour tout seul (toutes les 8 s, au retour sur l'onglet et après un achat ou un pari). */
export function WalletProvider({ initial, children }: { initial: number | null; children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(initial);
  useEffect(() => setBalance(initial), [initial]);
  const refresh = useCallback(async () => {
    if (initial === null) return;
    try {
      const r = await fetch("/api/wallet", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (typeof j.balance === "number") setBalance(j.balance); }
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
  return <WalletCtx.Provider value={{ balance, refresh }}>{children}</WalletCtx.Provider>;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");
export function WalletBalance({ className = "" }: { className?: string }) {
  const { balance } = useWallet();
  return balance === null ? null : <span className={className} aria-live="polite">{fmt(balance)} zigollars</span>;
}
