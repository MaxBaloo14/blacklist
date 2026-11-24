import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import TrackMap from "@/components/TrackMap";
import RouteMap from "@/components/RouteMap";
import TrackMedia from "@/components/TrackMedia";
import { getTracks } from "@/lib/data";
import { kmLabel, photoUrl, trackImageUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { title: "Race Network" };

const diffColor: Record<string, string> = { Easy: "badge-ok", Medium: "badge-warn", Hard: "badge-red", Extreme: "badge-red" };

export default async function RaceNetwork() {
  const [tracks, t] = await Promise.all([getTracks(), getT()]);
  const diff: Record<string, string> = { Easy: t("Facile"), Medium: t("Moyen"), Hard: t("Difficile"), Extreme: t("Extrême") };
  return (
    <>
      <PageHead kicker={t("TRACÉS OFFICIELS")} title={t("Réseau de")} em={t("courses")}>{t("Les tracés officiels du réseau. Seuls les circuits actifs peuvent être choisis pour un duel.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          {tracks.length === 0 && <p className="panel text-[#a5a9b0]">{t("Aucun tracé publié pour le moment.")}</p>}
          <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tracks.map((tk) => {
              const img = trackImageUrl(tk.image_path);
              const video = photoUrl(tk.video_path, "track-images");
              const routed = Boolean(tk.route_path && img && tk.route_w && tk.route_h && !video);
              const loop = tk.race_type === "Circuit" || tk.start_point === tk.end_point;
              const dur = Math.max(3, Math.min(9, 2 + (Number(tk.distance_km) || 6) / 2));
              return (
                <article key={tk.id} className={`group overflow-hidden border border-white/10 bg-ink2 transition hover:border-red-dark ${tk.status === "inactive" ? "opacity-90" : ""}`}>
                  <div className={`relative overflow-hidden bg-ink3 ${routed ? "" : "aspect-video"}`}>
                    {routed ? <RouteMap name={tk.name} src={img!.endsWith(".webp") && img!.startsWith("/img/circuits/") ? img!.replace(/\.webp$/, "-md.webp") : img!} srcSet={img!.startsWith("/img/circuits/") ? `${img!.replace(/\.webp$/, "-md.webp")} 900w, ${img} 1432w` : undefined} sizes="(min-width:1024px) 380px, (min-width:768px) 45vw, 92vw" w={tk.route_w} h={tk.route_h} path={tk.route_path} active={tk.status === "active"} />
                      : video ? <TrackMedia id={tk.id} name={tk.name} videoUrl={video} posterUrl={img} loop={loop} active={tk.status === "active"} dur={dur} />
                      : img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={tk.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                      : <TrackMap id={tk.id} name={tk.name} loop={loop} active={tk.status === "active"} dur={dur} />}
                    <span className={`badge absolute left-3 top-3 z-[4] ${tk.status === "active" ? "badge-ok" : "badge-metal"}`}>{tk.status === "active" ? t("Actif") : t("Inactif")}</span>
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-3xl uppercase tracking-wide">{tk.name}</h2>
                    <div className="font-cond mt-1 text-sm uppercase tracking-[.16em] text-metal">{t(tk.race_type)}</div>
                    {tk.description && <p className="mt-3 min-h-10 text-sm text-[#a5a9b0]">{tk.description}</p>}
                    {tk.suggested_by_name && <p data-suggested-by className="font-cond mt-2 text-xs font-bold uppercase tracking-[.2em] text-red">{t("Circuit proposé par {n}", { n: tk.suggested_by_name })}</p>}
                    <dl className="font-cond mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[15px] tracking-wide">
                      {!routed && <div><dt className="label !mb-0">{t("Départ")}</dt><dd>{tk.start_point}</dd></div>}
                      {!routed && <div><dt className="label !mb-0">{t("Arrivée")}</dt><dd>{tk.end_point}</dd></div>}
                      <div><dt className="label !mb-0">Distance</dt><dd>{kmLabel(tk.distance_km)}</dd></div>
                      <div><dt className="label !mb-0">{t("Difficulté")}</dt><dd><span className={`badge ${diffColor[tk.difficulty]}`}>{diff[tk.difficulty]}</span></dd></div>
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
