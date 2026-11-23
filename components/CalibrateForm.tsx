"use client";
import { useActionState } from "react";
import { useT } from "@/components/LangProvider";
import { calibrateScale } from "@/app/actions/editor";
import type { ActionState } from "@/lib/types";

/** Calibrage de l'échelle de la carte : on trace un parcours dont on connaît la distance en jeu, puis on saisit cette distance. */
export default function CalibrateForm({ current }: { current: number }) {
  const t = useT();
  const [state, action, pending] = useActionState(async (prev: ActionState, f: FormData) => {
    const el = document.querySelector<HTMLInputElement>('input[name="path"]'); f.set("path", el?.value ?? "");
    return calibrateScale(prev, f);
  }, {} as ActionState);
  return (
    <details className="req-card mt-8">
      <summary className="cursor-pointer font-cond text-sm font-bold tracking-[.18em] text-red">{t("CALIBRER L'ÉCHELLE DES DISTANCES")} — {t("actuellement")} {current} {t("m par pixel")}</summary>
      <p className="mt-3 max-w-3xl text-sm text-[#a5a9b0]">{t("La distance affichée est une estimation. Pour la rendre exacte : trace plus haut un parcours dont tu connais la longueur réelle en jeu, saisis cette longueur ici, puis enregistre. Toutes les distances suivantes s'appuient sur cette échelle (réservé au super administrateur).")}</p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">{t("Distance réelle du tracé (km)")}</span><input name="km" required inputMode="decimal" placeholder="4,2" className="input w-40" /></label>
        <button disabled={pending} className="btn btn-dark btn-sm">{pending ? <span className="spin" aria-label="…" /> : t("ENREGISTRER L'ÉCHELLE")}</button>
        {state.message && <span role="status" className={`toast ${state.ok ? "toast-ok" : "toast-err"}`}>{state.message}</span>}
      </form>
    </details>
  );
}
