import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import { login } from "@/app/actions/auth";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; registered?: string; error?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getT()]);
  return (
    <>
      <PageHead kicker={t("ACCÈS PILOTE")} title={t("Connexion")} em={t("pilote")} />
      <section className="py-14">
        <div className="wrap max-w-xl">
          {sp.registered && <p className="badge badge-ok mb-4 !normal-case">{t("Inscription enregistrée. Connecte-toi pour suivre ton homologation.")}</p>}
          {sp.error === "banned" && <p className="badge badge-red mb-4 !normal-case">{t("Ce compte a été banni.")}</p>}
          <ActionForm action={login} label="SE CONNECTER" reset={false} className="panel">
            <input type="hidden" name="next" value={sp.next ?? ""} />
            <div className="grid gap-4">
              <Field label={t("Numéro de téléphone")}><input name="phone" type="tel" required autoComplete="username" className="input" /></Field>
              <Field label={t("Mot de passe")}><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
            </div>
          </ActionForm>
          <p className="mt-5 text-sm text-metal">{t("Pas encore de compte ?")} <Link href="/register" className="text-red hover:text-white">{t("Rejoins la Blacklist")}</Link></p>
          <p className="mt-2 text-xs text-metal">{t("Mot de passe oublié ? Contacte l'organisation sur Discord : elle peut le réinitialiser.")}</p>
        </div>
      </section>
    </>
  );
}
