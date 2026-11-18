import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { AdminHead } from "@/components/AdminUI";
import { saveTemplate, deleteTemplate } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [t, { supabase }] = await Promise.all([getT(), requireAdmin()]);
  const { data } = await supabase.from("message_templates").select("*").order("kind").order("title");
  const KINDS: [string, string][] = [["registration", t("Inscription")], ["vehicle", t("Véhicule")], ["duel", t("Duel (annulation, forfait)")]];
  return (
    <>
      <AdminHead kicker={t("COMMUNICATION")} title={t("Modèles de messages")}>{t("Motifs prêts à l'emploi pour refuser un dossier, un véhicule ou annuler un duel. Ils s'insèrent d'un clic dans le champ « motif » et restent modifiables.")}</AdminHead>
      <div className="grid gap-8 xl:grid-cols-[1fr_1.4fr]">
        <ActionForm action={saveTemplate} label="AJOUTER LE MODÈLE" className="panel h-fit">
          <div className="kicker mb-4">{t("NOUVEAU MODÈLE")}</div>
          <div className="grid gap-4">
            <Field label={t("Utilisé pour")}><select name="kind" className="input">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label={t("Titre (court)")}><input name="title" required minLength={2} maxLength={80} className="input" /></Field>
            <Field label={t("Texte envoyé au pilote")} hint={t("300 caractères maximum.")}><textarea name="body" required minLength={3} maxLength={300} className="input" /></Field>
          </div>
        </ActionForm>
        <div className="grid content-start gap-6">
          {KINDS.map(([kind, label]) => (
            <section key={kind}>
              <h2 className="font-cond mb-3 text-lg font-bold uppercase tracking-[.18em]">{label}</h2>
              <div className="grid gap-2">
                {(data ?? []).filter((x) => x.kind === kind).map((x) => (
                  <article key={x.id} className="flex items-start justify-between gap-4 border-l-[3px] border-red-dark bg-ink2 px-4 py-3">
                    <div className="min-w-0"><div className="font-cond text-lg font-bold tracking-wide">{x.title}</div><p className="text-sm text-[#a5a9b0]">{x.body}</p></div>
                    <ActionForm action={deleteTemplate} label="SUPPRIMER" variant="ghost" small confirm="Supprimer ce modèle ?" className="shrink-0"><input type="hidden" name="id" value={x.id} /></ActionForm>
                  </article>
                ))}
                {!(data ?? []).some((x) => x.kind === kind) && <p className="panel-flat text-sm text-metal">{t("Aucun modèle.")}</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
