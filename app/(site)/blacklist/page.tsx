import type { Metadata } from "next";
import BlacklistBoard from "@/components/BlacklistBoard";
import DuelCard from "@/components/DuelCard";
import PageHead from "@/components/PageHead";
import { getBlacklist, getLatestDuels, getRewards } from "@/lib/data";

export const metadata: Metadata = { title: "The Blacklist" };
export const dynamic = "force-dynamic";

export default async function BlacklistPage() {
  const [list, rewards, duels] = await Promise.all([getBlacklist(), getRewards(), getLatestDuels(6)]);
  return (
    <>
      <PageHead kicker="OFFICIAL RANKING" title="The" em="Blacklist">10 pilotes. 10 positions. Le classement se met à jour en direct à chaque duel validé par l&apos;organisation.</PageHead>
      <section className="py-14">
        <div className="wrap">
          <BlacklistBoard initial={list} rewards={rewards} base="/blacklist" />
          <p className="mt-4 text-xs tracking-wider text-metal">V = victoires · D = défaites · Prize = Cash Prize remporté en battant le pilote de ce rang.</p>
        </div>
      </section>
      <section className="pb-24">
        <div className="wrap">
          <div className="kicker mb-2.5">DERNIÈRES CONFRONTATIONS</div>
          <h2 className="h2 mb-8">Sur <em>l&apos;asphalte</em></h2>
          {duels.length ? <div className="grid gap-4 md:grid-cols-3">{duels.map((d) => <DuelCard key={d.id} d={d} />)}</div> : <p className="panel text-[#a5a9b0]">Aucune confrontation enregistrée.</p>}
        </div>
      </section>
    </>
  );
}
