import type { Metadata } from "next";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import LangSwitch from "@/components/LangSwitch";
import { adminLogin } from "@/app/actions/auth";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { title: "BBC Control Center" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getT()]);
  return (
    <main className="relative grid min-h-screen place-items-center px-5">
      <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-20" style={{ backgroundImage: "url(/img/hero-1600.webp)" }} />
      <div className="absolute inset-0 -z-10 bg-ink/80" />
      <div className="absolute right-4 top-4"><LangSwitch /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="kicker mb-2">{t("ACCÈS RESTREINT")}</div>
          <h1 className="font-display text-5xl uppercase">BBC <span className="text-red">Control Center</span></h1>
          <p className="mt-2 text-sm text-metal">{t("Accès réservé aux organisateurs autorisés. Les comptes pilotes n'ont aucun accès ici.")}</p>
        </div>
        {sp.error === "forbidden" && <p className="badge badge-red mb-4 !normal-case">{t("Ce compte n'a pas les privilèges d'organisateur.")}</p>}
        <ActionForm action={adminLogin} label="ENTRER" reset={false} className="panel">
          <div className="grid gap-4">
            <Field label={t("Email organisateur")}><input name="email" type="email" required autoComplete="username" className="input" /></Field>
            <Field label={t("Mot de passe")}><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
