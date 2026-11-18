import { Download } from "lucide-react";
import { AdminHead } from "@/components/AdminUI";
import { getT } from "@/lib/i18n";

export default async function ExportsPage() {
  const t = await getT();
  const items = [
    { kind: "ranking", title: t("Classement"), text: t("Les 10 positions avec pilote, véhicule, victoires, défaites, prime du rang, téléphone et statut du compte.") },
    { kind: "duels", title: t("Historique des duels"), text: t("Tous les duels, y compris annulés : rangs, statut, vainqueur, score, clip, dates et motif d'annulation.") },
  ];
  return (
    <>
      <AdminHead kicker={t("DONNÉES")} title={t("Exports")}>{t("Fichiers CSV prêts pour Excel ou Google Sheets (séparateur « ; », accents conservés). Ils contiennent des données personnelles (téléphones) : ne les partage pas publiquement.")}</AdminHead>
      <div className="grid gap-5 lg:grid-cols-2">
        {items.map((i) => (
          <div key={i.kind} className="panel">
            <div className="kicker mb-2">CSV</div>
            <h2 className="font-display text-3xl uppercase">{i.title}</h2>
            <p className="mt-2 min-h-12 text-sm text-[#a5a9b0]">{i.text}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={`/api/export/${i.kind}?full=1`} className="btn btn-red btn-sm"><Download size={16} /> {t("VERSION ORGANISATION")}</a>
              <a href={`/api/export/${i.kind}`} className="btn btn-ghost btn-sm"><Download size={16} /> {t("VERSION PUBLIQUE")}</a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
