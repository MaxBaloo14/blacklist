"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bus, Car, CarFront, Check, Clock, Flame, Gauge, LayoutGrid, List, Mountain, Rows3, Search, Truck, Users, Wind, X, type LucideIcon } from "lucide-react";
import { useT } from "@/components/LangProvider";

export type Vehicle = { slug?: string; img?: boolean; name: string; brand: string; model: string; category: string; hp: number | null; seats: number | null; trunk?: number | null; fuel?: string | null; gearbox?: string | null };

const ICONS: Record<string, LucideIcon> = {
  Compactes: Car, Berlines: CarFront, "Coupés": Car, Sportives: Gauge, "Sportives Classiques": Clock, "Grosse cylindrées": Flame,
  Lowrider: Rows3, Drift: Wind, Rallye: Mountain, SUV: Truck, Vans: Bus,
};
const catIcon = (c: string): LucideIcon => ICONS[c] ?? Car;
type Sort = "az" | "hp-desc" | "hp-asc";
const keyOf = (v: Vehicle) => `${v.brand}|${v.model}`;

/** Miniature du véhicule (servie par ce site) ; si elle manque ou ne charge pas, on garde l'icône de la catégorie. */
function Thumb({ v, big }: { v: Vehicle; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  const Icon = catIcon(v.category);
  if (!v.img || !v.slug || failed) return <Icon size={big ? 56 : 22} strokeWidth={1.4} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/vehicle-img/${v.slug}`} alt="" loading="lazy" decoding="async" width={480} height={300} onError={() => setFailed(true)} className="veh-img" />;
}

/** Liste des véhicules autorisés : recherche, filtres (catégorie, marque), tri, deux présentations et aperçu détaillé au clic. */
export default function VehicleList({ vehicles, categories }: { vehicles: Vehicle[]; categories: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("*");
  const [brand, setBrand] = useState("*");
  const [sort, setSort] = useState<Sort>("az");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<Vehicle | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const maxHp = useMemo(() => Math.max(1, ...vehicles.map((v) => v.hp ?? 0)), [vehicles]);
  const brands = useMemo(() => [...new Set(vehicles.map((v) => v.brand))].sort((a, b) => a.localeCompare(b, "fr")), [vehicles]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const v of vehicles) m.set(v.category, (m.get(v.category) ?? 0) + 1); return m; }, [vehicles]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    const list = vehicles.filter((v) => (cat === "*" || v.category === cat) && (brand === "*" || v.brand === brand) && (!n || norm(`${v.name} ${v.brand} ${v.model}`).includes(n)));
    if (sort === "hp-desc") list.sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0) || a.name.localeCompare(b.name, "fr"));
    if (sort === "hp-asc") list.sort((a, b) => (a.hp ?? 0) - (b.hp ?? 0) || a.name.localeCompare(b.name, "fr"));
    return list;
  }, [vehicles, q, cat, brand, sort]);
  // tri alphabétique : regroupé par catégorie ; tri par puissance : une seule liste continue
  const groups: (readonly [string, Vehicle[]])[] = sort === "az"
    ? categories.map((c) => [c, shown.filter((v) => v.category === c)] as const).filter(([, l]) => l.length)
    : shown.length ? [[t("Par puissance"), shown]] : [];

  useEffect(() => { const d = dlg.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const show = (v: Vehicle, el: HTMLElement) => { lastFocus.current = el; setOpen(v); };
  const close = () => { setOpen(null); lastFocus.current?.focus(); };
  const hpPct = (v: Vehicle) => Math.max(6, Math.round(((v.hp ?? 0) / maxHp) * 100));
  const reset = q || cat !== "*" || brand !== "*";

  const card = (v: Vehicle) => {
    return (
      <li key={keyOf(v)} className="min-w-0">
        <button type="button" onClick={(e) => show(v, e.currentTarget)} className={`veh-card w-full text-left ${view === "list" ? "veh-card-row" : ""}`}>
          <span className="veh-card-icon" aria-hidden><Thumb v={v} /></span>
          <span className="min-w-0 flex-1">
            <span className="font-display block truncate text-[24px] uppercase leading-[1.1]">{v.name}</span>
            <span className="font-cond mt-0.5 block truncate text-[13px] uppercase tracking-[.14em] text-metal">{v.brand}{view === "grid" ? "" : ` · ${v.model}`}</span>
            {view === "grid" && <span className="veh-bar mt-2.5" aria-hidden><i style={{ width: `${hpPct(v)}%` }} /></span>}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-display text-2xl leading-none text-red">{v.hp ?? "—"}</span>
            <span className="font-cond text-[10px] font-bold tracking-[.24em] text-metal">{t("CH")}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <div className="veh-toolbar">
        <label className="relative block min-w-[220px] flex-1">
          <span className="sr-only">{t("Rechercher un véhicule")}</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-metal" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Rechercher un véhicule ou une marque…")} className="input !pl-11" />
        </label>
        <select aria-label={t("Marque")} value={brand} onChange={(e) => setBrand(e.target.value)} className="input !w-auto">
          <option value="*">{t("Toutes les marques")}</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select aria-label={t("Trier")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input !w-auto">
          <option value="az">{t("Nom (A → Z)")}</option>
          <option value="hp-desc">{t("Puissance décroissante")}</option>
          <option value="hp-asc">{t("Puissance croissante")}</option>
        </select>
        <div role="group" aria-label={t("Présentation")} className="flex">
          <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label={t("Cartes")} className={`veh-view ${view === "grid" ? "veh-view-on" : ""}`}><LayoutGrid size={18} /></button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label={t("Liste compacte")} className={`veh-view ${view === "list" ? "veh-view-on" : ""}`}><List size={18} /></button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("Catégories")} className="font-cond flex flex-wrap gap-2.5 text-sm font-bold tracking-[.14em]">
          <button type="button" onClick={() => setCat("*")} aria-pressed={cat === "*"} className={`shop-chip ${cat === "*" ? "shop-chip-on" : ""}`}>{t("TOUT")} <b className={`ml-1.5 ${cat === "*" ? "" : "opacity-60"}`}>{vehicles.length}</b></button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`shop-chip ${cat === c ? "shop-chip-on" : ""}`}>{t(c).toUpperCase()} <b className={`ml-1.5 ${cat === c ? "" : "opacity-60"}`}>{counts.get(c)}</b></button>
          ))}
        </div>
      </div>
      <div className="mb-10 flex items-center gap-4">
        <div className="font-cond text-sm tracking-[.2em] text-metal" aria-live="polite" data-count>{t("{n} véhicule(s)", { n: shown.length })}</div>
        {reset && <button type="button" onClick={() => { setQ(""); setCat("*"); setBrand("*"); }} className="font-cond text-xs font-bold tracking-[.2em] text-red hover:text-white">{t("RÉINITIALISER")}</button>}
      </div>

      <div className="grid gap-12">
        {groups.map(([c, list]) => (
          <section key={c} aria-label={t(c)}>
            <div className="shop-head">
              <h2 className="flex items-center gap-3 font-display text-3xl uppercase tracking-wide">{sort === "az" && (() => { const I = catIcon(c); return <I size={26} strokeWidth={1.5} className="text-red" aria-hidden />; })()}{t(c)}</h2>
              <span className="font-cond text-xs tracking-[.2em] text-metal">{list.length}</span>
            </div>
            <ul className={view === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "grid grid-cols-1 gap-2"}>{list.map(card)}</ul>
          </section>
        ))}
      </div>
      {!groups.length && <p className="panel text-[#a5a9b0]">{t("Aucun véhicule ne correspond à ta recherche.")}</p>}

      <dialog ref={dlg} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) close(); }} className="veh-dialog" aria-labelledby="veh-dialog-title">
        {open && (() => {
          const I = catIcon(open.category);
          const spec = (label: string, value: string | number | null | undefined, unit = "") => value || value === 0 ? <div className="veh-spec"><div className="label !mb-1">{label}</div><div className="font-display text-3xl leading-none">{value}{unit && <span className="font-cond ml-1.5 text-sm tracking-[.16em] text-metal">{unit}</span>}</div></div> : null;
          return (
            <div>
              <div className="route-dialog-head">
                <span className="kicker flex items-center gap-2"><I size={16} aria-hidden /> {t(open.category).toUpperCase()}</span>
                <button type="button" onClick={close} className="route-dialog-close" aria-label={t("Fermer")} autoFocus><X size={18} /></button>
              </div>
              <div className="veh-hero" aria-hidden><Thumb v={open} big /></div>
              <div className="p-7">
                <h2 id="veh-dialog-title" className="font-display text-5xl uppercase leading-none sm:text-6xl">{open.name}</h2>
                <div className="font-cond mt-2 text-lg uppercase tracking-[.16em] text-metal">{open.model}</div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="badge badge-metal">{open.brand}</span>
                  <span className="badge badge-ok inline-flex items-center gap-1.5"><Check size={13} aria-hidden /> {t("AUTORISÉ EN DUEL")}</span>
                </div>
                <div className="mt-7">
                  <div className="mb-2 flex items-end justify-between"><span className="label !mb-0">{t("Puissance")}</span><span className="font-display text-4xl leading-none text-red">{open.hp ?? "—"} <span className="font-cond text-sm tracking-[.2em] text-metal">{t("CH")}</span></span></div>
                  <span className="veh-bar veh-bar-lg" aria-hidden><i style={{ width: `${hpPct(open)}%` }} /></span>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {spec(t("Places"), open.seats)}
                  {spec(t("Coffre"), open.trunk, "kg")}
                  {spec(t("Boîte"), open.gearbox ? t(open.gearbox) : null)}
                  {spec(t("Carburant"), open.fuel ? t(open.fuel) : null)}
                </div>
                <p className="mt-7 flex items-center gap-2 text-sm text-metal"><Users size={15} aria-hidden /> {t("Ce véhicule peut être engagé en duel une fois homologué par l'organisation.")}</p>
              </div>
            </div>
          );
        })()}
      </dialog>
    </div>
  );
}
