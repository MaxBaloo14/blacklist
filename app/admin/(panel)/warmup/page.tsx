import ActionForm from "@/components/ActionForm";
import { AdminHead, Details, DriverSelect } from "@/components/AdminUI";
import Field from "@/components/Field";
import { addWarmupParticipant, createWarmup, enterBlacklist, recordWarmupWinner, removeWarmupParticipant, setWarmupStatus, validateWarmup } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarmupAdmin() {
  const { supabase } = await requireAdmin();
  const [{ data: events }, { data: parts }, { data: tracks }, { data: drivers }, { data: ranked }, { data: eligible }] = await Promise.all([
    supabase.from("warmup_events").select("*").order("scheduled_at", { ascending: false }).limit(15),
    supabase.from("warmup_participants").select("*"),
    supabase.from("race_tracks").select("id,name").eq("status", "active"),
    supabase.from("profiles").select("id,first_name,last_name").eq("registration_status", "validated").eq("account_status", "active").order("last_name"),
    supabase.from("blacklist_rankings").select("driver_id").not("driver_id", "is", null),
    supabase.from("profiles").select("id,first_name,last_name").eq("entry_eligible", true),
  ]);
  const rankedIds = new Set((ranked ?? []).map((r) => r.driver_id));
  const candidates = (drivers ?? []).filter((d) => !rankedIds.has(d.id));
  const nm = (id: string) => fullName(drivers?.find((d) => d.id === id));
  return (
    <>
      <AdminHead kicker="EVERY SUNDAY" title="Warm-up Race">Inscris les participants, lance la course, enregistre puis valide le vainqueur. Il devient alors éligible à l&apos;entrée au #10.</AdminHead>
      {!!eligible?.length && (
        <div className="panel mb-8 border-l-red">
          <div className="kicker mb-3">ÉLIGIBLES À L&apos;ENTRÉE AU #10</div>
          {eligible.map((d) => (
            <ActionForm key={d.id} action={enterBlacklist} label={`ENTER ${d.first_name.toUpperCase()} ${d.last_name.toUpperCase()} AT #10`} confirm="Intégrer ce pilote à la Blacklist au #10 ? Si le #10 est occupé et que tu coches l'éviction, l'occupant est envoyé en réserve." reset={false}>
              <input type="hidden" name="driver" value={d.id} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="displace" className="accent-[#c62828]" /> Évincer l&apos;occupant actuel du #10 (envoyé en réserve) si la place est prise</label>
            </ActionForm>
          ))}
        </div>
      )}
      <div className="panel mb-10"><div className="kicker mb-3">NOUVELLE ÉDITION</div>
        <ActionForm action={createWarmup} label="SCHEDULE WARM-UP"><div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Date et heure (Paris)"><input type="datetime-local" name="when" required className="input" /></Field>
          <Field label="Tracé"><select name="track" className="input"><option value="">À annoncer</option>{tracks?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        </div></ActionForm>
      </div>
      <div className="grid gap-5">
        {events?.map((e) => {
          const ep = (parts ?? []).filter((p) => p.event_id === e.id);
          const open = ["scheduled", "running"].includes(e.status) || (e.status === "completed" && !e.validated_at);
          return (
            <article key={e.id} className="border border-white/10 bg-ink2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="font-display text-3xl uppercase">{dateTime(e.scheduled_at)}</div><span className={`badge ${e.status === "completed" ? "badge-ok" : e.status === "cancelled" ? "badge-metal" : "badge-warn"}`}>{e.status}{e.validated_at ? " · validé" : ""}</span></div>
              <div className="mt-3"><div className="label">Participants ({ep.length})</div>
                <ul className="flex flex-wrap gap-2">{ep.map((p) => (
                  <li key={p.driver_id} className="flex items-center gap-2 bg-ink px-3 py-1.5 text-sm"><span className={p.driver_id === e.winner_id ? "font-bold text-red" : ""}>{nm(p.driver_id)}{p.driver_id === e.winner_id ? " ★" : ""}</span>
                    {open && !e.validated_at && <ActionForm action={removeWarmupParticipant} label="×" small variant="ghost" className="[&>div]:mt-0" confirm="Retirer ce participant ?"><input type="hidden" name="event" value={e.id} /><input type="hidden" name="driver" value={p.driver_id} /></ActionForm>}</li>
                ))}{!ep.length && <li className="text-sm text-metal">Aucun inscrit.</li>}</ul>
              </div>
              {open && !e.validated_at && (
                <div className="mt-4 grid gap-2 lg:grid-cols-3">
                  <Details summary="Inscrire un participant"><ActionForm action={addWarmupParticipant} label="ADD" small variant="dark"><input type="hidden" name="event" value={e.id} /><DriverSelect name="driver" drivers={candidates.filter((d) => !ep.some((p) => p.driver_id === d.id))} /></ActionForm></Details>
                  <Details summary="Lancer / annuler"><div className="grid gap-2">
                    {e.status === "scheduled" && <ActionForm action={setWarmupStatus} label="START RACE" small variant="dark" confirm="Lancer la course ?"><input type="hidden" name="event" value={e.id} /><input type="hidden" name="status" value="running" /></ActionForm>}
                    {e.status !== "completed" && <ActionForm action={setWarmupStatus} label="CANCEL EDITION" small variant="ghost" confirm="Annuler cette édition ?"><input type="hidden" name="event" value={e.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm>}
                  </div></Details>
                  <Details summary="Enregistrer le vainqueur"><ActionForm action={recordWarmupWinner} label="RECORD WINNER" small confirm="Enregistrer ce vainqueur ? Tu devras ensuite valider le résultat." reset={false}><input type="hidden" name="event" value={e.id} /><DriverSelect name="winner" value={e.winner_id} drivers={(drivers ?? []).filter((d) => ep.some((p) => p.driver_id === d.id))} /><input name="notes" placeholder="Notes (optionnel)" className="input mt-2" /></ActionForm></Details>
                </div>
              )}
              {e.status === "completed" && e.winner_id && !e.validated_at && (
                <div className="mt-4 border border-red-dark bg-[#1b1012] p-4"><div className="font-cond mb-2 text-sm font-bold tracking-[.2em] text-red">VAINQUEUR : {nm(e.winner_id).toUpperCase()} — VALIDATION REQUISE</div>
                  <ActionForm action={validateWarmup} label="VALIDATE WINNER" confirm="Valider le vainqueur ? Il sera éligible à l'entrée au #10."><input type="hidden" name="event" value={e.id} /></ActionForm></div>
              )}
            </article>
          );
        })}
        {!events?.length && <p className="panel text-[#a5a9b0]">Aucune édition.</p>}
      </div>
    </>
  );
}
