import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import { getWarmupParticipants, getWarmups } from "@/lib/data";
import { dateTime } from "@/lib/format";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Warm-up Race" };
export const dynamic = "force-dynamic";

export default async function Warmup() {
  const [events, parts] = await Promise.all([getWarmups(), getWarmupParticipants()]);
  const upcoming = [...events].filter((e) => ["scheduled", "running"].includes(e.status)).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const history = events.filter((e) => e.id !== upcoming?.id);
  const names = (id: string) => parts.filter((p) => p.event_id === id);
  const winner = (e: Row) => parts.find((p) => p.event_id === e.id && p.driver_id === e.winner_id);

  return (
    <>
      <PageHead kicker="EVERY SUNDAY" title="Warm-up" em="Race">La course d&apos;entrée. Chaque dimanche, un seul vainqueur : celui qui débloque l&apos;accès à la position #10.</PageHead>
      <section className="py-14">
        <div className="wrap">
          <div className="kicker mb-3">PROCHAINE ÉDITION</div>
          {upcoming ? (
            <div className="panel grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <div className="font-display text-5xl uppercase">{dateTime(upcoming.scheduled_at)}</div>
                <span className="badge badge-warn mt-3">{upcoming.status === "running" ? "In progress" : "Scheduled"}</span>
                <dl className="mt-6 grid gap-3">
                  <div><dt className="label !mb-0">Tracé sélectionné</dt><dd className="font-cond text-lg tracking-wide">{upcoming.race_tracks?.name ?? "À annoncer"}</dd></div>
                  {upcoming.race_tracks && <div><dt className="label !mb-0">Parcours</dt><dd className="font-cond tracking-wide text-[#cfcfcf]">{upcoming.race_tracks.start_point} → {upcoming.race_tracks.end_point}</dd></div>}
                </dl>
              </div>
              <div>
                <div className="label">Participants ({names(upcoming.id).length})</div>
                {names(upcoming.id).length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {names(upcoming.id).map((p) => (
                      <li key={p.driver_id} className="border-l-2 border-red-dark bg-ink px-3 py-2"><span className="font-cond block uppercase tracking-wide">{p.first_name} {p.last_name}</span><span className="text-xs text-metal">{p.make_model}</span></li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-metal">Les participants sont inscrits par l&apos;organisation.</p>}
              </div>
            </div>
          ) : <p className="panel text-[#a5a9b0]">Aucune Warm-up Race programmée. Rendez-vous bientôt.</p>}

          <h2 className="h2 mb-6 mt-16">Historique des <em>éditions</em></h2>
          {history.length ? (
            <div className="overflow-x-auto bg-ink2">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Tracé</th><th>Participants</th><th>Résultat</th><th>Vainqueur</th></tr></thead>
                <tbody>
                  {history.map((e) => (
                    <tr key={e.id}>
                      <td className="font-cond whitespace-nowrap tracking-wide">{dateTime(e.scheduled_at)}</td>
                      <td>{e.race_tracks?.name ?? "—"}</td>
                      <td>{names(e.id).length}</td>
                      <td><span className={`badge ${e.status === "completed" ? "badge-ok" : "badge-metal"}`}>{e.status}</span></td>
                      <td className="font-cond uppercase tracking-wide">{e.validated_at ? (winner(e) ? `${winner(e)!.first_name} ${winner(e)!.last_name}` : "—") : e.winner_id ? "Validation en cours" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="panel text-[#a5a9b0]">Pas encore d&apos;historique.</p>}
        </div>
      </section>
    </>
  );
}
