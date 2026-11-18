import type { ReactNode } from "react";

export default function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field block ${className}`}>
      <span className="label">{label}</span>
      {children}
      <span className="field-line" aria-hidden />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}
