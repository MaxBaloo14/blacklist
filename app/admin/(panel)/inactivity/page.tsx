import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import Field from "@/components/Field";
import { applySanction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function InactivityAdmin() {
  const { t, locale } = await getI18n();
  const L = labels(t);
  const { supabase } = await requireAdmin();
  const [{ data: rows }, { data: reserve }, { data: sanctions }, { data: profiles }, { data: setting }] = await Promise.all([
    supabase.from("inactivity_overview").select("*").order("days_inactive", { ascending: false }),
    supabase.from("reserve_queue").select("id,first_name,last_name,make_model").eq("status", "waiting"),
    supabase.from("sanctions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("id,first_name,last_name"),
    supabase.from("settings").select("value").eq("key", "inactivity_days").maybeSingle(),
  ]);
  const limit = Number(setting?.value ?? 14);
  return (
    <>
      <AdminHead kicker={t("DISCIPLINE")} title={t("Inactivité")}>{t("Après {n} jours sans duel officiel, une alerte est déclenchée. Aucune sanction n'est jamais appliquée automatiquement : c'est toujours une décision d'organisateur. Les absences justifiées suspendent le décompte (fiche pilote).", { n: limit })}</AdminHead>
      <div className="mb-12 overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Rang")}</th><th>{t("Pilote")}</th><th>{t("Jours sans duel")}</th><th>{t("État")}</th><th>{t("Décision")}</th></tr></thead><tbody>
        {rows?.map((r) => (
          <tr key={r.driver_id} className={r.needs_attention ? "bg-red/5" : ""}>
            <td className="font-display text-2xl text-red">{r.position}</td><td className="font-cond text-lg font-bold uppercase tracking-wide">{r.first_name} {r.last_name}</td>
            <td className={`font-display text-3xl ${r.needs_attention ? "text-red" : ""}`}>{r.days_inactive}</td>
            <td>{r.on_justified_absence ? <span className="badge badge-ok">{t("Absence justifiée")}</span> : r.needs_attention ? <span className="badge badge-red">{t("Alerte")}</span> : <span className="badge badge-metal">{t("OK")}</span>}</td>
            <td><Details summary={t("Sanctionner")} tone="text-red">
              <ActionForm action={applySanction} label="APPLIQUER LA SANCTION" variant="ghost" small confirm="Appliquer cette sanction ? Le classement sera modifié immédiatement et le pilote notifié." reset={false}>
                <input type="hidden" name="driver" value={r.driver_id} />
                <div className="grid gap-3">
                  <Field label={t("Sanction")}><select name="type" className="input">{["lose_two_positions", "removal", "replace_with_reserve"].map((k) => <option key={k} value={k}>{L.sanction(k)}</option>)}</select></Field>
                  <Field label={t("Réserviste (pour un remplacement)")}><select name="reserve" className="input"><option value="">—</option>{reserve?.map((q) => <option key={q.id} value={q.id}>{q.first_name} {q.last_name} — {q.make_model}</option>)}</select></Field>
                  <Field label={t("Décision motivée (obligatoire)")}><input name="reason" required minLength={5} className="input" /></Field>
                </div>
              </ActionForm></Details></td>
          </tr>
        ))}
      </tbody></table>{!rows?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun membre dans la Blacklist.")}</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("Sanctions prononcées")}</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Pilote")}</th><th>{t("Sanction")}</th><th>{t("Décision")}</th></tr></thead><tbody>
        {sanctions?.map((s) => { const p = profiles?.find((x) => x.id === s.driver_id); return <tr key={s.id}><td>{dateOnly(s.created_at, locale)}</td><td>{p?.first_name} {p?.last_name}</td><td><span className="badge badge-red">{L.sanction(s.type)}</span></td><td className="text-[#a5a9b0]">{s.reason}</td></tr>; })}
      </tbody></table>{!sanctions?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucune sanction.")}</p>}</div>
    </>
  );
}
