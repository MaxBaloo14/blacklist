"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { useT } from "@/components/LangProvider";
import RouteDrawer from "@/components/RouteDrawer";
import { createPlanTrack } from "@/app/actions/editor";

export default function PlanEditorForm({ mPerPx }: { mPerPx?: number }) {
  const t = useT();
  const [k, setK] = useState(0);
  return (
    <ActionForm action={createPlanTrack} label="CRÉER LE CIRCUIT" confirm="Créer ce circuit ? Le plan et le tracé animé seront publiés sur le site." onDone={() => setK((n) => n + 1)} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("Nom du circuit")} className="lg:col-span-2"><input name="name" required minLength={2} maxLength={80} className="input" placeholder={t("Ex. Boucle du port")} /></Field>
        <Field label={t("Type")}><select name="race_type" defaultValue="Sprint urbain" className="input"><option>Sprint urbain</option><option>Circuit</option><option>Last Race</option><option>Warm-up</option></select></Field>
        <Field label={t("Difficulté")}><select name="difficulty" defaultValue="Medium" className="input"><option value="Easy">{t("Facile")}</option><option value="Medium">{t("Moyen")}</option><option value="Hard">{t("Difficile")}</option><option value="Extreme">{t("Extrême")}</option></select></Field>
      </div>
      <Field label={t("Description (facultatif)")}><input name="description" maxLength={1000} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#d12b2b]" defaultChecked onChange={(e) => { const h = e.currentTarget.form?.elements.namedItem("status") as HTMLInputElement | null; if (h) h.value = e.currentTarget.checked ? "active" : "inactive"; }} /> {t("Circuit actif (choisissable pour les duels)")}<input type="hidden" name="status" defaultValue="active" /></label>
      <RouteDrawer key={k} mPerPx={mPerPx} />
    </ActionForm>
  );
}
