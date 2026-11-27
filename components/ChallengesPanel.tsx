import CarThumb from "@/components/CarThumb";
import { matchVehicle } from "@/lib/vehicle-catalog";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import Countdown from "@/components/Countdown";
import { createChallenge, scheduleChallenge, setRaceTrack } from "@/app/actions/driver";
import { dateTime, fullName, SLOT_TIMES, trackImageUrl, weekSlotDays } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export default async function ChallengesPanel({ supabase, userId, myPos, ready, tracks }: { supabase: any; userId: string; myPos: number | null; ready: string | null; tracks: Row[] }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { t, locale } = await getI18n();
  const STATUS: Record<string, [string, string]> = {
    awaiting_schedule: [t("Date à fixer"), "badge-warn"], scheduled: [t("Programmé"), "badge-ok"], awaiting_validation: [t("Résultat en cours de validation"), "badge-warn"],
    completed: [t("Terminé"), "badge-metal"], cancelled: [t("Annulé"), "badge-metal"], forfeited: [t("Forfait"), "badge-red"],
  };
  const { data: active } = await supabase.from("challenges")
    .select("*, challenge_slots(starts_at), challenge_races(*, race_results(winner_id))").in("status", ["awaiting_schedule", "scheduled", "awaiting_validation"]).order("created_at", { ascending: false });
  const ids = [...new Set<string>((active ?? []).flatMap((c: Row) => [c.challenger_id, c.defender_id]))];
  const [{ data: people }, target] = await Promise.all([
    ids.length ? supabase.from("public_driver").select("id,first_name,last_name,position").in("id", ids) : Promise.resolve({ data: [] }),
    myPos && myPos > 1 ? supabase.from("public_blacklist").select("driver_id,first_name,last_name,make_model,position").eq("position", myPos - 1).maybeSingle().then((r: Row) => r.data as Row | null) : Promise.resolve(null),
  ]);
  const who = (id: string) => (people ?? []).find((p: Row) => p.id === id);
  const hasActive = (active ?? []).length > 0;
  const activeTracks = tracks.filter((x) => x.status === "active");
  const kindLabel = (k: string) => (k === "last_race" ? "Last Race" : k === "sprint" ? t("Sprint urbain") : t("Standard"));
  const chosenLabel = (c: string) => (c === "champion" ? t("Défié") : c === "challenger" ? t("Challenger") : c === "random" ? t("Tirage au sort") : t("Organisation"));
  const days = weekSlotDays(locale);

  return (
    <div className="grid gap-8">
      <div className="panel">
        <div className="kicker mb-3">{t("LANCER UN DÉFI")}</div>
        {!myPos ? <p className="text-[#a5a9b0]">{t("Tu n'es pas encore dans la Blacklist. Remporte la Warm-up Race du dimanche pour viser la position #10.")}</p>
          : myPos === 1 ? <p className="text-[#a5a9b0]">{t("Tu es le #1. Personne au-dessus de toi : défends ta couronne.")}</p>
          : target?.driver_id ? (
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="label">{t("Ta cible — directement au-dessus de toi")}</div>
                <div className="font-display text-4xl uppercase"><span className="text-red">#{target.position}</span> {target.first_name} {target.last_name}</div>
                <div className="mt-2 flex items-center gap-3"><CarThumb slug={matchVehicle(target.make_model)?.slug} className="car-thumb-slant w-24 shrink-0" iconSize={18} /><span className="font-cond tracking-wide text-metal">{target.make_model}</span></div>
              </div>
              <div className="max-w-sm text-sm text-[#a5a9b0]">
                {ready && <p className="mb-2 text-[#ff6b6b]">{ready}</p>}
                <ActionForm action={createChallenge} label={t("DÉFIER LE #{n}", { n: target.position })} confirm={t("Défier {name} (#{n}) ? Il aura 48 h pour fixer le duel. Un seul défi par semaine : le règlement ne permet pas de l'annuler librement.", { name: `${target.first_name} ${target.last_name}`, n: target.position })}>
                  <input type="hidden" name="target" value={target.driver_id} />
                  <fieldset className="mb-2 mt-3 grid gap-2">
                    <legend className="label">{t("Propose 3 créneaux possibles (21 h – 00 h, heure de Paris) : le défié en choisit un")}</legend>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                        <select name={`slot_day_${i}`} required defaultValue="" aria-label={`${t("Jour")} ${i}`} className="input !py-2"><option value="" disabled>{t("Jour")} {i}…</option>{days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
                        <select name={`slot_time_${i}`} required defaultValue="" aria-label={`${t("Heure")} ${i}`} className="input !py-2"><option value="" disabled>{t("Heure")}</option>{SLOT_TIMES.map((x) => <option key={x} value={x}>{x.replace(":", " h ")}</option>)}</select>
                      </div>
                    ))}
                  </fieldset>
                </ActionForm>
              </div>
            </div>
          ) : <p className="text-[#a5a9b0]">{t("La position #{n} est vacante : aucun pilote à défier pour le moment.", { n: myPos - 1 })}</p>}
        <p className="mt-4 text-xs text-metal">{t("Règles : un seul défi par semaine · uniquement le pilote juste au-dessus · véhicule homologué obligatoire.")}</p>
      </div>

      <div>
        <div className="kicker mb-3">{t("DÉFIS EN COURS")}</div>
        {!hasActive && <p className="panel text-[#a5a9b0]">{t("Aucun défi en cours.")}</p>}
        <div className="grid gap-5">
          {(active ?? []).map((c: Row) => {
            const iAmDefender = c.defender_id === userId;
            const ch = who(c.challenger_id), df = who(c.defender_id);
            const [label, cls] = STATUS[c.status];
            const slots: string[] = [...(c.challenge_slots ?? [])].map((x: Row) => x.starts_at).sort().filter((x: string) => c.status !== "awaiting_schedule" || new Date(x) > new Date());
            const races = [...(c.challenge_races ?? [])].sort((a: Row, b: Row) => a.race_no - b.race_no);
            return (
              <article key={c.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-cond mb-1 text-xs tracking-[.25em] text-metal">{c.is_podium ? t("DUEL DU PODIUM · MEILLEUR DES 3") : t("DUEL STANDARD · 1 COURSE")}</div>
                    <div className="font-display text-3xl uppercase tracking-wide">
                      <Link href={`/blacklist/${c.challenger_id}`} className="hover:text-red">{fullName(ch)}</Link> <span className="font-marker text-xl text-red">vs</span> <Link href={`/blacklist/${c.defender_id}`} className="hover:text-red">{fullName(df)}</Link>
                    </div>
                    <div className="font-cond mt-1 text-sm tracking-wide text-metal">{t("Challenger #{a} → Défié #{b} · Tu es {role}", { a: c.challenger_position, b: c.defender_position, role: iAmDefender ? t("le défié") : t("le challenger") })}</div>
                  </div>
                  <span className={`badge ${cls}`}>{label}</span>
                </div>

                {c.status === "awaiting_schedule" && (
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <Countdown to={c.respond_by} label="pour fixer la date" />
                    {iAmDefender ? (
                      slots.length ? (
                        <ActionForm action={scheduleChallenge} label="CONFIRMER CE CRÉNEAU" confirm="Confirmer ce créneau ? Il sera communiqué aux deux pilotes et à l'organisation." className="mt-4 max-w-md">
                          <input type="hidden" name="challenge" value={c.id} />
                          <fieldset className="grid gap-2"><legend className="label">{t("Choisis l'un des créneaux proposés par le challenger")}</legend>
                            {slots.map((sl: string) => (
                              <label key={sl} className="slot-choice"><input type="radio" name="slot" value={sl} required className="accent-[#d12b2b]" /><span className="font-display text-xl">{dateTime(sl, locale)}</span></label>
                            ))}
                          </fieldset>
                        </ActionForm>
                      ) : <p className="mt-3 text-sm text-[#a5a9b0]">{t("Aucun créneau proposé ou tous sont passés : contacte l'organisation.")}</p>
                    ) : (
                      <div className="mt-3 text-sm text-[#a5a9b0]">
                        <p>{t("En attente : seul le pilote défié choisit l'un de tes créneaux, dans les 48 h. Passé ce délai, l'organisation est alertée.")}</p>
                        {slots.length > 0 && <p className="mt-2">{t("Tes créneaux proposés")} : {slots.map((sl: string) => dateTime(sl, locale)).join(" · ")}</p>}
                      </div>
                    )}
                  </div>
                )}
                {c.status !== "awaiting_schedule" && c.scheduled_at && (
                  <div className="mt-5 border-t border-white/10 pt-5"><div className="label">{t("Duel prévu")}</div><div className="font-display text-3xl">{dateTime(c.scheduled_at, locale)}</div></div>
                )}
                {c.status === "awaiting_validation" && <p className="mt-4 text-sm text-[#a5a9b0]">{t("Le résultat est saisi : il sera officiel après validation par l'organisation.")}</p>}

                <div className="mt-5 overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>{t("Course")}</th><th>Type</th><th>{t("Choisi par")}</th><th>{t("Circuit")}</th><th>{t("Résultat")}</th></tr></thead>
                    <tbody>
                      {races.map((r: Row) => {
                        const mine = (r.chosen_by === "champion" && iAmDefender) || (r.chosen_by === "challenger" && !iAmDefender);
                        const track = tracks.find((x) => x.id === r.track_id);
                        const w = r.race_results?.[0]?.winner_id ?? r.race_results?.winner_id;
                        return (
                          <tr key={r.id}>
                            <td className="font-cond font-bold">#{r.race_no}</td>
                            <td>{kindLabel(r.kind)}</td>
                            <td>{chosenLabel(r.chosen_by)}</td>
                            <td>
                              {track ? track.name : <span className="text-metal">{r.chosen_by === "random" ? t("Tirée au sort après les 2 choix") : mine ? t("À toi de choisir") : t("À choisir")}</span>}
                            </td>
                            <td>{w ? fullName(who(w)) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {races.filter((r: Row) => !r.track_id && ((r.chosen_by === "champion" && iAmDefender) || (r.chosen_by === "challenger" && !iAmDefender))).map((r: Row) => (
                    <div key={r.id} className="mt-5 border-t border-white/10 pt-5">
                      <div className="kicker mb-2">{t("CHOISIS TA CARTE")} — {t("Course")} #{r.race_no}</div>
                      {c.status === "scheduled" ? (
                        <ActionForm action={setRaceTrack} label="VALIDER MA CARTE" confirm="Valider cette carte ? Le choix est définitif." className="">
                          <input type="hidden" name="race" value={r.id} />
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            {activeTracks.map((x) => (
                              <label key={x.id} className="track-pick">
                                <input type="radio" name="track" value={x.id} required className="sr-only" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {x.image_path ? <img src={trackImageUrl(x.image_path)!} alt="" loading="lazy" className="track-pick-img" /> : <span className="track-pick-img grid place-items-center text-xs text-metal">—</span>}
                                <span className="font-cond block truncate px-2 py-1.5 text-sm font-bold uppercase tracking-wide">{x.name}</span>
                              </label>
                            ))}
                          </div>
                        </ActionForm>
                      ) : <p className="text-sm text-[#a5a9b0]">{t("Tu pourras choisir ta carte dès que la date du duel sera validée.")}</p>}
                    </div>
                  ))}
                  {c.is_podium && <div className="font-cond mt-3 text-lg tracking-wide">{t("Score")} — {t("Champion")} <b className="text-white">{c.champion_wins}</b> : <b className="text-white">{c.challenger_wins}</b> {t("Challenger")}</div>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
