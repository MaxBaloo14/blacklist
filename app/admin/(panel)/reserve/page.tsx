import ActionForm from "@/components/ActionForm";
import { AdminHead, Details, DriverSelect } from "@/components/AdminUI";
import Field from "@/components/Field";
import { addReserve, promoteReserve, removeReserve } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReserveAdmin() {
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
      <AdminHead kicker="SUBSTITUTES" title="Reserve">File des pilotes réservistes (véhicule homologué obligatoire). L&apos;historique des entrées et sorties est conservé.</AdminHead>
      <div className="panel mb-8 max-w-xl"><div className="kicker mb-3">AJOUTER UN RÉSERVISTE</div><ActionForm action={addReserve} label="ADD TO QUEUE"><DriverSelect name="driver" drivers={addable} placeholder="Pilote avec véhicule homologué…" /></ActionForm></div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">File d&apos;attente ({wait.length})</h2>
      <div className="mb-12 overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>#</th><th>Pilote</th><th>Véhicule</th><th>Inscrit le</th><th>Actions</th></tr></thead><tbody>
        {wait.map((q) => (
          <tr key={q.id}><td className="font-display text-2xl text-red">{q.queue_position}</td><td className="font-cond text-lg font-bold uppercase tracking-wide">{q.first_name} {q.last_name}</td><td>{q.make_model}</td><td>{dateOnly(q.joined_at)}</td>
            <td><div className="grid max-w-sm gap-2">
              <Details summary="Promouvoir (position vacante)"><ActionForm action={promoteReserve} label="PROMOTE" small confirm="Promouvoir ce réserviste dans la Blacklist ?" reset={false}><input type="hidden" name="reserve" value={q.id} />
                <select name="position" className="input"><option value="">Dernière position vacante</option>{ranks?.map((r) => <option key={r.position} value={r.position}>#{r.position} (vacant)</option>)}</select></ActionForm>{!ranks?.length && <p className="mt-2 text-xs text-metal">Aucune position vacante : utilise une sanction « remplacement par un réserviste » depuis la page Inactivity.</p>}</Details>
              <Details summary="Retirer" tone="text-red"><ActionForm action={removeReserve} label="REMOVE" small variant="ghost" confirm="Retirer ce pilote de la file ?" reset={false}><input type="hidden" name="reserve" value={q.id} /><Field label="Motif"><input name="reason" required className="input" /></Field></ActionForm></Details>
            </div></td></tr>
        ))}
      </tbody></table>{!wait.length && <p className="p-5 text-[#a5a9b0]">La file est vide.</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">Historique des entrées / sorties</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Pilote</th><th>Entrée</th><th>Sortie</th><th>Statut</th><th>Détail</th></tr></thead><tbody>
        {hist.map((q) => <tr key={q.id}><td>{q.first_name} {q.last_name}</td><td>{dateOnly(q.joined_at)}</td><td>{dateOnly(q.left_at)}</td><td><span className={`badge ${q.status === "promoted" ? "badge-ok" : "badge-metal"}`}>{q.status}</span></td><td className="text-[#a5a9b0]">{q.exit_reason}</td></tr>)}
      </tbody></table>{!hist.length && <p className="p-5 text-[#a5a9b0]">Aucun historique.</p>}</div>
    </>
  );
}
