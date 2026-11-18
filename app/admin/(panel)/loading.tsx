import { Skel } from "@/components/Skeleton";
export default function Loading() { return <div role="status" aria-busy="true" className="grid gap-4"><Skel className="h-10 w-72" /><Skel className="h-6 w-full max-w-xl" /><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-28" />)}</div></div>; }
