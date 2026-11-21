import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import TrackForm from "@/components/TrackForm";
import { deleteTrack } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { kmLabel, trackImageUrl } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function TracksAdmin() {
  const { t } = await getI18n();
  const L = labels(t);
  const { supabase } = await requireAdmin();
  const { data: tracks } = await supabase.from("race_tracks").select("*").order("created_at", { ascending: false });
  return (
    <>
      <AdminHead kicker={t("RÉSEAU DE COURSES")} title={t("Circuits")}>{t("Crée, modifie, active ou désactive les tracés officiels. Un circuit inactif ne peut plus être choisi pour un duel.")}</AdminHead>
      <div className="panel mb-10"><div className="kicker mb-3">{t("NOUVEAU CIRCUIT")}</div><TrackForm /></div>
      <div className="grid gap-4">
        {tracks?.map((tk) => (
          <article key={tk.id} className="flex flex-wrap gap-4 border border-white/10 bg-ink2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {tk.image_path ? <img src={trackImageUrl(tk.image_path)!} alt="" className="h-24 w-40 object-cover" /> : <div className="grid h-24 w-40 place-items-center bg-ink3 text-xs text-metal">{t("PAS DE CARTE")}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl uppercase">{tk.name}</h2><span className={`badge ${tk.status === "active" ? "badge-ok" : "badge-metal"}`}>{L.track(tk.status)}</span>{tk.route_path && <span className="badge badge-red">{t("Tracé animé")}</span>}<span className="badge badge-metal">{L.difficulty(tk.difficulty)}</span>{tk.video_path && <span className="badge badge-ok">{t("Vidéo")}</span>}</div>
              <div className="text-sm text-[#a5a9b0]">{t(tk.race_type)} · {tk.start_point} → {tk.end_point} · {kmLabel(tk.distance_km)}</div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <Details summary={t("Modifier")}><TrackForm track={tk} /></Details>
                <Details summary={t("Supprimer")} tone="text-red"><ActionForm action={deleteTrack} label="SUPPRIMER" variant="ghost" small confirm={t("Supprimer définitivement « {n} » ?", { n: tk.name })}><input type="hidden" name="id" value={tk.id} /><p className="text-sm text-[#a5a9b0]">{t("Impossible si le circuit est déjà utilisé : désactive-le dans ce cas.")}</p></ActionForm></Details>
              </div>
            </div>
          </article>
        ))}
        {!tracks?.length && <p className="panel text-[#a5a9b0]">{t("Aucun circuit.")}</p>}
      </div>
    </>
  );
}
