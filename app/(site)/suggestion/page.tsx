import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import RoutePreview from "@/components/RoutePreview";
import SuggestionForm from "@/components/SuggestionForm";
import { requireDriver } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Suggestion de course" };
export const dynamic = "force-dynamic";

export default async function Suggestion() {
  const [{ t, locale }, { supabase, user }] = await Promise.all([getI18n(), requireDriver()]);
  const { data } = await supabase.from("course_suggestions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  const ST: Record<string, [string, string]> = { pending: [t("En attente"), "badge-warn"], accepted: [t("Retenue"), "badge-ok"], declined: [t("Non retenue"), "badge-metal"] };
  return (
    <>
      <PageHead kicker={t("RÉSEAU DE COURSES")} title={t("Suggérer une")} em={t("course")}>{t("Trace ton parcours en rouge sur la carte : pose le départ, suis la route, termine à l'arrivée. L'organisation étudie chaque proposition et peut en faire un circuit officiel.")}</PageHead>
      <section className="py-14">
        <div className="wrap grid gap-12">
          <div className="req-card"><div className="kicker mb-4">{t("TRACER MA COURSE")}</div><SuggestionForm /></div>
          <div>
            <div className="kicker mb-4">{t("MES SUGGESTIONS")}</div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(data ?? []).map((s: Row) => (
                <article key={s.id} className="req-card !p-0">
                  <RoutePreview path={s.route_path} w={s.route_w} h={s.route_h} label={s.name} />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase leading-tight">{s.name}</h2><span className={`badge ${ST[s.status][1]}`}>{ST[s.status][0]}</span></div>
                    <div className="font-cond mt-1 text-xs tracking-[.18em] text-metal">{dateOnly(s.created_at, locale)}</div>
                    {s.description && <p className="mt-2 text-sm text-[#a5a9b0]">{s.description}</p>}
                    {s.admin_note && <p className="mt-3 border-t border-white/10 pt-3 text-sm"><span className="label">{t("RÉPONSE DE L'ORGANISATION")}</span><br />{s.admin_note}</p>}
                  </div>
                </article>
              ))}
              {!data?.length && <p className="panel text-[#a5a9b0] md:col-span-2">{t("Aucune suggestion pour le moment.")}</p>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
