"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { useT } from "@/components/LangProvider";
import { submitClaim } from "@/app/actions/requests";

const MAX = 5;

/** Formulaire de réclamation : titre, message et jusqu'à 5 liens (vidéo ou image). */
export default function ClaimForm() {
  const t = useT();
  const [links, setLinks] = useState<string[]>([""]);
  return (
    <ActionForm action={submitClaim} label="ENVOYER LA RÉCLAMATION" onDone={() => setLinks([""])} className="grid gap-5">
      <Field label={t("Titre")}><input name="title" required minLength={3} maxLength={120} className="input" placeholder={t("Ex. Résultat du duel de dimanche contesté")} /></Field>
      <Field label={t("Message")}><textarea name="message" required minLength={10} maxLength={3000} rows={6} className="input" placeholder={t("Explique ce qui s'est passé, avec les détails utiles (date, pilotes, circuit…).")} /></Field>
      <fieldset className="grid gap-2">
        <legend className="label">{t("Liens vidéo ou image (facultatif, 5 maximum)")}</legend>
        {links.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input name="link" type="url" inputMode="url" value={v} maxLength={500} placeholder="https://medal.tv/… · https://youtube.com/… · https://i.imgur.com/…"
              aria-label={`${t("Lien")} ${i + 1}`} onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} className="input min-w-0 flex-1" />
            {links.length > 1 && <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={`${t("Retirer le lien")} ${i + 1}`} className="btn btn-ghost btn-sm !px-3"><X size={16} /></button>}
          </div>
        ))}
        {links.length < MAX && <button type="button" onClick={() => setLinks([...links, ""])} className="font-cond inline-flex w-fit items-center gap-2 text-sm font-bold tracking-[.14em] text-red hover:text-white"><Plus size={16} /> {t("AJOUTER UN LIEN")}</button>}
      </fieldset>
    </ActionForm>
  );
}
