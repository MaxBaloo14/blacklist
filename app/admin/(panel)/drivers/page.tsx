import Link from "next/link";
import { AdminHead } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function Drivers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { t, locale } = await getI18n();
  const L = labels(t);
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (sp.filter === "pending") q = q.eq("registration_status", "pending");
  if (sp.q) { const s = sp.q.replace(/[%,()]/g, ""); q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,discord_tag.ilike.%${s}%`); }
  const [{ data: drivers }, { data: vehicles }, { data: ranks }] = await Promise.all([
    q.limit(300),
    supabase.from("vehicles").select("owner_id,status,make_model").in("status", ["approved", "pending"]),
    supabase.from("blacklist_rankings").select("position,driver_id").not("driver_id", "is", null),
  ]);
  return (
    <>
      <AdminHead kicker={t("GESTION")} title={t("Pilotes")}>{t("Tous les pilotes inscrits : validation des inscriptions, modification, suspension ou bannissement.")}</AdminHead>
      <form className="mb-5 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q} placeholder={t("Rechercher nom, prénom, Discord…")} className="input max-w-sm" />
        <select name="filter" defaultValue={sp.filter ?? ""} className="input max-w-[200px]"><option value="">{t("Tous")}</option><option value="pending">{t("Inscriptions à valider")}</option></select>
        <button className="btn btn-dark btn-sm">{t("FILTRER")}</button>
      </form>
      <div className="overflow-x-auto bg-ink2">
        <table className="tbl">
          <thead><tr><th>{t("Pilote")}</th><th>{t("Discord")}</th><th>{t("Rang")}</th><th>{t("Véhicule")}</th><th>{t("Inscription")}</th><th>{t("Compte")}</th><th>{t("Créé")}</th></tr></thead>
          <tbody>
            {drivers?.map((d) => {
              const v = vehicles?.find((x) => x.owner_id === d.id && x.status === "approved") ?? vehicles?.find((x) => x.owner_id === d.id);
              const r = ranks?.find((x) => x.driver_id === d.id);
              return (
                <tr key={d.id}>
                  <td><Link href={`/admin/drivers/${d.id}`} className="font-cond text-lg font-bold uppercase tracking-wide hover:text-red">{d.first_name} {d.last_name}</Link></td>
                  <td>{d.discord_tag}</td><td>{r ? `#${r.position}` : "—"}</td>
                  <td>{v ? <>{v.make_model} <span className={`badge ${v.status === "approved" ? "badge-ok" : "badge-warn"}`}>{L.vehicle(v.status)}</span></> : "—"}</td>
                  <td><span className={`badge ${d.registration_status === "validated" ? "badge-ok" : d.registration_status === "rejected" ? "badge-red" : "badge-warn"}`}>{L.reg(d.registration_status)}</span></td>
                  <td><span className={`badge ${d.account_status === "active" ? "badge-metal" : "badge-red"}`}>{L.account(d.account_status)}</span></td>
                  <td className="whitespace-nowrap">{dateOnly(d.created_at, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!drivers?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun résultat.")}</p>}
      </div>
    </>
  );
}
