"use client";
import { useT } from "@/components/LangProvider";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main className="flex min-h-screen items-center">
      <div className="wrap">
        <div className="kicker mb-3">{t("ERREUR SYSTÈME")}</div>
        <h1 className="h2">{t("Une")} <em>{t("panne")}</em> {t("sur la route")}</h1>
        <p className="mt-4 max-w-md text-[#a5a9b0]">{t("Quelque chose s'est mal passé de notre côté. Aucune donnée n'a été perdue. Réessaie dans un instant.")}</p>
        <button onClick={reset} className="btn btn-red mt-8">{t("RÉESSAYER")}</button>
      </div>
    </main>
  );
}
