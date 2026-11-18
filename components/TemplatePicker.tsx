"use client";
import { useId } from "react";
import { useT } from "@/components/LangProvider";

type Tpl = { id: string; title: string; body: string };

/** Menu « Modèle » : choisir un modèle remplit le champ de motif du même formulaire (modifiable ensuite). */
export default function TemplatePicker({ templates, target }: { templates: Tpl[]; target: string }) {
  const t = useT();
  const id = useId();
  if (!templates.length) return null;
  return (
    <label htmlFor={id} className="mb-2 block">
      <span className="label">{t("Modèle de message")}</span>
      <select id={id} defaultValue="" className="input" onChange={(e) => {
        const tpl = templates.find((x) => x.id === e.target.value);
        const input = e.target.form?.elements.namedItem(target) as HTMLInputElement | null;
        if (tpl && input) { input.value = tpl.body; input.focus(); }
        e.target.value = "";
      }}>
        <option value="">{t("Insérer un modèle…")}</option>
        {templates.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
      </select>
    </label>
  );
}
