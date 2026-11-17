import Link from "next/link";
import { AdminHead, Stat } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { localizeNotif } from "@/lib/notif-i18n";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { t, locale, lang } = await getI18n();
  const { supabase, user } = await requireAdmin();
  await supabase.rpc("run_alerts");   // délais de 48 h dépassés + inactivité (alertes seulement, aucune sanction automatique)
  const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [drivers, pendingReg, ranked, active, vehicles, races, warmups, rewards, inactive, overdue, { data: alerts }] = await Promise.all([
    c(supabase.from("profiles").select("id", { count: "exact", head: true })),
    c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("registration_status", "pending")),
    c(supabase.from("blacklist_rankings").select("position", { count: "exact", head: true }).not("driver_id", "is", null)),
    c(supabase.from("challenges").select("id", { count: "exact", head: true }).in("status", ["awaiting_schedule", "scheduled", "awaiting_validation"])),
    c(supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(supabase.from("challenges").select("id", { count: "exact", head: true }).eq("status", "scheduled")),
    c(supabase.from("warmup_events").select("id", { count: "exact", head: true }).in("status", ["scheduled", "running"])),
    c(supabase.from("rewards").select("id", { count: "exact", head: true }).eq("status", "pending")),
    c(supabase.from("inactivity_overview").select("driver_id", { count: "exact", head: true }).eq("needs_attention", true)),
    c(supabase.from("challenges").select("id", { count: "exact", head: true }).eq("status", "awaiting_schedule").lt("respond_by", new Date().toISOString())),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const awaiting = await c(supabase.from("challenges").select("id", { count: "exact", head: true }).eq("status", "awaiting_validation"));
  return (
    <>
      <AdminHead kicker={t("VUE D'ENSEMBLE")} title={t("Tableau de bord")}>{t("Vue d'ensemble de la compétition. Les chiffres en rouge demandent une action.")}</AdminHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Pilotes inscrits")} value={drivers} />
        <Stat label={t("Membres de la Blacklist")} value={`${ranked}/10`} />
        <Stat label={t("Défis actifs")} value={active} />
        <Stat label={t("Courses programmées")} value={races + warmups} />
        <Link href="/admin/vehicles"><Stat label={t("Véhicules à homologuer")} value={vehicles} tone={vehicles ? "text-red" : ""} /></Link>
        <Link href="/admin/drivers?filter=pending"><Stat label={t("Inscriptions à valider")} value={pendingReg} tone={pendingReg ? "text-red" : ""} /></Link>
        <Link href="/admin/rewards"><Stat label={t("Récompenses en attente")} value={rewards} tone={rewards ? "text-red" : ""} /></Link>
        <Link href="/admin/inactivity"><Stat label={t("Alertes d'inactivité")} value={inactive} tone={inactive ? "text-red" : ""} /></Link>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Link href="/admin/challenges"><Stat label={t("Résultats à valider")} value={awaiting} tone={awaiting ? "text-red" : ""} /></Link>
        <Link href="/admin/challenges"><Stat label={t("Dates non fixées (48 h dépassées)")} value={overdue} tone={overdue ? "text-red" : ""} /></Link>
      </div>
      <h2 className="font-cond mb-3 mt-10 text-lg font-bold uppercase tracking-[.18em]">{t("Alertes organisation")}</h2>
      {alerts?.length ? (
        <ul className="grid gap-2">{alerts.map((a) => (
          <li key={a.id}><Link href={a.link ?? "/admin"} className={`block border-l-4 bg-ink2 px-4 py-3 hover:bg-ink3 ${a.read_at ? "border-white/10" : "border-red"}`}>
            <span className="font-cond text-xs tracking-[.2em] text-metal">{dateTime(a.created_at, locale)} · {localizeNotif(a, lang).kind}</span>
            <span className="font-cond block text-lg font-bold tracking-wide">{localizeNotif(a, lang).title}</span>{a.body && <span className="text-sm text-[#a5a9b0]">{localizeNotif(a, lang).body}</span>}
          </Link></li>
        ))}</ul>
      ) : <p className="panel text-[#a5a9b0]">{t("Aucune alerte.")}</p>}
    </>
  );
}
