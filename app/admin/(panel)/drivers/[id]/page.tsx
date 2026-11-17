import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import { AdminHead, CSTATUS, Details } from "@/components/AdminUI";
import Field from "@/components/Field";
import { addReserve, markVehicleLost, recordAbsence, setAccountStatus, updateDriverInfo, validateRegistration } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly, dateTime, fullName, photoUrl } from "@/lib/format";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f-]{36}$/i;

export default async function DriverAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: d } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();
  const [{ data: vehicles }, { data: rank }, { data: chal }, { data: absences }, { data: sanctions }, { data: inact }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("owner_id", id).order("created_at", { ascending: false }),
    supabase.from("blacklist_rankings").select("position").eq("driver_id", id).maybeSingle(),
    supabase.from("public_duels").select("*").or(`challenger_id.eq.${id},defender_id.eq.${id}`).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(20),
    supabase.from("absences").select("*").eq("driver_id", id).order("starts_on", { ascending: false }),
    supabase.from("sanctions").select("*").eq("driver_id", id).order("created_at", { ascending: false }),
    supabase.rpc("inactivity_days", { p_driver: id }),
  ]);
  const approved = vehicles?.find((v) => v.status === "approved");
  return (
    <>
      <AdminHead kicker={rank ? `BLACKLIST #${rank.position}` : "DRIVER FILE"} title={fullName(d)}>Discord : {d.discord_tag} · Tél. : {d.phone} · Dernière activité : {dateTime(d.last_activity_at)}{rank ? ` · ${inact ?? 0} j sans duel` : ""}</AdminHead>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel">
          <div className="kicker mb-3">INSCRIPTION — <span className={d.registration_status === "validated" ? "text-ok" : ""}>{d.registration_status.toUpperCase()}</span></div>
          <ActionForm action={validateRegistration} label="SAVE DECISION" reset={false} confirm="Enregistrer cette décision ? Le pilote sera notifié.">
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Décision"><select name="decision" className="input"><option value="validated">Valider</option><option value="rejected">Refuser</option></select></Field>
              <Field label="Note / motif (visible du pilote)"><input name="note" className="input" defaultValue={d.registration_note ?? ""} /></Field>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <div className="kicker mb-3">COMPTE — <span className={d.account_status === "active" ? "text-ok" : "text-red"}>{d.account_status.toUpperCase()}</span></div>
          <ActionForm action={setAccountStatus} label="APPLY" variant="dark" reset={false} confirm="Modifier le statut de ce compte ? Le pilote en sera informé.">
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nouveau statut"><select name="status" defaultValue={d.account_status} className="input"><option value="active">Actif</option><option value="suspended">Suspendu</option><option value="banned">Banni</option></select></Field>
              <Field label="Motif (obligatoire)"><input name="reason" required minLength={3} className="input" /></Field>
            </div>
          </ActionForm>
        </div>
        <ActionForm action={updateDriverInfo} label="UPDATE INFO" reset={false} className="panel">
          <div className="kicker mb-3">INFORMATIONS</div>
          <input type="hidden" name="driver" value={d.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom"><input name="first_name" defaultValue={d.first_name} required className="input" /></Field>
            <Field label="Nom"><input name="last_name" defaultValue={d.last_name} required className="input" /></Field>
            <Field label="Téléphone"><input name="phone" defaultValue={d.phone} required className="input" /></Field>
            <Field label="Discord"><input name="discord_tag" defaultValue={d.discord_tag} required className="input" /></Field>
          </div>
        </ActionForm>
        <div className="panel">
          <div className="kicker mb-3">VÉHICULES</div>
          <ul className="grid gap-2">{vehicles?.map((v) => (
            <li key={v.id} className="flex items-center gap-3 bg-ink p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(v.photo_path)!} alt="" className="h-12 w-20 object-cover" />
              <div className="min-w-0 flex-1"><div className="font-cond truncate font-bold uppercase tracking-wide">{v.make_model}</div><div className="text-xs text-metal">{v.vehicle_class} · {dateOnly(v.created_at)}{v.rejection_reason ? ` · ${v.rejection_reason}` : ""}</div></div>
              <span className="badge badge-metal">{v.status}</span>
            </li>
          ))}</ul>
          {approved && (
            <div className="mt-4"><Details summary="Enregistrer une confiscation (perte du véhicule)" tone="text-red">
              <ActionForm action={markVehicleLost} label="CONFISCATE VEHICLE" confirm="Le véhicule passera au statut Lost, définitivement. Le pilote devra en homologuer un nouveau." reset={false}>
                <input type="hidden" name="driver" value={d.id} /><Field label="Motif"><input name="reason" required minLength={3} className="input" /></Field>
              </ActionForm></Details></div>
          )}
        </div>
        <div className="panel">
          <div className="kicker mb-3">ABSENCES JUSTIFIÉES</div>
          <ul className="mb-4 grid gap-1.5 text-sm">{absences?.map((a) => <li key={a.id} className="bg-ink px-3 py-2">{dateOnly(a.starts_on)} → {a.ends_on ? dateOnly(a.ends_on) : "en cours"} — {a.reason} {a.suspends_inactivity && <span className="badge badge-ok ml-1">décompte suspendu</span>}</li>)}{!absences?.length && <li className="text-metal">Aucune.</li>}</ul>
          <ActionForm action={recordAbsence} label="RECORD ABSENCE" variant="dark" small>
            <input type="hidden" name="driver" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Du"><input type="date" name="from" required className="input" /></Field>
              <Field label="Au (vide = en cours)"><input type="date" name="to" className="input" /></Field>
              <Field label="Motif" className="sm:col-span-2"><input name="reason" required minLength={3} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="suspends" defaultChecked className="accent-[#c62828]" /> Suspend le décompte d&apos;inactivité</label>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <div className="kicker mb-3">DÉFIS RÉCENTS</div>
          <ul className="grid gap-1.5 text-sm">{chal?.map((c) => <li key={c.id} className="flex justify-between gap-3 bg-ink px-3 py-2"><span>#{c.challenger_position} {c.challenger_first} {c.challenger_last} → #{c.defender_position} {c.defender_first} {c.defender_last}</span><span className={`badge ${CSTATUS[c.status]?.[1]}`}>{CSTATUS[c.status]?.[0]}</span></li>)}{!chal?.length && <li className="text-metal">Aucun.</li>}</ul>
          <div className="kicker mb-2 mt-5">SANCTIONS</div>
          <ul className="grid gap-1.5 text-sm">{sanctions?.map((s) => <li key={s.id} className="bg-ink px-3 py-2"><b>{s.type}</b> — {s.reason} <span className="text-metal">({dateOnly(s.created_at)})</span></li>)}{!sanctions?.length && <li className="text-metal">Aucune.</li>}</ul>
          {!rank && approved && d.registration_status === "validated" && (
            <ActionForm action={addReserve} label="ADD TO RESERVE" variant="ghost" small className="mt-4"><input type="hidden" name="driver" value={d.id} /></ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
