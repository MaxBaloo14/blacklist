import data from "@/data/vehicles.json";
import { makeCatalog, type RawVehicle } from "@/lib/vehicle-catalog-core";

export { norm } from "@/lib/vehicle-catalog-core";
export type { CatalogVehicle } from "@/lib/vehicle-catalog-core";

/** Catalogue des véhicules autorisés (liste importée du concessionnaire) : retrouver un véhicule d'après le texte d'un pilote, et recherche instantanée. */
export const { CATALOG, catalogBySlug, matchVehicle, searchCatalog } = makeCatalog(data.vehicles as RawVehicle[]);
