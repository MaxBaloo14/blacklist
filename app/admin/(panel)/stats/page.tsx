import { AdminHead, Stat } from "@/components/AdminUI";
import BarChart, { type Bar } from "@/components/BarChart";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const WEEKS = 12;
const weekStart = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };

export default async function StatsPage() {
  const { t, locale } = await getI18n();
  const { supabase } = await requireAdmin();
  const since = new Date(Date.now() - WEEKS * 7 * 864e5).toISOString();
  const [{ data: profiles }, { data: challenges }, { data: rewards }, { data: approvals }, { data: pays }] = await Promise.all([
    supabase.from("profiles").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("challenges").select("created_at,status,winner_id,challenger_id,validated_at").limit(5000),
    supabase.from("rewards").select("amount,status").limit(5000),
    supabase.from("vehicle_approvals").select("decision").limit(5000),
    supabase.from("reward_payments").select("paid_at,reward_id").gte("paid_at", since).limit(5000),
  ]);
  const { count: totalDrivers } = await supabase.from("profiles").select("id", { count: "exact", head: true });

  const thisWeek = weekStart(new Date());
  const buckets = Array.from({ length: WEEKS }, (_, i) => new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * 864e5));
  const label = (d: Date) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
  const series = (dates: (string | null | undefined)[], weightOf?: (i: number) => number): Bar[] => {
    const vals = buckets.map(() => 0);
    dates.forEach((s, idx) => { if (!s) return; const w = weekStart(new Date(s)).getTime(); const i = buckets.findIndex((b) => b.getTime() === w); if (i >= 0) vals[i] += weightOf ? weightOf(idx) : 1; });
    return buckets.map((b, i) => ({ label: label(b), value: vals[i], tip: `${t("Semaine du")} ${label(b)} : ${vals[i]}` }));
  };

  const ch = challenges ?? [];
  const done = ch.filter((c) => c.status === "completed");
  const challengerWins = done.filter((c) => c.winner_id === c.challenger_id).length;
  const defenderWins = done.length - challengerWins;
  const cancelled = ch.filter((c) => c.status === "cancelled").length, forfeited = ch.filter((c) => c.status === "forfeited").length;
  const paid = (rewards ?? []).filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const pending = (rewards ?? []).filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);
  const ok = (approvals ?? []).filter((a) => a.decision === "approved").length;
  const bad = (approvals ?? []).filter((a) => a.decision !== "approved").length;
  const approvalRate = ok + bad ? Math.round((ok / (ok + bad)) * 100) : null;
  const pct = done.length ? Math.round((challengerWins / done.length) * 100) : null;

  return (
    <>
      <AdminHead kicker={t("ANALYSE")} title={t("Tableau de bord des chiffres")}>{t("L'activité des 12 dernières semaines et les totaux depuis le début.")}</AdminHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Pilotes inscrits")} value={totalDrivers ?? 0} />
        <Stat label={t("Duels validés")} value={done.length} />
        <Stat label={t("Cash Prize versé")} value={money(paid, locale)} tone="text-ok" />
        <Stat label={t("Cash Prize à verser")} value={money(pending, locale)} tone={pending ? "text-red" : ""} />
        <Stat label={t("Taux d'homologation")} value={approvalRate === null ? "—" : `${approvalRate} %`} />
        <Stat label={t("Duels annulés")} value={cancelled} />
        <Stat label={t("Forfaits")} value={forfeited} />
        <Stat label={t("Défis lancés")} value={ch.length} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="panel"><BarChart title={t("Inscriptions par semaine")} unit={t("12 semaines")} bars={series((profiles ?? []).map((p) => p.created_at))} tableLabel={t("Voir le tableau des données")} valueHeader={t("Inscriptions")} /></div>
        <div className="panel"><BarChart title={t("Défis lancés par semaine")} unit={t("12 semaines")} bars={series(ch.map((c) => c.created_at))} tableLabel={t("Voir le tableau des données")} valueHeader={t("Défis")} /></div>
        <div className="panel"><BarChart title={t("Duels validés par semaine")} unit={t("12 semaines")} bars={series(done.map((c) => c.validated_at))} tableLabel={t("Voir le tableau des données")} valueHeader={t("Duels")} /></div>
        <div className="panel"><BarChart title={t("Paiements de Cash Prize par semaine")} unit={t("12 semaines")} bars={series((pays ?? []).map((p) => p.paid_at))} tableLabel={t("Voir le tableau des données")} valueHeader={t("Paiements")} /></div>
      </div>

      <div className="panel mt-6">
        <div className="mb-3 flex items-baseline justify-between"><span className="font-cond text-sm font-bold uppercase tracking-[.18em]">{t("Qui gagne les duels ?")}</span><span className="font-cond text-xs tracking-[.14em] text-metal">{done.length} {t("duel(s)")}</span></div>
        {done.length ? (
          <>
            <div className="flex h-8 overflow-hidden" role="img" aria-label={`${t("Challengers")} ${pct} %, ${t("Défendeurs")} ${100 - (pct ?? 0)} %`}>
              <div className="grid place-items-center bg-red font-cond text-sm font-bold" style={{ width: `${pct}%` }}>{pct} %</div>
              <div className="grid place-items-center border-l-2 border-ink2 bg-[#3a3d44] font-cond text-sm font-bold" style={{ width: `${100 - (pct ?? 0)}%` }}>{100 - (pct ?? 0)} %</div>
            </div>
            <div className="font-cond mt-2 flex gap-6 text-xs tracking-[.14em] text-[#cfcfcf]"><span><i className="cal-dot bg-red" />{t("Challengers")} : {challengerWins}</span><span><i className="cal-dot bg-[#3a3d44]" />{t("Défendeurs")} : {defenderWins}</span></div>
          </>
        ) : <p className="text-sm text-metal">{t("Pas encore de duel terminé.")}</p>}
      </div>
    </>
  );
}
