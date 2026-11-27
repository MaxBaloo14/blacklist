"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import CarThumb from "@/components/CarThumb";
import { useT } from "@/components/LangProvider";
import { searchCatalog, type CatalogVehicle } from "@/lib/vehicle-catalog";

/** Choix du véhicule dans la liste des véhicules autorisés : recherche instantanée avec photos, marque/modèle et catégorie remplis automatiquement.
 *  Envoie `catalog_slug` (le serveur retrouve tout le reste dans la liste : rien d'autre n'est accepté). */
export default function VehiclePicker({ disabled }: { disabled?: boolean }) {
  const t = useT();
  const id = useId();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CatalogVehicle | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchCatalog(q, 8), [q]);

  const choose = (v: CatalogVehicle) => { setPicked(v); setQ(""); setOpen(false); };
  const clear = () => { setPicked(null); setQ(""); setTimeout(() => input.current?.focus(), 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="grid gap-2" data-vehicle-picker>
      <input type="hidden" name="catalog_slug" value={picked?.slug ?? ""} />
      {picked ? (
        <div className="flex items-center gap-4 border border-white/10 bg-ink2 p-3" data-picked>
          <CarThumb slug={picked.slug} className="car-thumb-slant w-28 shrink-0" iconSize={24} />
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-2xl uppercase leading-tight">{picked.label}</div>
            <div className="font-cond text-xs tracking-[.2em] text-metal">{t(picked.category).toUpperCase()}{picked.hp ? ` · ${picked.hp} ${t("CH")}` : ""}</div>
          </div>
          <span className="badge badge-ok hidden items-center gap-1.5 sm:inline-flex"><Check size={13} aria-hidden /> {t("AUTORISÉ")}</span>
          <button type="button" onClick={clear} disabled={disabled} className="btn btn-ghost btn-sm" aria-label={t("Changer de véhicule")}><X size={16} aria-hidden /></button>
        </div>
      ) : (
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-metal" aria-hidden />
          <input
            ref={input} type="text" value={q} disabled={disabled} autoComplete="off" spellCheck={false} maxLength={60}
            role="combobox" aria-expanded={open && results.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
            aria-label={t("Véhicule")} placeholder={t("Tape le nom de ton véhicule (ex. Blista)…")} required
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); e.currentTarget.setCustomValidity(t("Choisis ton véhicule dans la liste.")); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
            onInvalid={(e) => e.currentTarget.setCustomValidity(t("Choisis ton véhicule dans la liste."))}
            className="input !pl-11"
          />
          {open && q.trim() && (
            <ul id={`${id}-list`} role="listbox" aria-label={t("Véhicules autorisés")} className="veh-pick-list">
              {results.length ? results.map((v, i) => (
                <li key={v.slug} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(v); }} onMouseEnter={() => setActive(i)} className={`veh-pick-opt ${i === active ? "veh-pick-opt-on" : ""}`}>
                  <CarThumb slug={v.slug} className="car-thumb-slant w-20 shrink-0" iconSize={16} />
                  <span className="min-w-0 flex-1"><span className="font-display block truncate text-xl uppercase leading-tight">{v.label}</span><span className="font-cond text-[11px] tracking-[.18em] text-metal">{t(v.category).toUpperCase()}</span></span>
                  {v.hp ? <span className="font-cond text-sm font-bold text-red">{v.hp} {t("CH")}</span> : null}
                </li>
              )) : <li className="px-4 py-3 text-sm text-[#a5a9b0]" role="option" aria-selected={false} aria-disabled>{t("Aucun véhicule autorisé ne correspond. Consulte la liste complète.")}</li>}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-metal">{t("Seuls les véhicules de la liste sont acceptés : la catégorie se remplit toute seule.")}</p>
    </div>
  );
}
