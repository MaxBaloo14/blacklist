import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Flag, ShieldCheck, Swords, Trophy, UserPlus } from "lucide-react";
import PageHead from "@/components/PageHead";
import Reveal from "@/components/Reveal";
import { getPublicSettings } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Guide du pilote" };

export default async function Guide() {
  const [{ t }, settings] = await Promise.all([getI18n(), getPublicSettings()]);
  const s = (k: string, d: number) => Number(settings.find((x) => x.key === k)?.value ?? d);
  const hours = s("challenge_response_hours", 48), perWeek = s("challenges_per_week", 1), inactive = s("inactivity_days", 14);

  const steps = [
    { icon: UserPlus, title: t("Inscris-toi"), text: t("Crée ton compte avec ton numéro de téléphone et ton véhicule. Ton numéro sert d'identifiant de connexion."), href: "/register", cta: t("S'inscrire") },
    { icon: ShieldCheck, title: t("Attends l'homologation"), text: t("L'organisation valide ton inscription et homologue ton véhicule. Les véhicules de boutique et la catégorie Supersportives sont interdits. Tu es notifié à chaque étape.") },
    { icon: Flag, title: t("Gagne la Warm-up Race"), text: t("Chaque dimanche, une course d'entrée. Seul le vainqueur, après validation de l'organisation, débloque la position #10."), href: "/warmup", cta: t("Voir la Warm-up Race") },
    { icon: Swords, title: t("Défie le pilote au-dessus"), text: t("Depuis « Mes défis », clique sur le pilote juste au-dessus de toi. Un seul défi par semaine, jamais de saut de position."), href: "/challenges", cta: t("Mes défis") },
    { icon: CalendarClock, title: t("Fixez la date du duel"), text: t("Le pilote défié a {h} h pour fixer une date dans la semaine en cours. Vous recevez tous les deux une notification, et l'organisation suit le duel.", { h: hours }) },
    { icon: Trophy, title: t("Gagne, prends la place"), text: t("L'organisation saisit puis valide le résultat. Le vainqueur prend le rang et le Cash Prize du boss battu. Au podium, c'est le meilleur des 3 courses.") },
  ];

  const faq: [string, string][] = [
    [t("Pourquoi je ne peux pas défier ?"), t("Il faut : être dans la Blacklist, viser le pilote juste au-dessus, avoir un véhicule homologué, ne pas avoir déjà lancé {n} défi cette semaine, et qu'aucun défi ne soit en cours pour toi ou pour ta cible.", { n: perWeek })],
    [t("Que se passe-t-il si la date n'est pas fixée à temps ?"), t("L'organisation est alertée. Elle peut modifier la programmation, annuler le duel avec une justification, ou déclarer un forfait après vérification.")],
    [t("Qui valide les résultats ?"), t("Toujours un organisateur : un résultat n'est jamais officiel sans sa validation.")],
    [t("Que se passe-t-il si je perds au podium ?"), t("Un membre du Top 3 qui perd son duel cède sa position et perd définitivement son véhicule engagé. Il doit en enregistrer un nouveau et le faire homologuer.")],
    [t("Et si je ne cours plus ?"), t("Après {d} jours sans duel, une alerte est déclenchée. Une sanction éventuelle reste une décision de l'organisation, et les absences justifiées suspendent le décompte.", { d: inactive })],
    [t("J'ai oublié mon mot de passe"), t("Contacte l'organisation sur Discord : elle peut le réinitialiser pour toi.")],
  ];

  return (
    <>
      <PageHead kicker={t("PREMIÈRE VISITE ?")} title={t("Guide du pilote")}>{t("De l'inscription à ta première victoire : le parcours en 6 étapes.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          <ol className="grid gap-4 md:grid-cols-2">
            {steps.map((st, i) => (
              <Reveal key={st.title} delay={i * 0.05}>
                <li className="flex h-full gap-4 border border-white/10 bg-ink2 p-6">
                  <div className="shrink-0">
                    <div className="grid size-12 place-items-center bg-red/15 text-red"><st.icon size={24} strokeWidth={1.75} /></div>
                    <div className="font-display mt-2 text-center text-3xl leading-none text-red-dark">{i + 1}</div>
                  </div>
                  <div>
                    <h2 className="font-cond text-xl font-bold uppercase tracking-wide">{st.title}</h2>
                    <p className="mt-1.5 text-sm text-[#a5a9b0]">{st.text}</p>
                    {st.href && <Link href={st.href} className="font-cond mt-3 inline-block text-sm font-semibold tracking-[.18em] text-red hover:text-white">{st.cta} →</Link>}
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal className="mt-14">
            <div className="panel">
              <div className="kicker mb-4">{t("EXEMPLE")}</div>
              <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
                <div className="bg-ink p-5"><div className="label">{t("Toi")}</div><div className="font-display text-5xl text-red">#5</div></div>
                <div className="font-marker text-center text-2xl text-red">{t("défie")} →</div>
                <div className="bg-ink p-5"><div className="label">{t("Ta cible")}</div><div className="font-display text-5xl">#4</div></div>
              </div>
              <p className="mt-4 text-sm text-[#a5a9b0]">{t("Si tu gagnes, tu passes #4, l'ancien #4 devient #5, et tu remportes le Cash Prize du rang #4.")}</p>
            </div>
          </Reveal>

          <h2 className="h2 mb-6 mt-16">{t("Questions")} <em>{t("fréquentes")}</em></h2>
          <div className="grid gap-2">
            {faq.map(([q, a]) => (
              <details key={q} className="group border border-white/10 bg-ink2">
                <summary className="font-cond flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-bold uppercase tracking-wide marker:hidden hover:text-red">
                  {q}<span className="text-red transition group-open:rotate-45">+</span>
                </summary>
                <p className="border-t border-white/10 px-5 py-4 text-[15px] text-[#a5a9b0]">{a}</p>
              </details>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-metal">{t("Le détail complet est dans le")} <Link href="/rules" className="text-red hover:text-white">{t("Règlement")}</Link>.</p>
        </div>
      </section>
    </>
  );
}
