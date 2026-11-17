import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DuelCard from "@/components/DuelCard";
import PageHead from "@/components/PageHead";
import { getDriverDuels, getPublicDriver } from "@/lib/data";
import { photoUrl } from "@/lib/format";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = uuid.test(id) ? await getPublicDriver(id) : null;
  return { title: d ? `${d.first_name} ${d.last_name}` : "Pilote" };
}

export default async function DriverPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const [d, duels] = await Promise.all([getPublicDriver(id), getDriverDuels(id)]);
  if (!d) notFound();
  const photo = photoUrl(d.photo_path);
  const total = d.wins + d.losses;
  return (
    <>
      <PageHead kicker={d.position ? `BLACKLIST #${d.position}` : "UNRANKED DRIVER"} title={`${d.first_name}`} em={d.last_name} />
      <section className="py-14">
        <div className="wrap grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="border border-white/10 bg-ink2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt={d.make_model ?? ""} className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center bg-ink3 font-cond tracking-[.3em] text-metal">NO VEHICLE ENGAGED</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div><div className="label">Véhicule engagé</div><div className="font-cond text-2xl font-bold uppercase tracking-wide">{d.make_model ?? "—"}</div></div>
              {d.vehicle_class && <span className="badge badge-metal">{d.vehicle_class}</span>}
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="panel flex items-center gap-6">
              <div className="font-display text-[84px] leading-none text-red">{d.position ?? "—"}</div>
              <div><div className="label">Position</div><div className="font-cond text-lg tracking-wide text-[#cfcfcf]">{d.position ? "Membre de la Blacklist" : "Hors classement"}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["Victoires", d.wins, "text-ok"], ["Défaites", d.losses, "text-red"], ["Défis remportés", d.challenges_won, "text-bone"]].map(([l, v, c]) => (
                <div key={l as string} className="bg-ink2 p-5 text-center"><div className={`font-display text-5xl ${c}`}>{v}</div><div className="label mt-1">{l}</div></div>
              ))}
            </div>
            {total > 0 && (
              <div className="bg-ink2 p-5">
                <div className="label">Ratio de victoires</div>
                <div className="mt-2 h-2 bg-white/10"><div className="h-full bg-red" style={{ width: `${Math.round((d.wins / total) * 100)}%` }} /></div>
                <div className="font-cond mt-1.5 text-sm text-metal">{Math.round((d.wins / total) * 100)} % sur {total} duel(s)</div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="pb-24">
        <div className="wrap">
          <h2 className="h2 mb-8">Historique des <em>duels</em></h2>
          {duels.length ? <div className="grid gap-4 md:grid-cols-3">{duels.map((x) => <DuelCard key={x.id} d={x} />)}</div> : <p className="panel text-[#a5a9b0]">Aucun duel enregistré.</p>}
        </div>
      </section>
    </>
  );
}
