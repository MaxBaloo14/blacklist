import type { ReactNode } from "react";
import type { Row } from "@/lib/types";

export function AdminHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 border-b border-white/10 pb-6">
      <div className="kicker mb-1.5">{kicker}</div>
      <h1 className="font-display text-4xl uppercase sm:text-5xl">{title}</h1>
      {children && <p className="mt-2 max-w-3xl text-sm text-[#a5a9b0]">{children}</p>}
    </header>
  );
}

export function Stat({ label, value, tone = "" }: { label: string; value: ReactNode; tone?: string }) {
  return <div className="bg-ink2 p-5"><div className={`font-display text-5xl ${tone}`}>{value}</div><div className="label mt-1 !mb-0">{label}</div></div>;
}

export function DriverSelect({ name, drivers, placeholder = "Choisir un pilote…", required = true, value }: { name: string; drivers: Row[]; placeholder?: string; required?: boolean; value?: string | null }) {
  return (
    <select name={name} required={required} defaultValue={value ?? ""} className="input">
      <option value="">{placeholder}</option>
      {drivers.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
    </select>
  );
}

export function Details({ summary, children, tone }: { summary: string; children: ReactNode; tone?: string }) {
  return (
    <details className="group border border-white/10 bg-ink open:bg-ink2">
      <summary className={`font-cond cursor-pointer list-none px-4 py-2.5 text-[13px] font-bold uppercase tracking-[.18em] marker:hidden hover:text-white ${tone ?? "text-[#bcbfc5]"}`}>
        <span className="mr-2 inline-block text-red transition group-open:rotate-90">▸</span>{summary}
      </summary>
      <div className="border-t border-white/10 p-4">{children}</div>
    </details>
  );
}

export const CSTATUS: Record<string, [string, string]> = {
  awaiting_schedule: ["Awaiting date", "badge-warn"], scheduled: ["Scheduled", "badge-ok"], awaiting_validation: ["To validate", "badge-red"],
  completed: ["Completed", "badge-metal"], cancelled: ["Cancelled", "badge-metal"], forfeited: ["Forfeit", "badge-red"],
};
