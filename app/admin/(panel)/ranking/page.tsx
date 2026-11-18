import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import Field from "@/components/Field";
import { setRanking } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";
import { localizeReason } from "@/lib/notif-i18n";

export const dynamic = "force-dynamic";

export default async function RankingAdmin() {
  const { t, locale, lang } = await getI18n();
  const L = labels(t);
  const { supabase } = await requireAdmin();
  const [{ data: ranks }, { data: drivers }, { data: hist }, { count: active }] = await Promise.all([
    supabase.from("blacklist_rankings").select("*").order("position"),
    supabase.from("profiles").select("id,first_name,last_name").eq("registration_status", "validated").order("last_name"),
    supabase.from("ranking_history").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("challenges").select("id", { count: "exact", head: true }).in("status", ["awaiting_schedule", "scheduled", "awaiting_validation"]),
  ]);
  const name = (id: string | null) => { const d = drivers?.find((x) => x.id === id); return d ? `${d.first_name} ${d.last_name}` : "—"; };
  return (
    <>
      <AdminHead kicker={t("GESTION")} title={t("Classement")}>{t("Les changements automatiques sont validés duel par duel (page Challenges). Ici : correction manuelle, avec justification obligatoire, journalisée.")}</AdminHead>
      {!!active && <p className="badge badge-warn mb-5 !normal-case">{t("{n} défi(s) en cours : la modification manuelle est bloquée tant qu'ils ne sont pas clos ou annulés.", { n: active })}</p>}
      <ActionForm action={setRanking} label="APPLIQUER LA MODIFICATION" reset={false} confirm="Appliquer ce classement ? Chaque mouvement est notifié aux pilotes et journalisé.">
        <div className="grid gap-2">
          {ranks?.map((r) => (
            <div key={r.position} className="grid grid-cols-[56px_1fr] items-center gap-3 bg-ink2 px-3 py-2">
              <div className="font-display text-3xl text-red">{r.position}</div>
              <select name={`pos${r.position}`} defaultValue={r.driver_id ?? ""} className="input"><option value="">{t("— Vacant —")}</option>{drivers?.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select>
            </div>
          ))}
        </div>
        <div className="mt-4 max-w-xl"><Field label={t("Justification (obligatoire)")}><input name="reason" required minLength={5} className="input" /></Field></div>
      </ActionForm>
      <h2 className="font-cond mb-3 mt-12 text-lg font-bold uppercase tracking-[.18em]">{t("Historique complet des changements")}</h2>
      <div className="overflow-x-auto bg-ink2">
        <table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Pilote")}</th><th>{t("De")}</th><th>{t("Vers")}</th><th>{t("Type")}</th><th>{t("Motif")}</th></tr></thead><tbody>
          {hist?.map((h) => <tr key={h.id}><td className="whitespace-nowrap">{dateTime(h.created_at, locale)}</td><td>{name(h.driver_id)}</td><td>{h.from_position ? `#${h.from_position}` : "—"}</td><td>{h.to_position ? `#${h.to_position}` : t("Hors classement")}</td><td><span className="badge badge-metal">{L.kind(h.kind)}</span></td><td className="text-[#a5a9b0]">{localizeReason(h.reason, lang)}</td></tr>)}
        </tbody></table>
        {!hist?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun mouvement.")}</p>}
      </div>
    </>
  );
}
