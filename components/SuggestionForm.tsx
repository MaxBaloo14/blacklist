"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { useT } from "@/components/LangProvider";
import RouteDrawer from "@/components/RouteDrawer";
import { submitSuggestion } from "@/app/actions/requests";

export default function SuggestionForm({ mPerPx }: { mPerPx?: number }) {
  const t = useT();
  const [k, setK] = useState(0);
  return (
    <ActionForm action={submitSuggestion} label="ENVOYER MA SUGGESTION" onDone={() => setK((n) => n + 1)} className="grid gap-5">
      <Field label={t("Nom de la course")}><input name="name" required minLength={3} maxLength={60} className="input" placeholder={t("Ex. Boucle du port")} /></Field>
      <Field label={t("Description (facultatif)")}><textarea name="description" maxLength={1000} rows={3} className="input" placeholder={t("Type de route, ambiance, passages clés…")} /></Field>
      <RouteDrawer key={k} mPerPx={mPerPx} />
    </ActionForm>
  );
}
