import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import { getNews } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Actualités" };

export default async function NewsPage() {
  const [{ t, locale }, news] = await Promise.all([getI18n(), getNews(30)]);
  return (
    <>
      <PageHead kicker={t("L'ORGANISATION")} title={t("Actualités")} em="BBC">{t("Les annonces officielles de la BooBoo Crew.")}</PageHead>
      <section className="py-14">
        <div className="wrap max-w-3xl">
          {!news.length && <p className="panel text-[#a5a9b0]">{t("Aucune annonce publiée.")}</p>}
          <div className="grid gap-4">
            {news.map((n) => (
              <article key={n.id} className="border-l-[3px] border-red bg-ink2 p-7">
                <time className="font-cond text-xs tracking-[.25em] text-metal">{dateOnly(n.published_at, locale)}</time>
                <h2 className="font-display my-2 text-3xl uppercase">{n.title}</h2>
                <p className="whitespace-pre-line text-[15px] text-[#a5a9b0]">{n.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
