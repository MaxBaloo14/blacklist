import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import Field from "@/components/Field";
import { applySanction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";

export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { lose_two_positions: "Perte de deux positions", removal: "Retrait de la Blacklist", replace_with_reserve: "Remplacement par un réserviste" };

export default async function InactivityAdmin() {
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
      <AdminHead kicker="DISCIPLINE" title="Inactivity">Après {limit} jours sans duel officiel, une alerte est déclenchée. Aucune sanction n&apos;est jamais appliquée automatiquement : c&apos;est toujours une décision d&apos;organisateur. Les absences justifiées suspendent le décompte (fiche pilote).</AdminHead>
      <div className="mb-12 overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Rang</th><th>Pilote</th><th>Jours sans duel</th><th>État</th><th>Décision</th></tr></thead><tbody>
        {rows?.map((r) => (
          <tr key={r.driver_id} className={r.needs_attention ? "bg-red/5" : ""}>
            <td className="font-display text-2xl text-red">{r.position}</td><td className="font-cond text-lg font-bold uppercase tracking-wide">{r.first_name} {r.last_name}</td>
            <td className={`font-display text-3xl ${r.needs_attention ? "text-red" : ""}`}>{r.days_inactive}</td>
            <td>{r.on_justified_absence ? <span className="badge badge-ok">Absence justifiée</span> : r.needs_attention ? <span className="badge badge-red">Alerte</span> : <span className="badge badge-metal">OK</span>}</td>
            <td><Details summary="Sanctionner" tone="text-red">
              <ActionForm action={applySanction} label="APPLY SANCTION" variant="ghost" small confirm="Appliquer cette sanction ? Le classement sera modifié immédiatement et le pilote notifié." reset={false}>
                <input type="hidden" name="driver" value={r.driver_id} />
                <div className="grid gap-3">
                  <Field label="Sanction"><select name="type" className="input">{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  <Field label="Réserviste (pour un remplacement)"><select name="reserve" className="input"><option value="">—</option>{reserve?.map((q) => <option key={q.id} value={q.id}>{q.first_name} {q.last_name} — {q.make_model}</option>)}</select></Field>
                  <Field label="Décision motivée (obligatoire)"><input name="reason" required minLength={5} className="input" /></Field>
                </div>
              </ActionForm></Details></td>
          </tr>
        ))}
      </tbody></table>{!rows?.length && <p className="p-5 text-[#a5a9b0]">Aucun membre dans la Blacklist.</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">Sanctions prononcées</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>Date</th><th>Pilote</th><th>Sanction</th><th>Décision</th></tr></thead><tbody>
        {sanctions?.map((s) => { const p = profiles?.find((x) => x.id === s.driver_id); return <tr key={s.id}><td>{dateOnly(s.created_at)}</td><td>{p?.first_name} {p?.last_name}</td><td><span className="badge badge-red">{LABEL[s.type]}</span></td><td className="text-[#a5a9b0]">{s.reason}</td></tr>; })}
      </tbody></table>{!sanctions?.length && <p className="p-5 text-[#a5a9b0]">Aucune sanction.</p>}</div>
    </>
  );
}
