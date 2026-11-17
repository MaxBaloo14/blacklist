import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import Reveal from "@/components/Reveal";
import { chapters } from "@/lib/lore";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "The Crew" };

export default async function Crew() {
  const { t, lang } = await getI18n();
  return (
    <>
      <PageHead kicker="A BOOBOO CREW PRODUCTION" title="Two brothers." em="One mission.">{t("Loyauté × Vitesse × Famille. L'histoire du BooBoo Crew, de Los Santos à Detroit, et retour.")}</PageHead>
      <section className="py-14">
        <div className="wrap max-w-4xl space-y-6">
          {chapters.map((c) => {
            const x = lang === "en" ? c.en : c;
            return (
              <Reveal key={c.n}>
                <article className="relative overflow-hidden border border-white/10 bg-ink2 p-7 sm:p-10">
                  <div className="font-cond flex justify-between text-xs tracking-[.3em] text-metal"><span className="font-bold text-red">{x.n}</span><span>{c.place.toUpperCase()}</span></div>
                  <h2 className="font-display mt-2 text-4xl uppercase sm:text-5xl">{x.title}</h2>
                  <p className="font-marker slash mb-5 mt-3 text-xl text-[#cfcfcf]">{x.sub}</p>
                  <div className="space-y-3 text-[15px] leading-relaxed text-[#b4b7bd]">{x.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
