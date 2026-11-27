import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { getPublicSettings } from "@/lib/data";
import { money } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Règlement" };

const DEFAULT_REWARDS: Record<string, number> = { "1": 2000000, "2": 1500000, "3": 1000000, "4": 800000, "5": 700000, "6": 500000, "7": 400000, "8": 300000, "9": 250000, "10": 200000 };

export default async function RulesPage() {
  const [{ t, locale }, settings] = await Promise.all([getI18n(), getPublicSettings()]);
  const s = (k: string, d: number) => Number(settings.find((x) => x.key === k)?.value ?? d);
  const hours = s("challenge_response_hours", 48), inactive = s("inactivity_days", 14), perWeek = s("challenges_per_week", 1), warmupZ = s("warmup_participation_zigollars", 500), duelZ = s("duel_win_zigollars", 2500), sugZ = s("suggestion_reward_zigollars", 5000);
  const rewards: Record<string, number> = settings.find((x) => x.key === "rewards")?.value ?? DEFAULT_REWARDS;

  const steps = [
    [t("S'INSCRIRE"), t("Engage ton véhicule. Il doit être homologué par l'organisation avant de rouler.")],
    ["WARM-UP RACE", t("Chaque dimanche, une course d'entrée. Seul le vainqueur, après validation de l'organisation, débloque la position #10.")],
    [t("DÉFIER"), t("Tu ne peux défier que le pilote juste au-dessus de toi, sans sauter de position.")],
    [t("PRENDRE LA PLACE"), t("Le vainqueur prend le rang et le Cash Prize du boss battu.")],
  ];
  const rules: [string, string[]][] = [
    [t("Véhicules"), [t("Véhicules de boutique interdits"), t("Catégorie Supersportives interdite"), t("Un seul véhicule officiel par pilote"), t("Véhicule non homologué = aucune course")]],
    [t("Défis"), [t("{n} défi par semaine et par challenger", { n: perWeek }), t("Le pilote défié a {h} h pour fixer une date dans la semaine en cours", { h: hours }), t("Le challenger propose 3 créneaux entre 21 h et minuit (heure de Paris) : seul le pilote défié en choisit un"), t("Date non fixée à temps : l'organisation est alertée"), t("Absence injustifiée : forfait possible, après vérification de l'organisation")]],
    [t("Duel standard"), [t("Hors Top 3 : une seule course en 1 contre 1, sur la carte choisie par le pilote défié une fois la date validée"), t("Le gagnant prend la position du perdant"), t("Le perdant descend d'un rang")]],
    [t("Duel du podium (#3, #2, #1)"), [t("Course 1 : carte choisie par le challenger"), t("Course 2 : carte choisie par le pilote défié"), t("Course 3 : carte tirée au sort parmi les cartes actives (elle peut être l'une des deux déjà choisies)"), t("Les cartes se choisissent une fois la date du duel validée"), t("Le premier à 2 victoires remporte le duel")]],
    [t("Perte du véhicule"), [t("Un membre du Top 3 qui perd son duel cède sa position"), t("Il perd définitivement son véhicule engagé"), t("Il doit en enregistrer un nouveau et le faire homologuer")]],
    [t("Zigollars et boutique"), [t("Chaque pilote reçoit 10 000 zigollars à l'inscription : ils sont verrouillés et ne se dépensent qu'à partir de son premier gain (victoire en duel, participation à une Warm-up Race…)"), t("{n} zigollars offerts à chaque participant d'une Warm-up Race, une fois le résultat validé", { n: warmupZ }), t("{n} zigollars offerts au vainqueur de chaque duel disputé, une fois le résultat validé (pas pour un forfait)", { n: duelZ }), t("{n} zigollars offerts à l'auteur d'une suggestion de course retenue (circuit officiel)", { n: sugZ }), t("Les zigollars se dépensent dans la boutique : les articles sont remis en jeu par l'organisation"), t("Une commande annulée par l'organisation est remboursée en zigollars"), t("Les zigollars sont une monnaie du site : ils n'ont aucune valeur réelle et ne sont pas convertibles en argent")]],
    [t("Paris sur les duels"), [t("Mise de 500 à 50 000 zigollars, par montants ronds (multiples de 500), sur un duel programmé"), t("La cote est figée au moment du pari ; le gain est mise × cote"), t("Le gain est versé uniquement quand l'organisation valide le résultat ; un duel annulé rembourse la mise"), t("Un pilote ne peut pas parier sur son propre duel, ni parier deux fois sur le même duel"), t("Un classement des meilleurs parieurs est affiché dans le Hall of Fame")]],
    [t("Réclamations et suggestions"), [t("Une réclamation (titre, message, jusqu'à 5 liens vidéo ou image) s'envoie depuis l'onglet Réclamation ; la réponse de l'organisation s'affiche sur la même page"), t("Les abus (réclamations répétées sans fondement, fausses preuves) peuvent être sanctionnés"), t("Tout pilote peut suggérer une course en traçant son parcours sur la carte (60 points de passage au maximum) ; les autres pilotes peuvent voter"), t("L'organisation décide seule de faire d'une suggestion un circuit officiel")]],
    [t("Inactivité"), [t("Après {d} jours sans duel : alerte et décompte affiché", { d: inactive }), t("Sanctions possibles : perte de deux positions, retrait, remplacement par un réserviste"), t("Toute sanction est une décision de l'organisation")]],
  ];

  return (
    <>
      <PageHead kicker={t("LE RÈGLEMENT")} title={t("Les règles")} em={t("du jeu")}>{t("Tout ce qu'il faut savoir pour entrer dans la Blacklist, défier un pilote et prendre sa place.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          <p className="mb-8 text-sm text-metal">{t("Nouveau ?")} <Link href="/guide" className="text-red hover:text-white">{t("Lis le guide du pilote")} →</Link> · <Link href="/vehicles" data-veh-link className="text-red hover:text-white">{t("Voir la liste des véhicules autorisés")} →</Link></p>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, text], i) => (
              <div key={title} className="flex gap-4">
                <span className="font-display text-5xl leading-none text-red-dark">{i + 1}</span>
                <div><h2 className="font-cond text-lg font-bold uppercase tracking-[.12em]">{title}</h2><p className="mt-1 text-sm text-[#a5a9b0]">{text}</p></div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            {rules.map(([title, items]) => (
              <section key={title} className="panel">
                <h2 className="kicker mb-3">{title}</h2>
                <ul className="space-y-2 text-[15px] text-[#cfcfcf]">
                  {items.map((x) => <li key={x} className="before:mr-2.5 before:inline-block before:size-1.5 before:rotate-45 before:bg-red">{x}</li>)}
                </ul>
              </section>
            ))}
          </div>

          <h2 className="h2 mb-6 mt-20">Cash <em>Prize</em></h2>
          <p className="mb-5 max-w-2xl text-sm text-[#a5a9b0]">{t("Le montant correspond au rang du boss battu. Le site ne réalise aucun transfert d'argent : il suit uniquement les versements effectués par l'organisation.")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => String(10 - i)).map((rank) => (
              <div key={rank} className="bg-ink2 px-4 py-3">
                <div className="font-display text-3xl text-red">#{rank}</div>
                <div className="font-cond text-lg font-bold tracking-wide">{money(rewards[rank], locale)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
