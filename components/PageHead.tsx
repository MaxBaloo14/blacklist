import type { ReactNode } from "react";

export default function PageHead({ kicker, title, em, children }: { kicker: string; title: string; em?: string; children?: ReactNode }) {
  return (
    <header className="relative border-b border-white/5 bg-gradient-to-b from-[#150c0d] to-ink pb-12 pt-32">
      <div className="wrap">
        <div className="kicker mb-3">{kicker}</div>
        <h1 className="h2">{title} {em && <em>{em}</em>}</h1>
        {children && <p className="mt-4 max-w-2xl text-[15px] text-[#a5a9b0]">{children}</p>}
      </div>
    </header>
  );
}
