import ActionForm from "@/components/ActionForm";
import { AdminHead } from "@/components/AdminUI";
import Field from "@/components/Field";
import { deleteNews, saveNews, toggleNews } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewsAdmin() {
  const { t, locale } = await getI18n();
  const { supabase } = await requireAdmin();
  const { data: news } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  return (
    <>
      <AdminHead kicker={t("COMMUNICATION")} title={t("Actualités")}>{t("Les annonces publiées apparaissent sur la page d'accueil.")}</AdminHead>
      <ActionForm action={saveNews} label="ENREGISTRER" className="panel mb-10 max-w-3xl">
        <div className="kicker mb-3">{t("NOUVELLE ANNONCE")}</div>
        <div className="grid gap-3"><Field label={t("Titre")}><input name="title" required maxLength={120} className="input" /></Field><Field label={t("Texte")}><textarea name="body" required maxLength={4000} className="input min-h-32" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked className="accent-[#c62828]" /> {t("Publier immédiatement sur la page d'accueil")}</label></div>
      </ActionForm>
      <div className="grid gap-3">{news?.map((n) => (
        <article key={n.id} className="border border-white/10 bg-ink2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-2xl uppercase">{n.title}</h2><span className={`badge ${n.published ? "badge-ok" : "badge-metal"}`}>{n.published ? `${t("Publiée")} ${dateOnly(n.published_at, locale)}` : t("Brouillon")}</span></div>
          <p className="mt-2 whitespace-pre-line text-sm text-[#a5a9b0]">{n.body}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <ActionForm action={toggleNews} label={n.published ? "UNPUBLISH" : "PUBLISH"} small variant="dark" reset={false}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="publish" value={n.published ? "0" : "1"} /></ActionForm>
            <ActionForm action={deleteNews} label="SUPPRIMER" small variant="ghost" confirm="Supprimer cette annonce définitivement ?"><input type="hidden" name="id" value={n.id} /></ActionForm>
          </div>
        </article>
      ))}{!news?.length && <p className="panel text-[#a5a9b0]">{t("Aucune annonce.")}</p>}</div>
    </>
  );
}
