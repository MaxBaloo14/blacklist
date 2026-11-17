import AdminChallenge from "@/components/AdminChallenge";
import { AdminHead } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/auth";
import type { Row } from "@/lib/types";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ChallengesAdmin() {
  const { t, locale } = await getI18n();
  const { supabase } = await requireAdmin();
  const [{ data: all }, { data: profiles }, { data: tracks }] = await Promise.all([
    supabase.from("challenges").select("*, challenge_races(*, race_results(winner_id))").order("created_at", { ascending: false }).limit(150),
    supabase.from("profiles").select("id,first_name,last_name"),
    supabase.from("race_tracks").select("id,name"),
  ]);
  const names: Row = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const group = (f: (c: Row) => boolean) => (all ?? []).filter(f);
  const toValidate = group((c) => c.status === "awaiting_validation");
  const late = group((c) => c.status === "awaiting_schedule" && new Date(c.respond_by) < new Date());
  const active = group((c) => ["awaiting_schedule", "scheduled"].includes(c.status) && !late.includes(c));
  const done = group((c) => ["completed", "cancelled", "forfeited"].includes(c.status));
  const Section = ({ title, list, tone }: { title: string; list: Row[]; tone?: string }) => (
    <section className="mb-12">
      <h2 className={`font-cond mb-3 text-lg font-bold uppercase tracking-[.18em] ${tone ?? ""}`}>{title} ({list.length})</h2>
      {list.length ? <div className="grid gap-4">{list.map((c) => <AdminChallenge key={c.id} c={c} names={names} tracks={tracks ?? []} />)}</div> : <p className="panel text-[#a5a9b0]">{t("Rien à afficher.")}</p>}
    </section>
  );
  return (
    <>
      <AdminHead kicker={t("COMPÉTITION")} title={t("Défis")}>{t("Aucun résultat n'est officiel sans ton intervention : saisis les manches, puis valide. Le gagnant d'un duel du podium est calculé automatiquement (2 victoires).")}</AdminHead>
      <Section title={t("Résultats à valider")} list={toValidate} tone="text-red" />
      <Section title={t("Dates non fixées — délai dépassé")} list={late} tone="text-red" />
      <Section title={t("Défis actifs")} list={active} />
      <Section title={t("Historique")} list={done.slice(0, 40)} />
    </>
  );
}
