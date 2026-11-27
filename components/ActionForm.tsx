"use client";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/components/LangProvider";
import type { ActionState } from "@/lib/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label: string;
  /** Demande une confirmation avant l'envoi (actions importantes). */
  confirm?: string;
  variant?: "red" | "ghost" | "dark";
  small?: boolean;
  className?: string;
  reset?: boolean;
  encType?: string;
  /** Bouton grisé (ex. solde insuffisant). */
  disabled?: boolean;
  /** Appelé après une action réussie. */
  onDone?: () => void;
};

export default function ActionForm({ action, children, label, confirm, variant = "red", small, className = "", reset = true, encType, disabled, onDone }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    if (state.ok && reset) formRef.current?.reset();
    if (state.ok) onDone?.();
  }, [state.nonce, state.ok, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      ref={formRef}
      action={reset ? formAction : undefined}
      encType={encType}
      className={className}
      onSubmit={(e) => {
        if (confirm && !confirmed.current) {
          e.preventDefault();
          dialogRef.current?.showModal();
          confirmed.current = false;
          return;
        }
        confirmed.current = false;
        // reset={false} : React 19 remet sinon TOUS les champs à zéro après chaque envoi (même en cas d'erreur du serveur : mot de passe, véhicule choisi… perdus).
        // On envoie donc nous-mêmes les données, sans laisser React vider le formulaire.
        if (!reset) {
          e.preventDefault();
          const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => formAction(data));
        }
      }}
    >
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || disabled} className={`btn btn-${variant} ${small ? "btn-sm" : ""}`}>
          {pending ? <span className="spin" aria-label="…" /> : t(label)}
        </button>
        {state.message && (
          <span key={state.nonce ?? state.message} role="status" aria-live="polite" className={`toast ${state.ok ? "toast-ok" : "toast-err"}`}>
            <span aria-hidden>{state.ok ? "✓" : "!"}</span> {state.message}
          </span>
        )}
      </div>

      {confirm && (
        <dialog ref={dialogRef} className="m-auto max-w-md border border-red-dark bg-ink2 p-0 text-bone backdrop:bg-black/80 backdrop:backdrop-blur-sm">
          <div className="p-7">
            <div className="kicker mb-2">{t("Confirmation")}</div>
            <p className="mb-6 text-[15px] leading-relaxed">{t(confirm)}</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-red btn-sm"
                onClick={() => {
                  confirmed.current = true;
                  dialogRef.current?.close();
                  formRef.current?.requestSubmit();
                }}
              >
                {t("CONFIRMER")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()}>
                {t("ANNULER")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </form>
  );
}
