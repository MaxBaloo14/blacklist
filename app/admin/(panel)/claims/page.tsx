import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import { handleClaim } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const dynamic = "force-dynamic";
const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };

export default async function ClaimsAdmin() {
  const [{ t, locale }, { supabase }] = await Promise.all([getI18n(), requireAdmin()]);
  const [{ data: claims }, { data: people }] = await Promise.all([
    supabase.from("claims").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,first_name,last_name"),
  ]);
  const who = new Map<string, Row>((people ?? []).map((p: Row) => [p.id, p]));
  const ST: Record<string, [string, string]> = { open: [t("Envoyée"), "badge-warn"], in_progress: [t("En cours d'étude"), "badge-warn"], resolved: [t("Traitée"), "badge-ok"], rejected: [t("Refusée"), "badge-red"] };
  const todo = (claims ?? []).filter((c: Row) => c.status === "open" || c.status === "in_progress");
  const done = (claims ?? []).filter((c: Row) => !todo.includes(c));
  const card = (c: Row) => (
    <article key={c.id} className="border border-white/10 bg-ink2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase">{c.title}</h2><span className={`badge ${ST[c.status][1]}`}>{ST[c.status][0]}</span></div>
      <div className="text-sm text-[#a5a9b0]">{fullName(who.get(c.user_id))} · {dateTime(c.created_at, locale)}</div>
      <p className="mt-3 whitespace-pre-line text-[15px]">{c.message}</p>
      {c.links?.length > 0 && <ul className="mt-3 grid gap-1">{c.links.map((l: string) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-red underline underline-offset-4 hover:text-white">{host(l)} ↗</a></li>)}</ul>}
      {c.admin_reply && <p className="mt-3 border-t border-white/10 pt-3 text-sm"><span className="label">{t("Réponse envoyée")}</span><br />{c.admin_reply}</p>}
      <ActionForm action={handleClaim} label="ENREGISTRER" small className="mt-4 grid max-w-xl gap-2">
        <input type="hidden" name="claim" value={c.id} />
        <select name="status" defaultValue={c.status === "open" ? "in_progress" : c.status === "in_progress" ? "resolved" : c.status} className="input">
          <option value="in_progress">{t("En cours d'étude")}</option><option value="resolved">{t("Traitée (réponse obligatoire)")}</option><option value="rejected">{t("Refusée (réponse obligatoire)")}</option>
        </select>
        <textarea name="reply" rows={3} maxLength={2000} placeholder={t("Réponse visible par le pilote")} className="input" defaultValue={c.admin_reply ?? ""} />
      </ActionForm>
    </article>
  );
  return (
    <>
      <AdminHead kicker={t("COURRIER DES PILOTES")} title={t("Réclamations")}>{t("Les réclamations envoyées par les pilotes, avec leurs liens de preuve. Réponds ici : le pilote est prévenu et voit ta réponse sur sa page.")}</AdminHead>
      <div className="kicker mb-3">{t("À TRAITER")} ({todo.length})</div>
      <div className="mb-10 grid gap-4">{todo.map(card)}{!todo.length && <p className="panel text-[#a5a9b0]">{t("Aucune réclamation en attente.")}</p>}</div>
      {done.length > 0 && <><div className="kicker mb-3">{t("DÉJÀ TRAITÉES")}</div><div className="grid gap-4">{done.map(card)}</div></>}
    </>
  );
}
