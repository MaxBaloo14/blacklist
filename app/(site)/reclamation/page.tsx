import type { Metadata } from "next";
import ClaimForm from "@/components/ClaimForm";
import PageHead from "@/components/PageHead";
import { requireDriver } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Réclamation" };
export const dynamic = "force-dynamic";

const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };

export default async function Reclamation() {
  const [{ t, locale }, { supabase, user }] = await Promise.all([getI18n(), requireDriver()]);
  const { data } = await supabase.from("claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
  const ST: Record<string, [string, string]> = { open: [t("Envoyée"), "badge-warn"], in_progress: [t("En cours d'étude"), "badge-warn"], resolved: [t("Traitée"), "badge-ok"], rejected: [t("Refusée"), "badge-red"] };
  return (
    <>
      <PageHead kicker={t("ORGANISATION")} title={t("Faire une")} em={t("réclamation")}>{t("Un résultat contesté, un souci pendant un duel, un problème de remise ? Écris à l'organisation avec ton message et des preuves (liens vidéo ou image). La réponse apparaît sur cette page.")}</PageHead>
      <section className="py-14">
        <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="req-card"><div className="kicker mb-4">{t("NOUVELLE RÉCLAMATION")}</div><ClaimForm /></div>
          <div>
            <div className="kicker mb-4">{t("MES RÉCLAMATIONS")}</div>
            <div className="grid gap-4">
              {(data ?? []).map((c: Row) => (
                <article key={c.id} className="req-card">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase leading-tight">{c.title}</h2><span className={`badge ${ST[c.status][1]}`}>{ST[c.status][0]}</span></div>
                  <div className="font-cond mt-1 text-xs tracking-[.18em] text-metal">{dateTime(c.created_at, locale)}</div>
                  <p className="mt-3 whitespace-pre-line text-[15px] text-[#cfcfcf]">{c.message}</p>
                  {c.links?.length > 0 && <ul className="mt-3 grid gap-1">{c.links.map((l: string) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-red underline underline-offset-4 hover:text-white">{host(l)} ↗</a></li>)}</ul>}
                  {c.admin_reply && <div className="mt-4 border-t border-white/10 pt-3"><div className="label">{t("RÉPONSE DE L'ORGANISATION")}</div><p className="whitespace-pre-line text-[15px]">{c.admin_reply}</p></div>}
                </article>
              ))}
              {!data?.length && <p className="panel text-[#a5a9b0]">{t("Aucune réclamation pour le moment.")}</p>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
