import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { saveShopItem } from "@/app/actions/admin";
import { getT } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export default async function ShopItemForm({ item }: { item?: Row }) {
  const t = await getT();
  return (
    <ActionForm action={saveShopItem} label={item ? "ENREGISTRER" : "AJOUTER L'ARTICLE"} reset={!item} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label={t("Nom")}><input name="name" required minLength={2} maxLength={80} defaultValue={item?.name} className="input" /></Field>
      <Field label={t("Catégorie")}><input name="category" required maxLength={40} defaultValue={item?.category ?? "Divers"} className="input" /></Field>
      <Field label={t("Prix (zigollars)")}><input name="price" type="number" min={1} required defaultValue={item?.price} className="input" /></Field>
      <Field label={t("Stock")} hint={t("Laisser vide = illimité.")}><input name="stock" type="number" min={0} defaultValue={item?.stock ?? ""} className="input" /></Field>
      <Field label={t("Description")} className="sm:col-span-2"><input name="description" maxLength={300} defaultValue={item?.description ?? ""} className="input" /></Field>
      <Field label={t("Ordre d'affichage")}><input name="sort" type="number" min={0} defaultValue={item?.sort ?? 100} className="input" /></Field>
      <Field label={t("Disponible jusqu'au")} hint={t("Facultatif : l'article disparaît à cette date (heure de Paris).")}><input name="ends_at" type="datetime-local" defaultValue={item?.ends_at ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(item.ends_at)).replace(" ", "T") : ""} className="input" /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="limited" defaultChecked={Boolean(item?.limited)} className="accent-[#d12b2b]" /> {t("Édition limitée (badge)")}</label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={item ? item.active : true} className="accent-[#d12b2b]" /> {t("Visible dans la boutique")}</label>
    </ActionForm>
  );
}
