"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/components/LangProvider";

export type Vehicle = { name: string; brand: string; model: string; category: string; hp: number | null; seats: number | null };

/** Liste des véhicules autorisés : recherche instantanée + filtre par catégorie, groupée par catégorie. */
export default function VehicleList({ vehicles, categories }: { vehicles: Vehicle[]; categories: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("*");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return vehicles.filter((v) => (cat === "*" || v.category === cat) && (!n || norm(`${v.name} ${v.brand} ${v.model}`).includes(n)));
  }, [vehicles, q, cat]);
  const groups = categories.map((c) => [c, shown.filter((v) => v.category === c)] as const).filter(([, l]) => l.length);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="relative block w-full max-w-md">
          <span className="sr-only">{t("Rechercher un véhicule")}</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-metal" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Rechercher un véhicule ou une marque…")} className="input !pl-11" />
        </label>
        <div className="font-cond text-sm tracking-[.2em] text-metal" aria-live="polite" data-count>{t("{n} véhicule(s)", { n: shown.length })}</div>
      </div>
      <div role="group" aria-label={t("Catégories")} className="font-cond mb-12 flex flex-wrap gap-3 text-sm font-bold tracking-[.16em]">
        {[["*", t("TOUT")], ...categories.map((c) => [c, t(c).toUpperCase()])].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setCat(k)} aria-pressed={cat === k} className={`shop-chip ${cat === k ? "shop-chip-on" : ""}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-14">
        {groups.map(([c, list]) => (
          <section key={c} aria-label={t(c)}>
            <div className="shop-head"><h2 className="font-display text-3xl uppercase tracking-wide">{t(c)}</h2><span className="font-cond text-xs tracking-[.2em] text-metal">{list.length}</span></div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((v) => (
                <li key={`${v.brand}-${v.model}`} className="veh-card min-w-0">
                  <div className="min-w-0">
                    <div className="font-display truncate text-[26px] uppercase leading-[1.1]">{v.name}</div>
                    <div className="font-cond mt-1 truncate text-sm uppercase tracking-[.14em] text-metal">{v.model}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="badge badge-metal">{v.brand}</span>
                    {v.hp ? <span className="font-cond text-xs font-bold tracking-[.18em] text-red">{v.hp} {t("CH")}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {!groups.length && <p className="panel text-[#a5a9b0]">{t("Aucun véhicule ne correspond à ta recherche.")}</p>}
    </div>
  );
}
