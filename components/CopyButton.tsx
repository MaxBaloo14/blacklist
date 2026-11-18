"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/components/LangProvider";

/** Copie un texte dans le presse-papiers (ex. un IBAN) et confirme par « COPIÉ ». */
export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); }
    catch { const el = document.createElement("textarea"); el.value = value; document.body.appendChild(el); el.select(); document.execCommand("copy"); el.remove(); }
    setDone(true); setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={copy} aria-label={label ?? t("COPIER")} className={`copy-btn ${done ? "copy-btn-done" : ""}`}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? t("COPIÉ") : label ?? t("COPIER")}
    </button>
  );
}
