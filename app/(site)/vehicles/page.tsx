import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import VehicleList, { type Vehicle } from "@/components/VehicleList";
import data from "@/data/vehicles.json";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Véhicules autorisés" };

const vehicles = data.vehicles as Vehicle[];
const categories = [...new Set(vehicles.map((v) => v.category))];   // l'ordre du fichier d'import fait foi

export default async function Vehicles() {
  const { t } = await getI18n();
  return (
    <>
      <PageHead kicker={t("RÈGLEMENT")} title={t("Véhicules")} em={t("autorisés")}>
        {t("Seuls les véhicules de cette liste peuvent s'engager en duel. Les véhicules des offres premium de la boutique sont interdits.")}
      </PageHead>
      <section className="py-14">
        <div className="wrap"><VehicleList vehicles={vehicles} categories={categories} /></div>
      </section>
    </>
  );
}
