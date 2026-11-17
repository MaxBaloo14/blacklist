import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { saveTrack } from "@/app/actions/admin";
import type { Row } from "@/lib/types";

export default function TrackForm({ t }: { t?: Row }) {
  return (
    <ActionForm action={saveTrack} label={t ? "SAVE TRACK" : "CREATE TRACK"} reset={!t} small={!!t} encType="multipart/form-data">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du circuit"><input name="name" defaultValue={t?.name} required className="input" /></Field>
        <Field label="Type de course"><select name="race_type" defaultValue={t?.race_type ?? "Sprint urbain"} className="input">{["Sprint urbain", "Circuit", "Last Race", "Warm-up"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Point de départ"><input name="start_point" defaultValue={t?.start_point} required className="input" /></Field>
        <Field label="Point d'arrivée"><input name="end_point" defaultValue={t?.end_point} required className="input" /></Field>
        <Field label="Distance (km)"><input name="distance_km" type="number" step="0.01" min="0.01" defaultValue={t?.distance_km} required className="input" /></Field>
        <Field label="Difficulté"><select name="difficulty" defaultValue={t?.difficulty ?? "Medium"} className="input">{["Easy", "Medium", "Hard", "Extreme"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Statut"><select name="status" defaultValue={t?.status ?? "active"} className="input"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        <Field label="Image ou carte" hint="JPEG, PNG ou WebP — 5 Mo max."><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="input file:mr-3 file:border-0 file:bg-red file:px-3 file:py-1 file:font-cond file:text-xs file:font-bold file:uppercase file:text-white" /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea name="description" defaultValue={t?.description ?? ""} maxLength={1000} className="input" /></Field>
      </div>
    </ActionForm>
  );
}
