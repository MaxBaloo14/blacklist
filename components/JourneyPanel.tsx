import Link from "next/link";
import { Check } from "lucide-react";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

type Step = { title: string; detail: string; state: "done" | "current" | "todo"; href?: string; cta?: string };

/** « Ton parcours » : où en est le pilote et quelle est la prochaine étape. Se calcule à partir des vraies données du compte. */
export default async function JourneyPanel({ profile, current, pending, myPos, active, nextWarmup }: { profile: Row; current?: Row; pending?: Row; myPos: number | null; active?: Row | null; nextWarmup?: Row | null }) {
  const { t, locale } = await getI18n();
  const regOk = profile.registration_status === "validated";
  const rejected = profile.registration_status === "rejected";
  const carOk = Boolean(current);

  const steps: Step[] = [
    {
      title: t("Inscription validée"),
      detail: regOk ? t("Ton dossier est validé par l'organisation.") : rejected ? t("Ton inscription a été refusée : consulte la note de l'organisation ci-dessous.") : t("L'organisation examine ton dossier. Tu seras notifié."),
      state: regOk ? "done" : "current",
    },
    {
      title: t("Véhicule homologué"),
      detail: carOk ? t("{n} est engagé et homologué.", { n: current!.make_model }) : pending ? t("Ton véhicule est en attente d'homologation.") : t("Enregistre un véhicule dans ton Garage."),
      state: carOk ? "done" : regOk ? "current" : "todo",
      href: carOk || pending ? undefined : "/profile?tab=garage", cta: t("Aller au Garage"),
    },
    {
      title: t("Entrer dans la Blacklist"),
      detail: myPos ? t("Tu es #{n} de la Blacklist.", { n: myPos })
        : nextWarmup ? t("Gagne la Warm-up Race : prochaine édition le {d}.", { d: dateTime(nextWarmup.scheduled_at, locale) })
        : t("Gagne la Warm-up Race du dimanche pour viser la position #10."),
      state: myPos ? "done" : regOk && carOk ? "current" : "todo",
      href: myPos ? undefined : "/warmup", cta: t("Voir la Warm-up Race"),
    },
    {
      title: t("Lancer ton premier défi"),
      detail: !myPos ? t("Disponible dès que tu es dans la Blacklist.")
        : myPos === 1 ? t("Tu es #1 : défends ta couronne.")
        : active ? t("Un défi est en cours : suis-le dans Mes défis.")
        : t("Défie le #{n}, le pilote juste au-dessus de toi.", { n: myPos - 1 }),
      state: myPos && myPos > 1 ? "current" : "todo",
      href: myPos ? "/challenges" : undefined, cta: active ? t("Voir mon défi") : t("Défier"),
    },
  ];

  return (
    <section className="panel" aria-label={t("Ton parcours")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="kicker">{t("TON PARCOURS")}</div>
        <Link href="/guide" className="font-cond text-xs font-semibold tracking-[.2em] text-metal hover:text-white">{t("GUIDE DU PILOTE")} →</Link>
      </div>
      <ol className="grid gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex gap-4 border p-4 ${s.state === "current" ? "border-red bg-[#1a1114]" : "border-white/[.07] bg-ink"}`}>
            <span className={`grid size-8 shrink-0 place-items-center font-display text-lg ${s.state === "done" ? "bg-ok/20 text-ok" : s.state === "current" ? "bg-red text-white" : "bg-white/5 text-metal"}`}>
              {s.state === "done" ? <Check size={18} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-cond text-lg font-bold uppercase tracking-wide ${s.state === "todo" ? "text-metal" : ""}`}>{s.title}</div>
              <p className="text-sm text-[#a5a9b0]">{s.detail}</p>
              {s.state === "current" && s.href && <Link href={s.href} className="btn btn-red btn-sm mt-3">{s.cta}</Link>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
