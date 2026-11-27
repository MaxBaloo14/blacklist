// Catalogue : libellés uniques, retrouver un véhicule d'après le texte saisi, recherche du sélecteur.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeCatalog } from "../../lib/vehicle-catalog-core.ts";

const { CATALOG, matchVehicle, searchCatalog, catalogBySlug } = makeCatalog(JSON.parse(readFileSync(new URL("../../data/vehicles.json", import.meta.url), "utf8")).vehicles);

assert.ok(CATALOG.length > 300);
assert.equal(new Set(CATALOG.map((v) => v.label)).size, CATALOG.length, "libellés uniques");
assert.equal(new Set(CATALOG.map((v) => v.slug)).size, CATALOG.length, "identifiants uniques");
for (const v of CATALOG.slice(0, 40)) assert.equal(matchVehicle(v.label)?.slug, v.slug, `retrouve ${v.label}`);
assert.equal(matchVehicle("  dinka   BLISTA ")?.name, "Blista");                       // casse, espaces
assert.equal(matchVehicle("Ma Karin Sultan RS préparée")?.slug, matchVehicle("Karin Sultan RS")?.slug ?? matchVehicle("Ma Karin Sultan RS préparée")?.slug); // texte libre contenant un libellé
assert.equal(matchVehicle("voiture inconnue xyz"), null);
assert.equal(matchVehicle(""), null);
assert.ok(searchCatalog("blis").some((v) => v.name === "Blista"));
assert.ok(searchCatalog("DINKA blista").length >= 1);
assert.equal(searchCatalog("zzzzzz").length, 0);
assert.ok(searchCatalog("a", 5).length <= 5);
assert.equal(catalogBySlug(CATALOG[3].slug)?.label, CATALOG[3].label);
assert.equal(catalogBySlug("../etc"), null);
console.log("OK vehicle-catalog :", CATALOG.length, "véhicules");
