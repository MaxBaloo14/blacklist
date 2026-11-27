import type { Metadata } from "next";
import Link from "next/link";
import { CarFront } from "lucide-react";
import vehicleData from "@/data/vehicles.json";
import { redirect } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import { register } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";
import { getPublicSettings } from "@/lib/data";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { title: "Inscription" };

const vehicleCount = vehicleData.vehicles.length;

export default async function RegisterPage() {
  const [{ user, profile }, settings, t] = await Promise.all([getSession(), getPublicSettings(), getT()]);
  if (user && profile) redirect("/profile");
  const all: string[] = settings.find((s) => s.key === "vehicle_classes")?.value ?? [];
  const forbidden: string[] = settings.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? [];
  const classes = all.filter((c) => !forbidden.includes(c));

  return (
    <>
      <PageHead kicker={t("REJOINS LA BLACKLIST")} title={t("Inscris")} em={t("ton bolide")}>{t("Crée ton compte pilote et engage ton véhicule. Il devra être homologué par l'organisation avant ta première course.")}</PageHead>
      <section className="py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <ActionForm action={register} label="ENVOYER L'INSCRIPTION" confirm="Ton inscription et ton véhicule seront soumis à l'organisation pour validation. Continuer ?" reset={false} className="panel">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-0 opacity-0" />
            <div className="kicker mb-4">{t("PILOTE")}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Nom")}><input name="last_name" required maxLength={60} autoComplete="family-name" className="input" /></Field>
              <Field label={t("Prénom")}><input name="first_name" required maxLength={60} autoComplete="given-name" className="input" /></Field>
              <Field label={t("Numéro de téléphone")} hint={t("C'est ton identifiant de connexion.")}><input name="phone" required type="tel" maxLength={30} autoComplete="tel" className="input" /></Field>
              <Field label={t("Mot de passe")} hint={t("10 caractères minimum.")} className="sm:col-span-2"><input name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="input" /></Field>
            </div>
            <div className="kicker mb-1 mt-8">{t("VÉHICULE ENGAGÉ")}</div>
            <p className="mb-4 text-sm text-metal"><Link href="/vehicles" target="_blank" data-veh-link className="text-red hover:text-white">{t("Voir la liste des véhicules autorisés")} →</Link></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Marque et modèle")}><input name="make_model" required maxLength={80} placeholder={t("ex. Marque Modèle")} className="input" /></Field>
              <Field label={t("Catégorie")}>
                <select name="vehicle_class" required defaultValue="" className="input">
                  <option value="" disabled>{t("Choisir…")}</option>
                  {classes.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                </select>
              </Field>
            </div>
          </ActionForm>

          <aside className="grid content-start gap-4">
            <div className="panel">
              <div className="kicker mb-3">{t("RÈGLES D'HOMOLOGATION")}</div>
              <ul className="font-cond space-y-2.5 text-[17px] tracking-wide text-[#cfcfcf]">
                {[t("Véhicules de boutique interdits"), t("Catégorie Supersportives interdite"), t("Un seul véhicule officiel par pilote"), t("Véhicule non homologué = aucune course")].map((x) => (
                  <li key={x} className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">{x}</li>
                ))}
              </ul>
            </div>
            <Link href="/vehicles" target="_blank" data-veh-shortcut className="rules-card rules-card-sm group flex items-center gap-4">
              <span className="rules-card-icon" aria-hidden><CarFront size={26} strokeWidth={1.5} /></span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-2xl uppercase leading-tight">{t("Liste des véhicules autorisés")}</span>
                <span className="mt-0.5 block text-sm text-[#a5a9b0]">{t("{n} véhicules à consulter avant de t'inscrire. Les véhicules de boutique sont interdits.", { n: vehicleCount })}</span>
              </span>
              <span className="font-cond text-lg text-red transition-transform group-hover:translate-x-1" aria-hidden>→</span>
            </Link>
            <div className="panel">
              <div className="kicker mb-3">{t("ET ENSUITE ?")}</div>
              <ol className="space-y-3 text-sm text-[#a5a9b0]">
                <li><b className="text-bone">1.</b> {t("L'organisation examine ton dossier.")}</li>
                <li><b className="text-bone">2.</b> {t("Statut")} : <span className="badge badge-warn">{t("En attente d'homologation")}</span> → <span className="badge badge-ok">{t("Homologué")}</span> {t("ou")} <span className="badge badge-red">{t("Refusé")}</span> {t("avec motif.")}</li>
                <li><b className="text-bone">3.</b> {t("Participe à la Warm-up Race du dimanche pour viser la position #10.")}</li>
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
