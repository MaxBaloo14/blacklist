import ActionForm from "@/components/ActionForm";
import { AdminHead, Details, Stat } from "@/components/AdminUI";
import Field from "@/components/Field";
import { confirmPayment, setRewardClip } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName, money } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RewardsAdmin() {
  const { t, locale } = await getI18n();
  const { supabase } = await requireAdmin();
  const [{ data: rewards }, { data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("rewards").select("*, reward_payments(*)").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,first_name,last_name,bank_iban"),
    supabase.from("user_roles").select("user_id,label"),
  ]);
  const who = (id: string) => fullName(profiles?.find((p) => p.id === id));
  const ibanOf = (id: string) => profiles?.find((p) => p.id === id)?.bank_iban as string | null | undefined;
  const pay = (r: { reward_payments: unknown }) => (Array.isArray(r.reward_payments) ? r.reward_payments[0] : r.reward_payments) as { paid_at: string; paid_by: string; proof_url: string | null; note: string | null } | null;
  const pending = rewards?.filter((r) => r.status === "pending") ?? [], paid = rewards?.filter((r) => r.status === "paid") ?? [];
  const sum = (l: typeof pending) => l.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <>
      <AdminHead kicker={t("CASH PRIZE")} title={t("Récompenses")}>{t("Le site ne réalise aucun transfert : il suit les versements effectués par l'organisation. Confirme chaque paiement une fois remis.")}</AdminHead>
      <div className="mb-8 grid gap-3 sm:grid-cols-3"><Stat label={t("À verser")} value={money(sum(pending), locale)} tone="text-red" /><Stat label={t("Déjà versé")} value={money(sum(paid), locale)} tone="text-ok" /><Stat label={t("Primes en attente")} value={pending.length} /></div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("En attente")}</h2>
      <div className="mb-12 grid gap-4">{pending.map((r) => (
        <article key={r.id} className="border border-white/10 bg-ink2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-display text-3xl uppercase">{who(r.driver_id)}</div><div className="font-cond tracking-wide text-metal">{t("Boss #{n} battu", { n: r.rank_beaten })} · {dateTime(r.created_at, locale)}</div></div><div className="font-display text-4xl text-red">{money(r.amount, locale)}</div></div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="label !mb-0">{t("IBAN du pilote")}</span>{ibanOf(r.driver_id) ? <code className="select-all bg-ink px-3 py-1 font-mono tracking-wider text-bone">{ibanOf(r.driver_id)}</code> : <span className="badge badge-warn">{t("IBAN non renseigné")}</span>}</div>
          <div className="mt-3 text-sm">Clip : {r.clip_url ? <a href={r.clip_url} target="_blank" rel="noopener noreferrer" className="text-red hover:text-white">{r.clip_url}</a> : <span className="text-metal">{t("non renseigné")}</span>}</div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            <Details summary={t("Confirmer le paiement")}><ActionForm action={confirmPayment} label="CONFIRMER LE PAIEMENT" confirm={t("Confirmer que {m} ont été versés à {n} ? Ton identifiant et la date seront enregistrés.", { m: money(r.amount, locale), n: who(r.driver_id) })} reset={false}><input type="hidden" name="reward" value={r.id} /><Field label={t("Justificatif (lien, optionnel)")}><input name="proof" type="url" className="input" placeholder="https://…" /></Field><Field label={t("Note")} className="mt-2"><input name="note" className="input" /></Field></ActionForm></Details>
            <Details summary={t("Lien du clip")}><ActionForm action={setRewardClip} label="ENREGISTRER LE CLIP" small variant="dark" reset={false}><input type="hidden" name="reward" value={r.id} /><input name="clip" type="url" required defaultValue={r.clip_url ?? ""} placeholder="https://…" className="input" /></ActionForm></Details>
          </div>
        </article>
      ))}{!pending.length && <p className="panel text-[#a5a9b0]">{t("Aucune prime en attente.")}</p>}</div>
      <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{t("Historique des paiements")}</h2>
      <div className="overflow-x-auto bg-ink2"><table className="tbl"><thead><tr><th>{t("Payé le")}</th><th>{t("Pilote")}</th><th>{t("Boss")}</th><th>{t("Montant")}</th><th>{t("Administrateur")}</th><th>{t("Clip")}</th><th>{t("Justificatif")}</th></tr></thead><tbody>
        {paid.map((r) => { const p = pay(r); return <tr key={r.id}><td className="whitespace-nowrap">{dateTime(p?.paid_at, locale)}</td><td>{who(r.driver_id)}</td><td>#{r.rank_beaten}</td><td className="font-cond font-bold">{money(r.amount, locale)}</td><td>{roles?.find((x) => x.user_id === p?.paid_by)?.label ?? p?.paid_by?.slice(0, 8)}</td><td>{r.clip_url ? <a href={r.clip_url} target="_blank" rel="noopener noreferrer" className="text-red">{t("Clip")}</a> : "—"}</td><td>{p?.proof_url ? <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-red">{t("Preuve")}</a> : "—"}</td></tr>; })}
      </tbody></table>{!paid.length && <p className="p-5 text-[#a5a9b0]">{t("Aucun paiement.")}</p>}</div>
    </>
  );
}
