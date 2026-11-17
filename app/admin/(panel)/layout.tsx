import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/auth";

const NAV: [string, string][] = [
  ["/admin", "DASHBOARD"], ["/admin/drivers", "DRIVERS"], ["/admin/ranking", "RANKING"], ["/admin/vehicles", "VEHICLES"], ["/admin/challenges", "CHALLENGES"],
  ["/admin/tracks", "RACE TRACKS"], ["/admin/warmup", "WARM-UP"], ["/admin/rewards", "CASH PRIZE"], ["/admin/reserve", "RESERVE"],
  ["/admin/inactivity", "INACTIVITY"], ["/admin/news", "NEWS"], ["/admin/rules", "RULES"], ["/admin/logs", "AUDIT LOG"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-white/10 bg-[#06070a] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="p-5">
          <Link href="/admin" className="font-display block text-2xl leading-tight">BBC <span className="text-red">CONTROL</span><br />CENTER</Link>
          <div className="font-cond mt-1 text-[11px] tracking-[.3em] text-metal">{isSuperAdmin ? "SUPER ADMIN" : "ORGANISATEUR"}</div>
        </div>
        <nav className="font-cond flex gap-1 overflow-x-auto px-3 pb-3 text-[13px] font-semibold tracking-[.16em] lg:flex-col lg:overflow-visible">
          {NAV.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap border-l-2 border-transparent px-3 py-2 text-[#bcbfc5] transition hover:border-red hover:bg-white/5 hover:text-white">{label}</Link>)}
          <Link href="/" className="whitespace-nowrap px-3 py-2 text-metal hover:text-white lg:mt-4">← PUBLIC SITE</Link>
          <form action={logout}><button className="px-3 py-2 text-metal hover:text-white">LOGOUT</button></form>
        </nav>
      </aside>
      <main className="min-w-0 p-5 sm:p-8">{children}</main>
    </div>
  );
}
