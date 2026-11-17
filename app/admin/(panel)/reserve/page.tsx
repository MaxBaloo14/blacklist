import ActionForm from "@/components/ActionForm";
import { AdminHead, Details, DriverSelect } from "@/components/AdminUI";
import Field from "@/components/Field";
import { addReserve, promoteReserve, removeReserve } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { localizeReason } from "@/lib/notif-i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ReserveAdmin() {
  const { t, locale, lang } = await getI18n();
  const L = labels(t);
  const { supabase } = await requireAdmin();
  const [{ data: queue }, { data: drivers }, { data: ranked }, { data: ranks }, { data: vehicles }] = await Promise.all([
    supabase.from("reserve_queue").select("*").order("joined_at", { ascending: false }),
    supabase.from("profiles").select("id,first_name,last_name").eq("registration_status", "validated").eq("account_status", "active").order("last_name"),
    supabase.from("blacklist_rankings").select("driver_id").not("driver_id", "is", null),
    supabase.from("blacklist_rankings").select("position").is("driver_id", null).order("position"),
    supabase.from("vehicles").select("owner_id").eq("status", "approved"),
  ]);
  const rankedIds = new Set(ranked?.map((r) => r.driver_id)), waiting = new Set(queue?.filter((q) => q.status === "waiting").map((q) => q.driver_id)), hasCar = new Set(vehicles?.map((v) => v.owner_id));
  const addable = (drivers ?? []).filter((d) => !rankedIds.has(d.id) && !waiting.has(d.id) && hasCar.has(d.id));
  const wait = queue?.filter((q) => q.status === "waiting").sort((a, b) => a.queue_position - b.queue_position) ?? [], hist = queue?.filter((q) => q.status !== "waiting") ?? [];
  return (
    <>
      <AdminHead kicker={t("RÉSERVISTES")} title={t("Réserve")}>{t("File des pilotes réservistes (véhicule homologué obligatoire). L'historique des entrées et sorties est conservé.")}</AdminHead>
      <div className="panel mb-8 max-w-xl"><div className="kicker mb-3">{t("AJOUTER UN RÉSERVISTE")}</div><ActionForm action={addReserve} label="AJOUTER À LA FILE"><DriverSelect name="driver" drivers={addable} placeholder={t("Pilote avec véhicule homologué…")} /></ActionForm></div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">File d&apos;attente ({wait.length})</h2>
      <div className="mb-12 overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>#</th><th>{t("Pilote")}</th><th>{t("Véhicule")}</th><th>{t("Inscrit le")}</th><th>{t("Actions")}</th></tr></thead><tbody>
        {wait.map((q) => (
          <tr key={q.id}><td className="font-display text-2xl text-red">{q.queue_position}</td><td className="font-cond text-lg font-bold uppercase tracking-wide">{q.first_name} {q.last_name}</td><td>{q.make_model}</td><td>{dateOnly(q.joined_at, locale)}</td>
            <td><div className="grid max-w-sm gap-2">
              <Details summary={t("Promouvoir (position vacante)")}><ActionForm action={promoteReserve} label="PROMOUVOIR" small confirm="Promouvoir ce réserviste dans la Blacklist ?" reset={false}><input type="hidden" name="reserve" value={q.id} />
                <select name="position" className="input"><option value="">{t("Dernière position vacante")}</option>{ranks?.map((r) => <option key={r.position} value={r.position}>#{r.position} ({t("vacant")})</option>)}</select></ActionForm>{!ranks?.length && <p className="mt-2 text-xs text-metal">{t("Aucune position vacante : utilise une sanction « remplacement par un réserviste » depuis la page Inactivity.")}</p>}</Details>
              <Details summary={t("Retirer")} tone="text-red"><ActionForm action={removeReserve} label="RETIRER" small variant="ghost" confirm="Retirer ce pilote de la file ?" reset={false}><input type="hidden" name="reserve" value={q.id} /><Field label={t("Motif")}><input name="reason" required className="input" /></Field></ActionForm></Details>
            </div></td></tr>
        ))}
      </tbody></table>{!wait.length && <p className="p-5 text-[#a5a9b0]">{t("La file est vide.")}</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("Historique des entrées / sorties")}</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Pilote")}</th><th>{t("Entrée")}</th><th>{t("Sortie")}</th><th>{t("Statut")}</th><th>{t("Détail")}</th></tr></thead><tbody>
        {hist.map((q) => <tr key={q.id}><td>{q.first_name} {q.last_name}</td><td>{dateOnly(q.joined_at, locale)}</td><td>{dateOnly(q.left_at, locale)}</td><td><span className={`badge ${q.status === "promoted" ? "badge-ok" : "badge-metal"}`}>{L.reserve(q.status)}</span></td><td className="text-[#a5a9b0]">{localizeReason(q.exit_reason, lang)}</td></tr>)}
      </tbody></table>{!hist.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun historique.")}</p>}</div>
    </>
  );
}
