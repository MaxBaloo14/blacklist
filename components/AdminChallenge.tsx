import ActionForm from "@/components/ActionForm";
import { CSTATUS, Details } from "@/components/AdminUI";
import Countdown from "@/components/Countdown";
import Field from "@/components/Field";
import { cancelChallenge, declareForfeit, recordRaceResult, setSchedule, validateChallenge } from "@/app/actions/admin";
import { dateTime, fullName } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function AdminChallenge({ c, names, tracks }: { c: Row; names: Row; tracks: Row[] }) {
  const ch = names[c.challenger_id], df = names[c.defender_id];
  const races = [...(c.challenge_races ?? [])].sort((a: Row, b: Row) => a.race_no - b.race_no);
  const overdue = c.status === "awaiting_schedule" && new Date(c.respond_by) < new Date();
  const open = ["awaiting_schedule", "scheduled", "awaiting_validation"].includes(c.status);
  const winnerOf = (r: Row) => { const w = Array.isArray(r.race_results) ? r.race_results[0] : r.race_results; return w?.winner_id as string | undefined; };
  return (
    <article className={`border bg-ink2 p-5 ${overdue ? "border-red" : "border-white/10"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-cond text-xs tracking-[.25em] text-metal">{c.is_podium ? "PODIUM · BEST OF 3" : "STANDARD · 1 RACE"} · créé {dateTime(c.created_at)}</div>
          <div className="font-display text-2xl uppercase tracking-wide">#{c.challenger_position} {fullName(ch)} <span className="font-marker text-lg text-red">vs</span> #{c.defender_position} {fullName(df)}</div>
        </div>
        <div className="flex items-center gap-2">{overdue && <span className="badge badge-red">48h dépassées</span>}<span className={`badge ${CSTATUS[c.status][1]}`}>{CSTATUS[c.status][0]}</span></div>
      </div>
      <div className="font-cond mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[15px] tracking-wide text-[#cfcfcf]">
        {c.status === "awaiting_schedule" && <Countdown to={c.respond_by} label="avant alerte" />}
        {c.scheduled_at && <span>Duel : <b className="text-white">{dateTime(c.scheduled_at)}</b></span>}
        {c.is_podium && <span>Score : <b className="text-white">{c.champion_wins} (champion) – {c.challenger_wins} (challenger)</b></span>}
        {c.winner_id && <span>Vainqueur : <b className="text-red">{fullName(names[c.winner_id])}</b></span>}
        {c.cancel_reason && <span className="text-metal">Annulé : {c.cancel_reason}</span>}
        {c.admin_note && <span className="text-metal">Note : {c.admin_note}</span>}
      </div>

      {c.status === "awaiting_validation" && (
        <div className="mt-4 border border-red-dark bg-[#1b1012] p-4">
          <div className="font-cond mb-2 text-sm font-bold tracking-[.2em] text-red">RÉSULTAT À VALIDER — {fullName(names[c.winner_id])} l&apos;emporte</div>
          <ActionForm action={validateChallenge} label="VALIDATE RESULT" confirm={`Valider la victoire de ${fullName(names[c.winner_id])} ? Le classement, la récompense et les éventuelles pertes de véhicule seront appliqués immédiatement et ne peuvent pas être annulés ici.`} reset={false}>
            <input type="hidden" name="challenge" value={c.id} />
            <Field label="Lien du clip (publié)"><input name="clip" type="url" defaultValue={c.clip_url ?? ""} placeholder="https://…" className="input" /></Field>
          </ActionForm>
        </div>
      )}

      {["scheduled", "awaiting_validation"].includes(c.status) && (
        <div className="mt-4 overflow-x-auto">
          <table className="tbl"><thead><tr><th>Course</th><th>Type</th><th>Circuit</th><th>Résultat</th><th>Saisie</th></tr></thead><tbody>
            {races.map((r: Row) => (
              <tr key={r.id}>
                <td className="font-cond font-bold">#{r.race_no}</td><td>{r.kind === "last_race" ? "Last Race" : r.kind === "sprint" ? "Sprint urbain" : "Standard"} <span className="text-xs text-metal">({r.chosen_by})</span></td>
                <td>{tracks.find((t) => t.id === r.track_id)?.name ?? "—"}</td><td>{winnerOf(r) ? fullName(names[winnerOf(r)!]) : "—"}</td>
                <td>
                  <ActionForm action={recordRaceResult} label={winnerOf(r) ? "CORRECT" : "RECORD"} small variant="dark" reset={false} className="grid min-w-[260px] gap-2">
                    <input type="hidden" name="race" value={r.id} />
                    <select name="winner" required defaultValue={winnerOf(r) ?? ""} className="input !py-1.5"><option value="" disabled>Vainqueur…</option><option value={c.challenger_id}>{fullName(ch)} (challenger)</option><option value={c.defender_id}>{fullName(df)} (défié)</option></select>
                    <input name="clip" type="url" placeholder="Lien du clip (optionnel)" className="input !py-1.5" />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {["awaiting_schedule", "scheduled"].includes(c.status) && (
            <Details summary="Modifier la programmation">
              <ActionForm action={setSchedule} label="SET SCHEDULE" small variant="dark" confirm="Modifier exceptionnellement la date du duel ? Les deux pilotes seront prévenus." reset={false}>
                <input type="hidden" name="challenge" value={c.id} />
                <Field label="Date et heure (Paris)"><input type="datetime-local" name="when" required className="input" /></Field>
                <Field label="Justification" className="mt-2"><input name="reason" required minLength={3} className="input" /></Field>
              </ActionForm>
            </Details>
          )}
          {["awaiting_schedule", "scheduled"].includes(c.status) && (
            <Details summary="Déclarer un forfait" tone="text-red">
              <ActionForm action={declareForfeit} label="DECLARE FORFEIT" small variant="ghost" confirm="Déclarer ce forfait ? L'adversaire est déclaré vainqueur et le classement est mis à jour immédiatement." reset={false}>
                <input type="hidden" name="challenge" value={c.id} />
                <Field label="Pilote déclarant forfait"><select name="forfeiting" required defaultValue="" className="input"><option value="" disabled>Choisir…</option><option value={c.defender_id}>{fullName(df)} (défié)</option><option value={c.challenger_id}>{fullName(ch)} (challenger)</option></select></Field>
                <Field label="Motif / vérification effectuée" className="mt-2"><input name="reason" required minLength={3} className="input" /></Field>
              </ActionForm>
            </Details>
          )}
          <Details summary="Annuler le duel" tone="text-red">
            <ActionForm action={cancelChallenge} label="CANCEL DUEL" small variant="ghost" confirm="Annuler ce duel ? Aucun changement de classement ne sera appliqué." reset={false}>
              <input type="hidden" name="challenge" value={c.id} />
              <Field label="Justification (obligatoire)"><input name="reason" required minLength={3} className="input" /></Field>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="free_week" className="accent-[#c62828]" /> Libérer le défi hebdomadaire du challenger (absence justifiée)</label>
            </ActionForm>
          </Details>
        </div>
      )}
    </article>
  );
}
