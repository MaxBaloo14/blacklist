import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import CalibrateForm from "@/components/CalibrateForm";
import PlanEditorForm, { type EditorInitial } from "@/components/PlanEditorForm";
import { deleteDraft } from "@/app/actions/editor";
import { getMapScale } from "@/lib/data";
import { dateTime, kmLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/auth";
import type { Row } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditorAdmin({ searchParams }: { searchParams: Promise<{ track?: string; draft?: string }> }) {
  const [{ t, locale }, sp, { supabase }, scale] = await Promise.all([getI18n(), searchParams, requireAdmin(), getMapScale()]);
  const uuid = /^[0-9a-f-]{36}$/;
  const [{ data: drafts }, { data: tracks }] = await Promise.all([
    supabase.from("track_drafts").select("id,name,updated_at,distance_km").order("updated_at", { ascending: false }),
    supabase.from("race_tracks").select("id,name,distance_km,route_path,status").not("route_path", "is", null).order("name"),
  ]);
  let initial: EditorInitial = {};
  if (sp.draft && uuid.test(sp.draft)) {
    const { data: d } = await supabase.from("track_drafts").select("*").eq("id", sp.draft).maybeSingle();
    if (d) initial = { draft: d.id, name: d.name, race_type: d.race_type, difficulty: d.difficulty, description: d.description ?? "", distance_km: d.distance_km, points: d.points, follow: d.follow };
  } else if (sp.track && uuid.test(sp.track)) {
    const { data: tk } = await supabase.from("race_tracks").select("*").eq("id", sp.track).maybeSingle();
    if (tk) initial = { track: tk.id, name: tk.name, race_type: tk.race_type, difficulty: tk.difficulty, description: tk.description ?? "", status: tk.status, distance_km: tk.distance_km, points: tk.editor_points ?? undefined, follow: tk.editor_follow ?? true };
  }
  const key = initial.draft ?? initial.track ?? "new";
  return (
    <>
      <AdminHead kicker={t("RÉSEAU DE COURSES")} title={t("Éditeur de circuit")}>{t("Trace un parcours directement sur la carte : le site fabrique le plan BooBoo Crew (carte recadrée, cadre, départ et arrivée), puis crée le circuit avec le tracé rouge et la petite voiture animée.")}</AdminHead>
      {initial.track && <p className="badge badge-warn mb-4 !normal-case">{t("Retouche du circuit")} « {initial.name} » — <Link href="/admin/editor" className="underline">{t("annuler")}</Link></p>}
      {initial.draft && <p className="badge badge-warn mb-4 !normal-case">{t("Brouillon")} « {initial.name} » — <Link href="/admin/editor" className="underline">{t("nouveau circuit")}</Link></p>}
      <div className="req-card"><PlanEditorForm key={key} mPerPx={scale} initial={initial} /></div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="kicker mb-3">{t("MES BROUILLONS")} ({drafts?.length ?? 0})</div>
          <div className="grid gap-3">
            {(drafts ?? []).map((d: Row) => (
              <article key={d.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-ink2 p-4">
                <div><div className="font-cond text-lg font-bold uppercase tracking-wide">{d.name}</div><div className="text-xs text-metal">{dateTime(d.updated_at, locale)} · {kmLabel(d.distance_km)}</div></div>
                <div className="flex items-start gap-2">
                  <Link href={`/admin/editor?draft=${d.id}`} className="btn btn-red btn-sm">{t("REPRENDRE")}</Link>
                  <ActionForm action={deleteDraft} label="SUPPRIMER" variant="ghost" small confirm="Supprimer ce brouillon ?" className="[&>div]:mt-0"><input type="hidden" name="draft" value={d.id} /></ActionForm>
                </div>
              </article>
            ))}
            {!drafts?.length && <p className="panel text-[#a5a9b0]">{t("Aucun brouillon.")}</p>}
          </div>
        </section>
        <section>
          <div className="kicker mb-3">{t("RETOUCHER UN CIRCUIT")}</div>
          <div className="grid gap-3">
            {(tracks ?? []).map((tk: Row) => (
              <article key={tk.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-ink2 p-4">
                <div><div className="font-cond text-lg font-bold uppercase tracking-wide">{tk.name}</div><div className="text-xs text-metal">{kmLabel(tk.distance_km)} · {tk.status === "active" ? t("Actif") : t("Inactif")}</div></div>
                <Link href={`/admin/editor?track=${tk.id}`} className="btn btn-ghost btn-sm">{t("RETRACER / MODIFIER")}</Link>
              </article>
            ))}
          </div>
        </section>
      </div>
      <CalibrateForm current={scale} />
    </>
  );
}
