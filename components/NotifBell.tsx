"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllRead } from "@/app/actions/driver";
import { useT } from "@/components/LangProvider";

type Item = { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; at: string };

/** Cloche de notifications : pastille du nombre de non lues, panneau qui se déplie au clic. */
export default function NotifBell({ unread }: { unread: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [items, setItems] = useState<Item[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setCount(unread), [unread]);

  // Rappels de duel et nouvelles notifications : on actualise le compteur toutes les 60 s (onglet visible uniquement)
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setCount(j.unread); setItems(j.items); } }).catch(() => {}); };
    tick();
    const i = setInterval(tick, 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) { setItems(j.items); setCount(j.unread); } }).catch(() => {});
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { alive = false; document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const readAll = async () => { await markAllRead(); setItems((x) => x?.map((i) => ({ ...i, read: true })) ?? x); setCount(0); };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("Notifications")} className={`bell ${open ? "bell-open" : ""}`}>
        <Bell size={19} className={count > 0 ? "bell-ring" : ""} />
        {count > 0 && <span className="bell-dot">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label={t("Notifications")}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="font-cond text-sm font-bold tracking-[.2em]">{t("NOTIFICATIONS")}</span>
            {count > 0 && <button type="button" onClick={readAll} className="font-cond text-xs tracking-[.14em] text-red hover:text-white">{t("Tout marquer comme lu")}</button>}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {items === null && <div className="grid gap-2 p-4"><div className="skel h-12" /><div className="skel h-12" /><div className="skel h-12" /></div>}
            {items?.length === 0 && <p className="p-5 text-sm text-metal">{t("Aucune notification.")}</p>}
            {items?.map((n) => {
              const inner = (
                <div className={`bell-item ${n.read ? "" : "bell-unread"}`}>
                  <div className="font-cond text-[11px] tracking-[.18em] text-metal">{n.at}</div>
                  <div className={`font-cond text-[17px] font-bold leading-tight tracking-wide ${n.read ? "text-[#cfcfcf]" : "text-white"}`}>{n.title}</div>
                  {n.body && <div className="truncate text-[13px] text-[#a5a9b0]">{n.body}</div>}
                </div>
              );
              return n.link ? <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{inner}</Link> : <div key={n.id}>{inner}</div>;
            })}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="font-cond block border-t border-white/10 px-4 py-3 text-center text-xs font-bold tracking-[.2em] text-[#cfcfcf] hover:text-white">{t("VOIR TOUTES LES NOTIFICATIONS")} →</Link>
        </div>
      )}
    </div>
  );
}
