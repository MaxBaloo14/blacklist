/** Catalogue des véhicules autorisés (fichier importé du concessionnaire) + recherche d'un véhicule à partir du texte saisi par un pilote. */
export type CatalogVehicle = { slug: string; label: string; name: string; brand: string; category: string; hp: number | null; img: boolean };

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Raw = { slug?: string; img?: boolean; name: string; brand: string; model: string; category: string; hp: number | null };
const labelOf = (v: Raw) => (norm(v.model).startsWith(norm(v.brand)) ? v.model : `${v.brand} ${v.model}`);

export type { Raw as RawVehicle };

/** Construit le catalogue et ses recherches à partir de la liste importée (nom affiché « Marque Modèle »). */
export function makeCatalog(list: Raw[]) {
const CATALOG: CatalogVehicle[] = list.map((v) => ({ slug: v.slug ?? norm(`${v.brand} ${v.model}`).replace(/ /g, "-"), label: labelOf(v), name: v.name, brand: v.brand, category: v.category, hp: v.hp, img: Boolean(v.img) }));
const BY_SLUG = new Map(CATALOG.map((v) => [v.slug, v]));
const BY_LABEL = new Map<string, CatalogVehicle>();
const NAME_COUNT = new Map<string, number>();
for (const v of CATALOG) { BY_LABEL.set(norm(v.label), v); NAME_COUNT.set(norm(v.name), (NAME_COUNT.get(norm(v.name)) ?? 0) + 1); }
const BY_NAME = new Map(CATALOG.filter((v) => NAME_COUNT.get(norm(v.name)) === 1).map((v) => [norm(v.name), v]));

const catalogBySlug = (slug: string | null | undefined) => (slug ? BY_SLUG.get(slug) ?? null : null);

/** Retrouve le véhicule du catalogue d'après « Marque Modèle » : exact, puis par nom seul (s'il est unique), puis le plus long libellé contenu dans le texte. */
function matchVehicle(text: string | null | undefined): CatalogVehicle | null {
  const n = norm(text ?? "");
  if (n.length < 3) return null;
  const exact = BY_LABEL.get(n) ?? BY_NAME.get(n);
  if (exact) return exact;
  let best: CatalogVehicle | null = null;
  for (const v of CATALOG) { const l = norm(v.label); if (l.length >= 5 && n.includes(l) && (!best || l.length > norm(best.label).length)) best = v; }
  return best;
}

/** Recherche instantanée pour le sélecteur (nom, marque ou libellé, sans accent ni casse). */
function searchCatalog(query: string, limit = 8): CatalogVehicle[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(" ");
  const scored: [number, CatalogVehicle][] = [];
  for (const v of CATALOG) {
    const hay = norm(`${v.label} ${v.name}`);
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push([(norm(v.name).startsWith(q) ? 0 : norm(v.label).startsWith(q) ? 1 : 2), v]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label, "fr")).slice(0, limit).map(([, v]) => v);
}

return { CATALOG, catalogBySlug, matchVehicle, searchCatalog };
}
