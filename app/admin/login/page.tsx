import type { Metadata } from "next";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import { adminLogin } from "@/app/actions/auth";

export const metadata: Metadata = { title: "BBC Control Center" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="relative grid min-h-screen place-items-center px-5">
      <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-20" style={{ backgroundImage: "url(/img/hero.webp)" }} />
      <div className="absolute inset-0 -z-10 bg-ink/80" />
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="kicker mb-2">RESTRICTED ACCESS</div>
          <h1 className="font-display text-5xl uppercase">BBC <span className="text-red">Control Center</span></h1>
          <p className="mt-2 text-sm text-metal">Accès réservé aux organisateurs autorisés. Les comptes pilotes n&apos;ont aucun accès ici.</p>
        </div>
        {sp.error === "forbidden" && <p className="badge badge-red mb-4 !normal-case">Ce compte n&apos;a pas les privilèges d&apos;organisateur.</p>}
        <ActionForm action={adminLogin} label="ENTER" reset={false} className="panel">
          <div className="grid gap-4">
            <Field label="Email organisateur"><input name="email" type="email" required autoComplete="username" className="input" /></Field>
            <Field label="Mot de passe"><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
