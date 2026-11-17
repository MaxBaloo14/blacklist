"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
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
};

export default function ActionForm({ action, children, label, confirm, variant = "red", small, className = "", reset = true, encType }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    if (state.ok && reset) formRef.current?.reset();
  }, [state.nonce, state.ok, reset]);

  return (
    <form
      ref={formRef}
      action={formAction}
      encType={encType}
      className={className}
      onSubmit={(e) => {
        if (confirm && !confirmed.current) {
          e.preventDefault();
          dialogRef.current?.showModal();
        }
        confirmed.current = false;
      }}
    >
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`btn btn-${variant} ${small ? "btn-sm" : ""}`}>
          {pending ? "…" : label}
        </button>
        {state.message && (
          <span role="status" aria-live="polite" className={`text-sm ${state.ok ? "text-ok" : "text-[#ff6b6b]"}`}>
            {state.message}
          </span>
        )}
      </div>

      {confirm && (
        <dialog ref={dialogRef} className="m-auto max-w-md border border-red-dark bg-ink2 p-0 text-bone backdrop:bg-black/80 backdrop:backdrop-blur-sm">
          <div className="p-7">
            <div className="kicker mb-2">Confirmation</div>
            <p className="mb-6 text-[15px] leading-relaxed">{confirm}</p>
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
                Confirm
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
            </div>
          </div>
        </dialog>
      )}
    </form>
  );
}
