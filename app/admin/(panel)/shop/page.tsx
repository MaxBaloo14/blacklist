import ActionForm from "@/components/ActionForm";
import { AdminHead, Details, DriverSelect } from "@/components/AdminUI";
import ShopItemForm from "@/components/ShopItemForm";
import { deleteShopItem, grantPoints, shopOrder } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName, points } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShopAdmin() {
  const [{ t, locale }, { supabase }] = await Promise.all([getI18n(), requireAdmin()]);
  const [{ data: items }, { data: orders }, { data: drivers }, { data: bals }] = await Promise.all([
    supabase.from("shop_items").select("*").order("sort").order("name"),
    supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("profiles").select("id,first_name,last_name").order("first_name"),
    supabase.from("point_balances").select("user_id,balance"),
  ]);
  const people = new Map<string, Row>((drivers ?? []).map((d: Row) => [d.id, d]));
  const balance = new Map<string, number>((bals ?? []).map((b: Row) => [b.user_id, Number(b.balance)]));
  const pending = (orders ?? []).filter((o: Row) => o.status === "pending");
  const done = (orders ?? []).filter((o: Row) => o.status !== "pending");
  return (
    <>
      <AdminHead kicker={t("ZIGOLLARS & PARIS")} title={t("Boutique")}>{t("Gère les articles, remets les commandes en jeu, puis marque-les comme remises. Une commande annulée rembourse automatiquement les zigollars. Les paris se règlent seuls à la validation d'un duel.")}</AdminHead>

      <div className="kicker mb-3">{t("COMMANDES À REMETTRE")} ({pending.length})</div>
      <div className="mb-10 grid gap-3">
        {pending.map((o: Row) => (
          <article key={o.id} className="flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-ink2 p-4">
            <div><div className="font-display text-2xl uppercase">{t(o.item_name)}</div><div className="text-sm text-[#a5a9b0]">{fullName(people.get(o.user_id))} · {points(o.price, locale)} · {dateTime(o.created_at, locale)}</div></div>
            <div className="flex flex-wrap items-start gap-2">
              <ActionForm action={shopOrder} label="REMIS EN JEU" small className="[&>div]:mt-0"><input type="hidden" name="order" value={o.id} /><input type="hidden" name="status" value="delivered" /></ActionForm>
              <Details summary={t("Annuler et rembourser")} tone="text-red">
                <ActionForm action={shopOrder} label="ANNULER ET REMBOURSER" variant="ghost" small confirm={t("Annuler cette commande et rembourser les zigollars ?")}><input type="hidden" name="order" value={o.id} /><input type="hidden" name="status" value="cancelled" /><input name="note" placeholder={t("Motif (facultatif)")} className="input mt-2" /></ActionForm>
              </Details>
            </div>
          </article>
        ))}
        {!pending.length && <p className="panel text-[#a5a9b0]">{t("Aucune commande en attente.")}</p>}
      </div>

      <div className="panel mb-10"><div className="kicker mb-3">{t("NOUVEL ARTICLE")}</div><ShopItemForm /></div>
      <div className="kicker mb-3">{t("ARTICLES")}</div>
      <div className="mb-10 grid gap-3">
        {(items ?? []).map((it: Row) => (
          <article key={it.id} className="border border-white/10 bg-ink2 p-4">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl uppercase">{it.name}</h2><span className="badge badge-metal">{it.category}</span><span className="badge badge-red">{points(it.price, locale)}</span>{!it.active && <span className="badge badge-metal">{t("MASQUÉ")}</span>}{it.stock !== null && <span className="badge badge-warn">{t("Stock")} : {it.stock}</span>}</div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <Details summary={t("Modifier")}><ShopItemForm item={it} /></Details>
              <Details summary={t("Supprimer")} tone="text-red"><ActionForm action={deleteShopItem} label="SUPPRIMER" variant="ghost" small confirm={t("Supprimer définitivement « {n} » ?", { n: it.name })}><input type="hidden" name="id" value={it.id} /></ActionForm></Details>
            </div>
          </article>
        ))}
      </div>

      <div className="panel mb-10">
        <div className="kicker mb-3">{t("AJUSTER LES ZIGOLLARS D'UN PILOTE")}</div>
        <ActionForm action={grantPoints} label="APPLIQUER" className="grid max-w-xl gap-3">
          <DriverSelect name="driver" drivers={drivers ?? []} />
          <input name="delta" type="number" required placeholder={t("Montant (négatif pour retirer)")} className="input" />
          <input name="reason" required minLength={3} placeholder={t("Motif")} className="input" />
        </ActionForm>
        <p className="mt-3 text-xs text-metal">{t("Soldes")} : {[...balance.entries()].slice(0, 12).map(([id, b]) => `${fullName(people.get(id))} ${points(b, locale)}`).join(" · ") || "—"}</p>
      </div>

      {done.length > 0 && (
        <>
          <div className="kicker mb-3">{t("COMMANDES TRAITÉES")}</div>
          <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Pilote")}</th><th>{t("Article")}</th><th>{t("Statut")}</th></tr></thead><tbody>
            {done.map((o: Row) => <tr key={o.id}><td>{dateTime(o.created_at, locale)}</td><td>{fullName(people.get(o.user_id))}</td><td>{t(o.item_name)} · {points(o.price, locale)}</td><td><span className={`badge ${o.status === "delivered" ? "badge-ok" : "badge-metal"}`}>{o.status === "delivered" ? t("Remis") : t("Annulé et remboursé")}</span></td></tr>)}
          </tbody></table></div>
        </>
      )}
    </>
  );
}
