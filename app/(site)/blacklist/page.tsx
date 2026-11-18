import type { Metadata } from "next";
import BlacklistBoard from "@/components/BlacklistBoard";
import DuelCard from "@/components/DuelCard";
import PageHead from "@/components/PageHead";
import { getBlacklistLive, getLatestDuels, getRewards } from "@/lib/data";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = { title: "The Blacklist" };

// Duel d'exemple fixe, affiché en permanence pour montrer à quoi ressemble une confrontation (ce n'est pas un vrai duel).
const EXAMPLE_DUEL = { id: "example", status: "completed", is_podium: false, challenger_position: 5, defender_position: 4, challenger_first: "Coby", challenger_last: "", defender_first: "Oby", defender_last: "", challenger_id: "c", defender_id: "d", winner_id: "c", challenger_wins: 1, champion_wins: 0, scheduled_at: null, clip_url: null };

export default async function BlacklistPage() {
  const [t, list, rewards, duels] = await Promise.all([getT(), getBlacklistLive(), getRewards(), getLatestDuels(6)]);
  return (
    <>
      <PageHead kicker={t("CLASSEMENT OFFICIEL")} title={t("La")} em="Blacklist">{t("10 pilotes. 10 positions. Le classement se met à jour en direct à chaque duel validé par l'organisation.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          <BlacklistBoard initial={list} rewards={rewards} base="/blacklist" />
          <p className="mt-4 text-xs tracking-wider text-metal">{t("V = victoires · D = défaites · Prime = Cash Prize remporté en battant le pilote de ce rang.")}</p>
        </div>
      </section>
      <section className="pb-24">
        <div className="wrap">
          <div className="kicker mb-2.5">{t("DERNIÈRES CONFRONTATIONS")}</div>
          <h2 className="h2 mb-8">{t("Sur")} <em>{t("l'asphalte")}</em></h2>
          <div className="grid gap-4 md:grid-cols-3">
            <DuelCard d={EXAMPLE_DUEL} example />
            {duels.map((d) => <DuelCard key={d.id} d={d} />)}
          </div>
          <p className="mt-4 text-xs tracking-wider text-metal">{t("Exemple de duel : le #5 prend la place du #4 en le battant. Les vrais duels apparaîtront ici.")}</p>
        </div>
      </section>
    </>
  );
}
