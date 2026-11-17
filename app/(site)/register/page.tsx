import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import { register } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";
import { getPublicSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  const { user, profile } = await getSession();
  if (user && profile) redirect("/profile");
  const settings = await getPublicSettings();
  const all: string[] = settings.find((s) => s.key === "vehicle_classes")?.value ?? [];
  const forbidden: string[] = settings.find((s) => s.key === "forbidden_vehicle_classes")?.value ?? [];
  const classes = all.filter((c) => !forbidden.includes(c));

  return (
    <>
      <PageHead kicker="JOIN THE BLACKLIST" title="Register" em="your ride">Crée ton compte pilote et engage ton véhicule. Il devra être homologué par l&apos;organisation avant ta première course.</PageHead>
      <section className="py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <ActionForm action={register} label="SUBMIT REGISTRATION" confirm="Ton inscription et ton véhicule seront soumis à l'organisation pour validation. Continuer ?" reset={false} className="panel">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-0 opacity-0" />
            <div className="kicker mb-4">PILOTE</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom"><input name="last_name" required maxLength={60} autoComplete="family-name" className="input" /></Field>
              <Field label="Prénom"><input name="first_name" required maxLength={60} autoComplete="given-name" className="input" /></Field>
              <Field label="Numéro de téléphone"><input name="phone" required type="tel" maxLength={30} autoComplete="tel" className="input" /></Field>
              <Field label="Pseudo Discord" hint="Pour les communications avec l'organisation."><input name="discord_tag" required maxLength={40} className="input" /></Field>
              <Field label="Email (connexion)"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
              <Field label="Mot de passe" hint="10 caractères minimum."><input name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="input" /></Field>
            </div>
            <div className="kicker mb-4 mt-8">VÉHICULE ENGAGÉ</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marque et modèle"><input name="make_model" required maxLength={80} placeholder="ex. Marque Modèle" className="input" /></Field>
              <Field label="Catégorie">
                <select name="vehicle_class" required defaultValue="" className="input">
                  <option value="" disabled>Choisir…</option>
                  {classes.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <fieldset className="sm:col-span-2">
                <legend className="label">Véhicule issu de la boutique ?</legend>
                <div className="flex gap-6 text-[15px]">
                  <label className="flex items-center gap-2"><input type="radio" name="shop" value="no" required className="accent-[#c62828]" /> Non</label>
                  <label className="flex items-center gap-2"><input type="radio" name="shop" value="yes" className="accent-[#c62828]" /> Oui</label>
                </div>
              </fieldset>
              <Field label="Photographie du véhicule" hint="JPEG, PNG ou WebP — 5 Mo max. Plaque et véhicule bien visibles." className="sm:col-span-2">
                <input name="photo" type="file" required accept="image/jpeg,image/png,image/webp" className="input file:mr-4 file:border-0 file:bg-red file:px-4 file:py-1.5 file:font-cond file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white" />
              </Field>
            </div>
          </ActionForm>

          <aside className="grid content-start gap-4">
            <div className="panel">
              <div className="kicker mb-3">RÈGLES D&apos;HOMOLOGATION</div>
              <ul className="font-cond space-y-2.5 text-[17px] tracking-wide text-[#cfcfcf]">
                <li className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">Véhicules de boutique interdits</li>
                <li className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">Catégorie Supersportives interdite</li>
                <li className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">Un seul véhicule officiel par pilote</li>
                <li className="before:mr-2.5 before:inline-block before:size-2 before:rotate-45 before:bg-red">Véhicule non homologué = aucune course</li>
              </ul>
            </div>
            <div className="panel">
              <div className="kicker mb-3">ET ENSUITE ?</div>
              <ol className="space-y-3 text-sm text-[#a5a9b0]">
                <li><b className="text-bone">1.</b> L&apos;organisation examine ton dossier et ta photo.</li>
                <li><b className="text-bone">2.</b> Statut : <span className="badge badge-warn">Pending Approval</span> → <span className="badge badge-ok">Approved</span> ou <span className="badge badge-red">Rejected</span> avec motif.</li>
                <li><b className="text-bone">3.</b> Participe à la Warm-up Race du dimanche pour viser la position #10.</li>
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
