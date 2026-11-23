import { AdminHead } from "@/components/AdminUI";
import PlanEditorForm from "@/components/PlanEditorForm";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditorAdmin() {
  const [{ t }] = await Promise.all([getI18n(), requireAdmin()]);
  return (
    <>
      <AdminHead kicker={t("RÉSEAU DE COURSES")} title={t("Éditeur de circuit")}>{t("Trace un parcours directement sur la carte : le site fabrique le plan BooBoo Crew (carte recadrée, cadre, départ et arrivée), puis crée le circuit avec le tracé rouge et la petite voiture animée.")}</AdminHead>
      <div className="req-card"><PlanEditorForm /></div>
    </>
  );
}
