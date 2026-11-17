import Link from "next/link";

export default function Tabs({ base, tabs, current }: { base: string; tabs: [string, string][]; current: string }) {
  return (
    <div role="tablist" className="font-cond mb-8 flex flex-wrap gap-1 border-b border-white/10 text-sm font-bold tracking-[.18em]">
      {tabs.map(([key, label]) => (
        <Link key={key} role="tab" aria-selected={current === key} href={`${base}?tab=${key}`} scroll={false}
          className={`-mb-px border-b-2 px-4 py-3 transition ${current === key ? "border-red text-white" : "border-transparent text-metal hover:text-white"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}
