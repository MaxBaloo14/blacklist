/** Cases grises animées affichées pendant le chargement d'une page. */
export const Skel = ({ className = "" }: { className?: string }) => <div className={`skel ${className}`} aria-hidden />;

export function PageSkeleton({ cards = 3, rows = 0 }: { cards?: number; rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement">
      <div className="border-b border-white/5 bg-gradient-to-b from-[#150c0d] to-ink pb-12 pt-32">
        <div className="wrap"><Skel className="mb-4 h-3 w-40" /><Skel className="h-14 w-full max-w-md" /><Skel className="mt-5 h-4 w-full max-w-xl" /></div>
      </div>
      <div className="wrap grid gap-4 py-14 md:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => <Skel key={i} className="h-56" />)}
      </div>
      {rows > 0 && <div className="wrap grid gap-2.5 pb-14">{Array.from({ length: rows }).map((_, i) => <Skel key={i} className="h-16" />)}</div>}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement">
      <div className="border-b border-white/5 bg-gradient-to-b from-[#150c0d] to-ink pb-12 pt-32"><div className="wrap"><Skel className="mb-4 h-3 w-40" /><Skel className="h-14 w-full max-w-md" /></div></div>
      <div className="wrap py-14">
        <div className="grid items-end gap-6 lg:grid-cols-3"><Skel className="h-44" /><Skel className="h-60" /><Skel className="h-36" /></div>
        <div className="mt-10 grid gap-2">{Array.from({ length: 7 }).map((_, i) => <Skel key={i} className="h-16" />)}</div>
      </div>
    </div>
  );
}
