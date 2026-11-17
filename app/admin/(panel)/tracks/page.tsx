import ActionForm from "@/components/ActionForm";
import { AdminHead, Details } from "@/components/AdminUI";
import TrackForm from "@/components/TrackForm";
import { deleteTrack } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { photoUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TracksAdmin() {
  const { supabase } = await requireAdmin();
  const { data: tracks } = await supabase.from("race_tracks").select("*").order("created_at", { ascending: false });
  return (
    <>
      <AdminHead kicker="RACE NETWORK" title="Race tracks">Crée, modifie, active ou désactive les tracés officiels. Un circuit inactif ne peut plus être choisi pour un duel.</AdminHead>
      <div className="panel mb-10"><div className="kicker mb-3">NOUVEAU CIRCUIT</div><TrackForm /></div>
      <div className="grid gap-4">
        {tracks?.map((t) => (
          <article key={t.id} className="flex flex-wrap gap-4 border border-white/10 bg-ink2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.image_path ? <img src={photoUrl(t.image_path, "track-images")!} alt="" className="h-24 w-40 object-cover" /> : <div className="grid h-24 w-40 place-items-center bg-ink3 text-xs text-metal">NO MAP</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl uppercase">{t.name}</h2><span className={`badge ${t.status === "active" ? "badge-ok" : "badge-metal"}`}>{t.status}</span><span className="badge badge-metal">{t.difficulty}</span></div>
              <div className="text-sm text-[#a5a9b0]">{t.race_type} · {t.start_point} → {t.end_point} · {Number(t.distance_km)} km</div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <Details summary="Modifier"><TrackForm t={t} /></Details>
                <Details summary="Supprimer" tone="text-red"><ActionForm action={deleteTrack} label="DELETE" variant="ghost" small confirm={`Supprimer définitivement « ${t.name} » ?`}><input type="hidden" name="id" value={t.id} /><p className="text-sm text-[#a5a9b0]">Impossible si le circuit est déjà utilisé : désactive-le dans ce cas.</p></ActionForm></Details>
              </div>
            </div>
          </article>
        ))}
        {!tracks?.length && <p className="panel text-[#a5a9b0]">Aucun circuit.</p>}
      </div>
    </>
  );
}
