import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { logout } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ isSuperAdmin }, t] = await Promise.all([requireAdmin(), getT()]);
  const NAV: [string, string][] = [
    ["/admin", t("TABLEAU DE BORD")], ["/admin/drivers", t("PILOTES")], ["/admin/ranking", t("CLASSEMENT")], ["/admin/vehicles", t("VÉHICULES")], ["/admin/challenges", t("DÉFIS")],
    ["/admin/tracks", t("CIRCUITS")], ["/admin/warmup", "WARM-UP"], ["/admin/rewards", "CASH PRIZE"], ["/admin/reserve", t("RÉSERVE")],
    ["/admin/inactivity", t("INACTIVITÉ")], ["/admin/news", t("ACTUALITÉS")], ["/admin/rules", t("RÈGLES")], ["/admin/logs", t("JOURNAL D'AUDIT")],
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-white/10 bg-[#06070a] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <Link href="/admin" className="font-display block text-2xl leading-tight">BBC <span className="text-red">CONTROL</span><br />CENTER</Link>
            <div className="font-cond mt-1 text-[11px] tracking-[.3em] text-metal">{isSuperAdmin ? "SUPER ADMIN" : t("ORGANISATEUR")}</div>
          </div>
          <LangSwitch />
        </div>
        <nav className="font-cond flex gap-1 overflow-x-auto px-3 pb-3 text-[13px] font-semibold tracking-[.16em] lg:flex-col lg:overflow-visible">
          {NAV.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap border-l-2 border-transparent px-3 py-2 text-[#bcbfc5] transition hover:border-red hover:bg-white/5 hover:text-white">{label}</Link>)}
          <Link href="/" className="whitespace-nowrap px-3 py-2 text-metal hover:text-white lg:mt-4">{t("← SITE PUBLIC")}</Link>
          <form action={logout}><button className="px-3 py-2 text-metal hover:text-white">{t("DÉCONNEXION")}</button></form>
        </nav>
      </aside>
      <main className="min-w-0 p-5 sm:p-8">{children}</main>
    </div>
  );
}
