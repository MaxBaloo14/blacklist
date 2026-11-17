import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import { getTracks } from "@/lib/data";
import { photoUrl } from "@/lib/format";

export const metadata: Metadata = { title: "Race Network" };
export const dynamic = "force-dynamic";

const diffColor: Record<string, string> = { Easy: "badge-ok", Medium: "badge-warn", Hard: "badge-red", Extreme: "badge-red" };

export default async function RaceNetwork() {
  const tracks = await getTracks();
  return (
    <>
      <PageHead kicker="OFFICIAL ROUTES" title="Race" em="Network">Les tracés officiels du réseau. Seuls les circuits actifs peuvent être choisis pour un duel.</PageHead>
      <section className="py-14">
        <div className="wrap">
          {tracks.length === 0 && <p className="panel text-[#a5a9b0]">Aucun tracé publié pour le moment.</p>}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => {
              const img = photoUrl(t.image_path, "track-images");
              return (
                <article key={t.id} className={`group overflow-hidden border border-white/10 bg-ink2 transition hover:border-red-dark ${t.status === "inactive" ? "opacity-55" : ""}`}>
                  <div className="relative aspect-video overflow-hidden bg-ink3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img ? <img src={img} alt={t.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid size-full place-items-center font-cond text-xs tracking-[.3em] text-metal">NO MAP</div>}
                    <span className={`badge absolute left-3 top-3 ${t.status === "active" ? "badge-ok" : "badge-metal"}`}>{t.status === "active" ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-3xl uppercase tracking-wide">{t.name}</h2>
                    <div className="font-cond mt-1 text-sm uppercase tracking-[.16em] text-metal">{t.race_type}</div>
                    <p className="mt-3 min-h-10 text-sm text-[#a5a9b0]">{t.description}</p>
                    <dl className="font-cond mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[15px] tracking-wide">
                      <div><dt className="label !mb-0">Départ</dt><dd>{t.start_point}</dd></div>
                      <div><dt className="label !mb-0">Arrivée</dt><dd>{t.end_point}</dd></div>
                      <div><dt className="label !mb-0">Distance</dt><dd>{Number(t.distance_km)} km</dd></div>
                      <div><dt className="label !mb-0">Difficulté</dt><dd><span className={`badge ${diffColor[t.difficulty]}`}>{t.difficulty}</span></dd></div>
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
