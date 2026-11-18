import Link from "next/link";

export default function Tabs({ base, tabs, current, className = "mb-8" }: { base: string; tabs: [string, string][]; current: string; className?: string }) {
  return (
    <div role="tablist" className={`font-cond ${className} flex flex-wrap gap-1.5 text-sm font-bold tracking-[.18em]`}>
      {tabs.map(([key, label]) => (
        <Link key={key} role="tab" aria-selected={current === key} aria-current={current === key ? "page" : undefined} href={`${base}?tab=${key}`} scroll={false} className="tab !px-5 !py-3">
          {label}
        </Link>
      ))}
    </div>
  );
}
