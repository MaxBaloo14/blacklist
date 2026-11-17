import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import Countdown from "@/components/Countdown";
import { createChallenge, scheduleChallenge, setRaceTrack } from "@/app/actions/driver";
import { dateTime, fullName } from "@/lib/format";
import type { Row } from "@/lib/types";

const STATUS: Record<string, [string, string]> = {
  awaiting_schedule: ["Awaiting date", "badge-warn"], scheduled: ["Scheduled", "badge-ok"], awaiting_validation: ["Result pending validation", "badge-warn"],
  completed: ["Completed", "badge-metal"], cancelled: ["Cancelled", "badge-metal"], forfeited: ["Forfeit", "badge-red"],
};

export default async function ChallengesPanel({ supabase, userId, myPos, ready, tracks }: { supabase: any; userId: string; myPos: number | null; ready: string | null; tracks: Row[] }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: active } = await supabase.from("challenges")
    .select("*, challenge_races(*, race_results(winner_id))").in("status", ["awaiting_schedule", "scheduled", "awaiting_validation"]).order("created_at", { ascending: false });
  const ids = [...new Set<string>((active ?? []).flatMap((c: Row) => [c.challenger_id, c.defender_id]))];
  const { data: people } = ids.length ? await supabase.from("public_driver").select("id,first_name,last_name,position").in("id", ids) : { data: [] };
  const who = (id: string) => (people ?? []).find((p: Row) => p.id === id);

  let target: Row | null = null;
  if (myPos && myPos > 1) {
    const { data } = await supabase.from("public_blacklist").select("driver_id,first_name,last_name,make_model,position").eq("position", myPos - 1).maybeSingle();
    target = data;
  }
  const hasActive = (active ?? []).length > 0;
  const activeTracks = tracks.filter((t) => t.status === "active");

  return (
    <div className="grid gap-8">
      <div className="panel">
        <div className="kicker mb-3">LAUNCH A CHALLENGE</div>
        {!myPos ? <p className="text-[#a5a9b0]">Tu n&apos;es pas encore dans la Blacklist. Remporte la Warm-up Race du dimanche pour viser la position #10.</p>
          : myPos === 1 ? <p className="text-[#a5a9b0]">Tu es le #1. Personne au-dessus de toi : défends ta couronne.</p>
          : target?.driver_id ? (
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="label">Ta cible — directement au-dessus de toi</div>
                <div className="font-display text-4xl uppercase"><span className="text-red">#{target.position}</span> {target.first_name} {target.last_name}</div>
                <div className="font-cond tracking-wide text-metal">{target.make_model}</div>
              </div>
              <div className="max-w-sm text-sm text-[#a5a9b0]">
                {ready && <p className="mb-2 text-[#ff6b6b]">{ready}</p>}
                <ActionForm action={createChallenge} label={`CHALLENGE #${target.position}`} confirm={`Défier ${target.first_name} ${target.last_name} (#${target.position}) ? Il aura 48 h pour fixer le duel. Un seul défi par semaine : le règlement ne permet pas de l'annuler librement.`}>
                  <input type="hidden" name="target" value={target.driver_id} />
                </ActionForm>
              </div>
            </div>
          ) : <p className="text-[#a5a9b0]">La position #{myPos - 1} est vacante : aucun pilote à défier pour le moment.</p>}
        <p className="mt-4 text-xs text-metal">Règles : un seul défi par semaine · uniquement le pilote juste au-dessus · véhicule homologué obligatoire.</p>
      </div>

      <div>
        <div className="kicker mb-3">DÉFIS EN COURS</div>
        {!hasActive && <p className="panel text-[#a5a9b0]">Aucun défi en cours.</p>}
        <div className="grid gap-5">
          {(active ?? []).map((c: Row) => {
            const iAmDefender = c.defender_id === userId;
            const ch = who(c.challenger_id), df = who(c.defender_id);
            const [label, cls] = STATUS[c.status];
            const races = [...(c.challenge_races ?? [])].sort((a: Row, b: Row) => a.race_no - b.race_no);
            return (
              <article key={c.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-cond mb-1 text-xs tracking-[.25em] text-metal">{c.is_podium ? "PODIUM DUEL · BEST OF 3" : "STANDARD DUEL · 1 RACE"}</div>
                    <div className="font-display text-3xl uppercase tracking-wide">
                      <Link href={`/blacklist/${c.challenger_id}`} className="hover:text-red">{fullName(ch)}</Link> <span className="font-marker text-xl text-red">vs</span> <Link href={`/blacklist/${c.defender_id}`} className="hover:text-red">{fullName(df)}</Link>
                    </div>
                    <div className="font-cond mt-1 text-sm tracking-wide text-metal">Challenger #{c.challenger_position} → Défié #{c.defender_position} · Tu es {iAmDefender ? "le défié" : "le challenger"}</div>
                  </div>
                  <span className={`badge ${cls}`}>{label}</span>
                </div>

                {c.status === "awaiting_schedule" && (
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <Countdown to={c.respond_by} label="to schedule" />
                    {iAmDefender ? (
                      <ActionForm action={scheduleChallenge} label="SET DUEL DATE" confirm="Confirmer cette date ? Elle sera communiquée aux deux pilotes et à l'organisation." className="mt-4 max-w-md">
                        <input type="hidden" name="challenge" value={c.id} />
                        <label className="label" htmlFor={`w-${c.id}`}>Date et heure du duel (semaine en cours, heure de Paris)</label>
                        <input id={`w-${c.id}`} name="when" type="datetime-local" required className="input" />
                      </ActionForm>
                    ) : <p className="mt-3 text-sm text-[#a5a9b0]">En attente : le pilote défié doit fixer une date dans les 48 h. Passé ce délai, l&apos;organisation est alertée.</p>}
                  </div>
                )}
                {c.status !== "awaiting_schedule" && c.scheduled_at && (
                  <div className="mt-5 border-t border-white/10 pt-5"><div className="label">Duel prévu</div><div className="font-display text-3xl">{dateTime(c.scheduled_at)}</div></div>
                )}
                {c.status === "awaiting_validation" && <p className="mt-4 text-sm text-[#a5a9b0]">Le résultat est saisi : il sera officiel après validation par l&apos;organisation.</p>}

                <div className="mt-5 overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Course</th><th>Type</th><th>Choisi par</th><th>Circuit</th><th>Résultat</th></tr></thead>
                    <tbody>
                      {races.map((r: Row) => {
                        const mine = (r.chosen_by === "champion" && iAmDefender) || (r.chosen_by === "challenger" && !iAmDefender);
                        const track = tracks.find((t) => t.id === r.track_id);
                        const w = r.race_results?.[0]?.winner_id ?? r.race_results?.winner_id;
                        return (
                          <tr key={r.id}>
                            <td className="font-cond font-bold">#{r.race_no}</td>
                            <td className="capitalize">{r.kind === "last_race" ? "Last Race" : r.kind === "sprint" ? "Sprint urbain" : "Standard"}</td>
                            <td className="capitalize">{r.chosen_by}</td>
                            <td>
                              {track ? track.name : mine && ["awaiting_schedule", "scheduled"].includes(c.status) ? (
                                <ActionForm action={setRaceTrack} label="OK" small variant="dark" className="flex items-start gap-2 [&>div]:mt-0">
                                  <input type="hidden" name="race" value={r.id} />
                                  <select name="track" required defaultValue="" className="input !py-1.5"><option value="" disabled>Choisir…</option>{activeTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                                </ActionForm>
                              ) : <span className="text-metal">{r.chosen_by === "organisation" ? "Organisation" : "À choisir"}</span>}
                            </td>
                            <td>{w ? fullName(who(w)) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {c.is_podium && <div className="font-cond mt-3 text-lg tracking-wide">Score — Champion <b className="text-white">{c.champion_wins}</b> : <b className="text-white">{c.challenger_wins}</b> Challenger</div>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
