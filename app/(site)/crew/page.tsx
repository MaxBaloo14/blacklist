import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import Reveal from "@/components/Reveal";
import { chapters } from "@/lib/lore";

export const metadata: Metadata = { title: "The Crew" };

export default function Crew() {
  return (
    <>
      <PageHead kicker="A BOOBOO CREW PRODUCTION" title="Two brothers." em="One mission.">Loyalty × Speed × Family. L&apos;histoire du BooBoo Crew, de Los Santos à Detroit, et retour.</PageHead>
      <section className="py-14">
        <div className="wrap max-w-4xl space-y-6">
          {chapters.map((c) => (
            <Reveal key={c.n}>
              <article className="relative overflow-hidden border border-white/10 bg-ink2 p-7 sm:p-10">
                <div className="font-cond flex justify-between text-xs tracking-[.3em] text-metal"><span className="font-bold text-red">{c.n}</span><span>{c.place.toUpperCase()}</span></div>
                <h2 className="font-display mt-2 text-4xl uppercase sm:text-5xl">{c.title}</h2>
                <p className="font-marker slash mb-5 mt-3 text-xl text-[#cfcfcf]">{c.sub}</p>
                <div className="space-y-3 text-[15px] leading-relaxed text-[#b4b7bd]">{c.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
