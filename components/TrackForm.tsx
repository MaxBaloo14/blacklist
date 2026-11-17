import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import VideoUpload from "@/components/VideoUpload";
import { saveTrack } from "@/app/actions/admin";
import { getT } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export default async function TrackForm({ track }: { track?: Row }) {
  const t = await getT();
  const types = ["Sprint urbain", "Circuit", "Last Race", "Warm-up"];
  const diffs: [string, string][] = [["Easy", "Facile"], ["Medium", "Moyen"], ["Hard", "Difficile"], ["Extreme", "Extrême"]];
  return (
    <ActionForm action={saveTrack} label={track ? "ENREGISTRER LE CIRCUIT" : "CRÉER LE CIRCUIT"} reset={!track} small={!!track} encType="multipart/form-data">
      {track && <input type="hidden" name="id" value={track.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Nom du circuit")}><input name="name" defaultValue={track?.name} required className="input" /></Field>
        <Field label={t("Type de course")}><select name="race_type" defaultValue={track?.race_type ?? "Sprint urbain"} className="input">{types.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
        <Field label={t("Point de départ")}><input name="start_point" defaultValue={track?.start_point} required className="input" /></Field>
        <Field label={t("Point d'arrivée")}><input name="end_point" defaultValue={track?.end_point} required className="input" /></Field>
        <Field label={t("Distance (km)")}><input name="distance_km" type="number" step="0.01" min="0.01" defaultValue={track?.distance_km} required className="input" /></Field>
        <Field label={t("Difficulté")}><select name="difficulty" defaultValue={track?.difficulty ?? "Medium"} className="input">{diffs.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></Field>
        <Field label={t("Statut")}><select name="status" defaultValue={track?.status ?? "active"} className="input"><option value="active">{t("Actif")}</option><option value="inactive">{t("Inactif")}</option></select></Field>
        <Field label={t("Image ou carte")} hint={t("JPEG, PNG ou WebP — 5 Mo max.")}><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="input file:mr-3 file:border-0 file:bg-red file:px-3 file:py-1 file:font-cond file:text-xs file:font-bold file:uppercase file:text-white" /></Field>
        <VideoUpload current={track?.video_path} />
        <Field label={t("Description")} className="sm:col-span-2"><textarea name="description" defaultValue={track?.description ?? ""} maxLength={1000} className="input" /></Field>
      </div>
    </ActionForm>
  );
}
