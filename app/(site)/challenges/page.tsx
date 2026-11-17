import type { Metadata } from "next";
import ChallengesPanel from "@/components/ChallengesPanel";
import PageHead from "@/components/PageHead";
import { requireDriver } from "@/lib/auth";
import { getTracks } from "@/lib/data";

export const metadata: Metadata = { title: "My Challenges" };
export const dynamic = "force-dynamic";

export default async function MyChallenges() {
  const { supabase, user } = await requireDriver();
  const [{ data: rk }, { data: veh }, tracks] = await Promise.all([
    supabase.from("blacklist_rankings").select("position").eq("driver_id", user.id).maybeSingle(),
    supabase.from("vehicles").select("status").eq("owner_id", user.id).eq("status", "approved").maybeSingle(),
    getTracks(),
  ]);
  return (
    <>
      <PageHead kicker="CHALLENGE SYSTEM" title="My" em="Challenges">Lance ton défi, fixe la date du duel avant la fin du compte à rebours, suis le score en direct.</PageHead>
      <section className="py-14"><div className="wrap">
        <ChallengesPanel supabase={supabase} userId={user.id} myPos={rk?.position ?? null} ready={veh ? null : "Ton véhicule n'est pas homologué : tu ne peux pas participer."} tracks={tracks} />
      </div></section>
    </>
  );
}
