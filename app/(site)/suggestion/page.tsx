import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import RoutePreview from "@/components/RoutePreview";
import ActionForm from "@/components/ActionForm";
import SuggestionForm from "@/components/SuggestionForm";
import { voteSuggestion } from "@/app/actions/requests";
import { getMapScale } from "@/lib/data";
import { routeKm } from "@/lib/plan-geom";
import { requireDriver } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Suggestion de course" };
export const dynamic = "force-dynamic";

export default async function Suggestion() {
  const [{ t, locale }, { supabase, user }] = await Promise.all([getI18n(), requireDriver()]);
  const scale = await getMapScale();
  const { data: board } = await supabase.from("suggestion_board").select("*").order("votes", { ascending: false }).order("created_at", { ascending: false }).limit(60);
  const votesOf = new Map<string, number>((board ?? []).map((b: Row) => [b.id, b.votes]));
  const others = (board ?? []).filter((b: Row) => !b.mine);
  const km = (d: string) => routeKm(d, scale).toFixed(1).replace(".", ",");
  const { data } = await supabase.from("course_suggestions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  const ST: Record<string, [string, string]> = { pending: [t("En attente"), "badge-warn"], accepted: [t("Retenue"), "badge-ok"], declined: [t("Non retenue"), "badge-metal"] };
  return (
    <>
      <PageHead kicker={t("RÉSEAU DE COURSES")} title={t("Suggérer une")} em={t("course")}>{t("Trace ton parcours en rouge sur la carte : pose le départ, suis la route, termine à l'arrivée. L'organisation étudie chaque proposition et peut en faire un circuit officiel.")}</PageHead>
      <section className="py-14">
        <div className="wrap grid gap-12">
          <div className="req-card"><div className="kicker mb-4">{t("TRACER MA COURSE")}</div><SuggestionForm mPerPx={scale} /></div>
          <div>
            <div className="kicker mb-1">{t("VOTE DES PILOTES")}</div>
            <p className="mb-4 max-w-3xl text-sm text-[#a5a9b0]">{t("Les parcours proposés par les autres pilotes. Vote pour ceux que tu aimerais voir devenir des circuits officiels : l'organisation en tient compte pour choisir. Un vote par suggestion, modifiable à tout moment.")}</p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {others.map((b: Row) => (
                <article key={b.id} className="req-card !p-0">
                  <RoutePreview path={b.route_path} w={b.route_w} h={b.route_h} label={b.name} />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase leading-tight">{b.name}</h2><span className="badge badge-warn" data-votes>{t("{n} vote(s)", { n: b.votes })}</span></div>
                    <div className="font-cond mt-1 text-xs tracking-[.18em] text-metal">{b.first_name} {b.last_name} · ≈ {km(b.route_path)} km · {dateOnly(b.created_at, locale)}</div>
                    {b.description && <p className="mt-2 text-sm text-[#a5a9b0]">{b.description}</p>}
                    <ActionForm action={voteSuggestion} label={b.voted ? "RETIRER MON VOTE" : "VOTER POUR CETTE COURSE"} small variant={b.voted ? "ghost" : "red"} reset={false} className="mt-4 [&>div]:mt-2"><input type="hidden" name="suggestion" value={b.id} /></ActionForm>
                  </div>
                </article>
              ))}
              {!others.length && <p className="panel text-[#a5a9b0] md:col-span-2">{t("Aucune suggestion des autres pilotes à voter pour le moment.")}</p>}
            </div>
          </div>
          <div>
            <div className="kicker mb-4">{t("MES SUGGESTIONS")}</div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(data ?? []).map((s: Row) => (
                <article key={s.id} className="req-card !p-0">
                  <RoutePreview path={s.route_path} w={s.route_w} h={s.route_h} label={s.name} />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase leading-tight">{s.name}</h2><span className={`badge ${ST[s.status][1]}`}>{ST[s.status][0]}</span></div>
                    <div className="font-cond mt-1 text-xs tracking-[.18em] text-metal">{dateOnly(s.created_at, locale)} · ≈ {km(s.route_path)} km{s.status === "pending" ? ` · ${t("{n} vote(s)", { n: votesOf.get(s.id) ?? 0 })}` : ""}</div>
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
