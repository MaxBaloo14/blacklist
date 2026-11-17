import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import Field from "@/components/Field";
import PageHead from "@/components/PageHead";
import { login } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; registered?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHead kicker="DRIVER ACCESS" title="Login" em="pilote" />
      <section className="py-14">
        <div className="wrap max-w-xl">
          {sp.registered && <p className="badge badge-ok mb-4 !normal-case">Inscription enregistrée. Connecte-toi pour suivre ton homologation.</p>}
          {sp.error === "banned" && <p className="badge badge-red mb-4 !normal-case">Ce compte a été banni.</p>}
          <ActionForm action={login} label="LOGIN" reset={false} className="panel">
            <input type="hidden" name="next" value={sp.next ?? ""} />
            <div className="grid gap-4">
              <Field label="Email"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
              <Field label="Mot de passe"><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
            </div>
          </ActionForm>
          <p className="mt-5 text-sm text-metal">Pas encore de compte ? <Link href="/register" className="text-red hover:text-white">Rejoins la Blacklist</Link></p>
        </div>
      </section>
    </>
  );
}
