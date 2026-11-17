"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center">
      <div className="wrap">
        <div className="kicker mb-3">SYSTEM ERROR</div>
        <h1 className="h2">Une <em>panne</em> sur la route</h1>
        <p className="mt-4 max-w-md text-[#a5a9b0]">Quelque chose s&apos;est mal passé de notre côté. Aucune donnée n&apos;a été perdue. Réessaie dans un instant.</p>
        <button onClick={reset} className="btn btn-red mt-8">RETRY</button>
      </div>
    </main>
  );
}
