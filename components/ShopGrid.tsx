"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Countdown from "@/components/Countdown";
import { Crosshair, Flame, Fuel, HeartPulse, Package, ShieldHalf, Sword, Wrench, type LucideIcon } from "lucide-react";
import ActionForm from "@/components/ActionForm";
import { useT } from "@/components/LangProvider";
import { useWallet } from "@/components/Wallet";
import { buyItem } from "@/app/actions/economy";

type Item = { id: string; name: string; description: string | null; category: string; price: number; stock: number | null; limited?: boolean; ends_at?: string | null };
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");

/** Une icône par article (d'après son nom), sinon par catégorie. */
function iconFor(it: Item): LucideIcon {
  const n = `${it.name} ${it.category}`.toLowerCase();
  if (/fus[ée]e|signal/.test(n)) return Flame;
  if (/jerrican|essence|carburant/.test(n)) return Fuel;
  if (/soin|m[ée]dic|trousse/.test(n)) return HeartPulse;
  if (/r[ée]par|pneu|m[ée]can|outil/.test(n)) return Wrench;
  if (/gilet|protec/.test(n)) return ShieldHalf;
  if (/blanche|couteau|batte|biche|machette/.test(n)) return Sword;
  if (/arme|p[ée]toire|pistolet/.test(n)) return Crosshair;
  return Package;
}

export default function ShopGrid({ items, loggedPilot }: { items: Item[]; loggedPilot: boolean }) {
  const t = useT();
  const { available: balance, locked, refresh } = useWallet();
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const [cat, setCat] = useState<string>("*");
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, []);

  const groups = (cat === "*" ? cats : [cat]).map((c) => [c, items.filter((i) => i.category === c)] as const).filter(([, l]) => l.length);

  return (
    <div>
      <div role="group" aria-label={t("Catégories")} className="font-cond mb-10 flex flex-wrap gap-3 text-sm font-bold tracking-[.16em]">
        {[["*", t("TOUT")], ...cats.map((c) => [c, t(c).toUpperCase()])].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setCat(k)} aria-pressed={cat === k} className={`shop-chip ${cat === k ? "shop-chip-on" : ""}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-14">
        {groups.map(([c, list]) => (
          <section key={c} aria-label={t(c)}>
            <div className="shop-head"><h3 className="font-display text-3xl uppercase tracking-wide">{t(c)}</h3><span className="font-cond text-xs tracking-[.2em] text-metal">{list.length} {t("ARTICLE(S)")}</span></div>
            <div className="grid gap-6 lg:grid-cols-2">
              {list.map((it) => {
                const Icon = iconFor(it);
                const ended = Boolean(it.ends_at) && now > 0 && new Date(it.ends_at!).getTime() <= now;
                const out = (it.stock !== null && it.stock <= 0) || ended;
                const price = Number(it.price);
                const poor = balance !== null && balance < price;
                const missing = poor && balance !== null ? price - balance : 0;
                return (
                  <article key={it.id} className={`shop-row ${out ? "shop-row-off" : ""}`}>
                    <span className="shop-row-icon" aria-hidden><Icon size={38} strokeWidth={1.5} /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="font-display text-[28px] uppercase leading-[1.1]">{t(it.name)}</h4>
                        {(it.limited || it.ends_at) && !out && <span data-limited className="badge badge-red">{t("ÉDITION LIMITÉE")}</span>}
                        {it.stock !== null && <span className={`badge ${out ? "badge-red" : "badge-warn"}`}>{ended ? t("TERMINÉ") : out ? t("ÉPUISÉ") : it.stock <= 10 ? t("Plus que {n} !", { n: it.stock }) : t("{n} restant(s)", { n: it.stock })}</span>}
                      </div>
                      {it.description && <p className="mt-2 text-[15px] leading-relaxed text-[#a5a9b0]">{t(it.description)}</p>}
                      {it.ends_at && !out && <div data-ends className="mt-3"><Countdown to={it.ends_at} label="Se termine dans" endedLabel="TERMINÉ" /></div>}
                    </div>
                    <div className="shop-row-buy">
                      <div className="text-right"><div className="font-display text-4xl leading-none">{fmt(price)}</div><div className="font-cond mt-1 text-[11px] font-bold tracking-[.24em] text-red">{t("ZIGOLLARS")}</div></div>
                      {loggedPilot ? (
                        out ? <button type="button" disabled className="btn btn-ghost btn-sm w-full">{ended ? t("TERMINÉ") : t("ÉPUISÉ")}</button> : (
                          <ActionForm action={buyItem} label="ACHETER" small variant={poor ? "ghost" : "red"} disabled={poor} onDone={refresh} className="w-full [&_.btn]:w-full [&>div]:mt-2"
                            confirm={t("Acheter « {n} » pour {p} zigollars ?", { n: t(it.name), p: fmt(price) })}>
                            <input type="hidden" name="item" value={it.id} />
                            {poor && <p className="shop-missing">{locked > 0 ? t("Tes zigollars de bienvenue se débloquent à ton premier gain.") : t("Il te manque {n} zigollars", { n: fmt(missing) })}</p>}
                          </ActionForm>
                        )
                      ) : <Link href="/login" className="btn btn-ghost btn-sm w-full">{t("CONNEXION")}</Link>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {!groups.length && <p className="panel text-[#a5a9b0]">{t("La boutique est vide pour le moment.")}</p>}
    </div>
  );
}
