import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import RoutePreview from "@/components/RoutePreview";
import { handleSuggestion } from "@/app/actions/admin";
import { createTrackFromSuggestion } from "@/app/actions/editor";
import { requireAdmin } from "@/lib/auth";
import { dateTime, fullName } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { getMapScale } from "@/lib/data";
import { routeKm } from "@/lib/plan-geom";
import type { Row } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SuggestionsAdmin() {
  const [{ t, locale }, { supabase }] = await Promise.all([getI18n(), requireAdmin()]);
  const scale = await getMapScale();
  const { data: vts } = await supabase.from("suggestion_votes").select("suggestion_id");
  const votes = new Map<string, number>(); for (const v of vts ?? []) votes.set(v.suggestion_id, (votes.get(v.suggestion_id) ?? 0) + 1);
  const [{ data: list }, { data: people }] = await Promise.all([
    supabase.from("course_suggestions").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,first_name,last_name"),
  ]);
  const who = new Map<string, Row>((people ?? []).map((p: Row) => [p.id, p]));
  const ST: Record<string, [string, string]> = { pending: [t("En attente"), "badge-warn"], accepted: [t("Retenue"), "badge-ok"], declined: [t("Non retenue"), "badge-metal"] };
  const todo = (list ?? []).filter((s: Row) => s.status === "pending").sort((a: Row, b: Row) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0));
  const done = (list ?? []).filter((s: Row) => s.status !== "pending");
  const card = (s: Row) => (
    <article key={s.id} className="border border-white/10 bg-ink2">
      <RoutePreview path={s.route_path} w={s.route_w} h={s.route_h} label={s.name} />
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl uppercase leading-tight">{s.name}</h2><span className={`badge ${ST[s.status][1]}`}>{ST[s.status][0]}</span></div>
        <div className="text-sm text-[#a5a9b0]">{fullName(who.get(s.user_id))} · {dateTime(s.created_at, locale)} · ≈ {routeKm(s.route_path, scale).toFixed(1).replace(".", ",")} km · <b data-votes className="text-white">{t("{n} vote(s)", { n: votes.get(s.id) ?? 0 })}</b></div>
        {s.description && <p className="mt-2 text-[15px]">{s.description}</p>}
        {s.admin_note && <p className="mt-2 text-sm text-[#a5a9b0]">{t("Réponse envoyée")} : {s.admin_note}</p>}
        {s.status === "pending" ? (
          <div className="mt-4 grid gap-3">
            <ActionForm action={createTrackFromSuggestion} label="RETENIR ET CRÉER LE CIRCUIT" confirm="Créer le circuit officiel à partir de ce tracé ? Le plan et la voiture animée seront publiés et le pilote sera prévenu." className="grid gap-2">
              <input type="hidden" name="suggestion" value={s.id} />
              <input name="name" defaultValue={s.name} maxLength={80} aria-label={t("Nom du circuit")} className="input" />
              <div className="grid grid-cols-2 gap-2">
                <select name="race_type" defaultValue="Sprint urbain" aria-label={t("Type")} className="input"><option>Sprint urbain</option><option>Circuit</option><option>Last Race</option><option>Warm-up</option></select>
                <select name="difficulty" defaultValue="Medium" aria-label={t("Difficulté")} className="input"><option value="Easy">{t("Facile")}</option><option value="Medium">{t("Moyen")}</option><option value="Hard">{t("Difficile")}</option><option value="Extreme">{t("Extrême")}</option></select>
              </div>
              <input name="note" maxLength={1000} placeholder={t("Message pour le pilote (facultatif)")} className="input" />
            </ActionForm>
            <details className="text-sm"><summary className="cursor-pointer font-cond font-bold tracking-[.14em] text-red">{t("REFUSER")}</summary>
              <ActionForm action={handleSuggestion} label="REFUSER" variant="ghost" small confirm="Refuser cette suggestion ?" className="mt-2 grid gap-2">
                <input type="hidden" name="suggestion" value={s.id} /><input type="hidden" name="status" value="declined" />
                <input name="note" maxLength={1000} placeholder={t("Motif (visible du pilote)")} className="input" />
              </ActionForm>
            </details>
          </div>
        ) : null}
      </div>
    </article>
  );
  return (
    <>
      <AdminHead kicker={t("RÉSEAU DE COURSES")} title={t("Suggestions de course")}>{t("Les parcours tracés en rouge par les pilotes sur la carte. Retiens ou refuse : le pilote est prévenu. Une suggestion retenue sert de base pour créer un circuit officiel.")}</AdminHead>
      <div className="kicker mb-3">{t("EN ATTENTE")} ({todo.length})</div>
      <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{todo.map(card)}{!todo.length && <p className="panel text-[#a5a9b0] md:col-span-2">{t("Aucune suggestion en attente.")}</p>}</div>
      {done.length > 0 && <><div className="kicker mb-3">{t("DÉJÀ TRAITÉES")}</div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{done.map(card)}</div></>}
    </>
  );
}
