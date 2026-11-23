"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { useT } from "@/components/LangProvider";
import RouteDrawer from "@/components/RouteDrawer";
import { createPlanTrack, saveDraft } from "@/app/actions/editor";
import type { Pt } from "@/lib/route";

export type EditorInitial = {
  track?: string; draft?: string; name?: string; race_type?: string; difficulty?: string; description?: string; status?: string; distance_km?: number | null;
  points?: Pt[]; follow?: boolean;
};

/** Éditeur de circuit : création, retouche d'un circuit existant (même identifiant, duels conservés) ou reprise d'un brouillon. */
export default function PlanEditorForm({ mPerPx, initial = {} }: { mPerPx?: number; initial?: EditorInitial }) {
  const t = useT();
  const router = useRouter();
  const [k, setK] = useState(0);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const updating = Boolean(initial.track);
  const draft = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.closest("form"); if (!form) return;
    const f = new FormData(form);
    start(async () => {
      const r = await saveDraft(f);
      setMsg({ ok: Boolean(r.ok), text: r.message ?? "" });
      if (r.ok && r.id && !initial.draft) router.replace(`/admin/editor?draft=${r.id}`);
    });
  };
  return (
    <ActionForm action={createPlanTrack} label={updating ? "METTRE À JOUR LE CIRCUIT" : "CRÉER LE CIRCUIT"} reset={!updating && !initial.draft}
      confirm={updating ? "Remplacer le plan et le tracé de ce circuit ? Le circuit et ses duels sont conservés." : "Créer ce circuit ? Le plan et le tracé animé seront publiés sur le site."}
      onDone={() => { if (initial.draft) router.replace("/admin/editor"); else if (!updating) setK((n) => n + 1); }} className="grid gap-5">
      {initial.track && <input type="hidden" name="track" value={initial.track} />}
      {initial.draft && <input type="hidden" name="draft" value={initial.draft} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("Nom du circuit")} className="lg:col-span-2"><input name="name" required minLength={2} maxLength={80} defaultValue={initial.name} className="input" placeholder={t("Ex. Boucle du port")} /></Field>
        <Field label={t("Type")}><select name="race_type" defaultValue={initial.race_type ?? "Sprint urbain"} className="input"><option>Sprint urbain</option><option>Circuit</option><option>Last Race</option><option>Warm-up</option></select></Field>
        <Field label={t("Difficulté")}><select name="difficulty" defaultValue={initial.difficulty ?? "Medium"} className="input"><option value="Easy">{t("Facile")}</option><option value="Medium">{t("Moyen")}</option><option value="Hard">{t("Difficile")}</option><option value="Extreme">{t("Extrême")}</option></select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label={t("Description (facultatif)")}><input name="description" maxLength={1000} defaultValue={initial.description} className="input" /></Field>
        <Field label={t("Distance (km)")} hint={t("Laisser vide = distance estimée du tracé.")}><input name="distance_km" inputMode="decimal" defaultValue={initial.distance_km ?? ""} placeholder={t("auto")} className="input" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#d12b2b]" defaultChecked={initial.status !== "inactive"} onChange={(e) => { const h = e.currentTarget.form?.elements.namedItem("status") as HTMLInputElement | null; if (h) h.value = e.currentTarget.checked ? "active" : "inactive"; }} /> {t("Circuit actif (choisissable pour les duels)")}<input type="hidden" name="status" defaultValue={initial.status ?? "active"} /></label>
      {updating && !initial.points?.length && <p className="text-sm text-[#ffd48a]">{t("Ce circuit n'a pas été créé avec l'éditeur : retrace son parcours sur la carte. À l'enregistrement, son image et son tracé sont remplacés ; le circuit et ses duels sont conservés.")}</p>}
      <RouteDrawer key={k} mPerPx={mPerPx} maxPoints={Number.POSITIVE_INFINITY} initial={initial.points?.length ? { points: initial.points, follow: initial.follow ?? true } : undefined} />
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <button type="button" onClick={draft} disabled={pending} className="btn btn-ghost btn-sm">{pending ? <span className="spin" aria-label="…" /> : t("ENREGISTRER LE BROUILLON")}</button>
        {msg && <span role="status" className={`toast ${msg.ok ? "toast-ok" : "toast-err"}`}>{msg.text}</span>}
        <span className="text-xs text-metal">{t("Un brouillon n'est visible que de l'organisation : tu peux le reprendre plus tard.")}</span>
      </div>
    </ActionForm>
  );
}
