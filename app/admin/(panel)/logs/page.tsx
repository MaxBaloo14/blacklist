import { AdminHead } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LogsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(300);
  if (sp.q) q = q.ilike("action", `%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data: logs }, { data: roles }] = await Promise.all([q, supabase.from("user_roles").select("user_id,label")]);
  return (
    <>
      <AdminHead kicker={t("TRANSPARENCE")} title={t("Journal d'audit")}>{t("Journal de toutes les actions d'administration : classement, véhicules, duels, paiements, règles, circuits. Non modifiable depuis le site.")}</AdminHead>
      <form className="mb-5 flex gap-3"><input name="q" defaultValue={sp.q} placeholder={t("Filtrer par action (ex. ranking, vehicle, reward)…")} className="input max-w-sm" /><button className="btn btn-dark btn-sm">{t("FILTRER")}</button></form>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Organisateur")}</th><th>{t("Action")}</th><th>{t("Cible")}</th><th>{t("Détails")}</th></tr></thead><tbody>
        {logs?.map((l) => (
          <tr key={l.id}><td className="whitespace-nowrap">{dateTime(l.created_at, locale)}</td><td>{roles?.find((r) => r.user_id === l.admin_id)?.label ?? l.admin_id?.slice(0, 8) ?? "système"}</td><td><span className="badge badge-metal">{l.action}</span></td><td className="font-mono text-xs text-metal">{l.target_id?.slice(0, 8)}</td>
            <td className="max-w-md truncate font-mono text-xs text-[#a5a9b0]" title={JSON.stringify(l.details)}>{l.details ? JSON.stringify(l.details) : ""}</td></tr>
        ))}
      </tbody></table>{!logs?.length && <p className="p-5 text-[#a5a9b0]">{t("Aucune entrée.")}</p>}</div>
    </>
  );
}
