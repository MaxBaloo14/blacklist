import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import ClipButton from "@/components/ClipButton";
import PageHead from "@/components/PageHead";
import { getLatestDuels } from "@/lib/data";
import { parseClip } from "@/lib/clips";
import { dateOnly } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Clips" };
export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const [{ t, locale }, duels] = await Promise.all([getI18n(), getLatestDuels(200)]);
  const clips = duels.filter((d) => d.clip_url && parseClip(d.clip_url)).sort((a, b) => +new Date(b.validated_at ?? b.scheduled_at ?? 0) - +new Date(a.validated_at ?? a.scheduled_at ?? 0));
  return (
    <>
      <PageHead kicker={t("LES MEILLEURS MOMENTS")} title="Clips" em={t("des duels")}>{t("Les clips publiés par l'organisation : regarde-les ici, sans quitter le site.")}</PageHead>
      <section className="py-14">
        <div className="wrap">
          {clips.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {clips.map((d, i) => {
                const c = parseClip(d.clip_url)!;
                const win = d.winner_id === d.challenger_id ? `${d.challenger_first} ${d.challenger_last}` : `${d.defender_first} ${d.defender_last}`;
                return (
                  <article key={d.id} className={`clip-card ${i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
                    <div className="clip-poster" aria-hidden><span className="clip-play"><Play size={30} /></span><span className="badge badge-metal absolute left-3 top-3">{c.label}</span></div>
                    <div className="p-5">
                      <div className="font-cond text-xs tracking-[.2em] text-metal">{dateOnly(d.validated_at ?? d.scheduled_at, locale)} · #{d.challenger_position} → #{d.defender_position}</div>
                      <h2 className="font-cond mt-1 text-xl font-bold uppercase tracking-wide">{`${d.challenger_first} ${d.challenger_last}`.trim()} <span className="text-red">vs</span> {`${d.defender_first} ${d.defender_last}`.trim()}</h2>
                      {d.winner_id && <div className="font-cond text-sm tracking-[.12em] text-[#cfcfcf]">{t("Vainqueur")} : <b className="text-ok">{win.trim()}</b></div>}
                      <div className="mt-4"><ClipButton url={d.clip_url} title={`${d.challenger_first} vs ${d.defender_first}`} /></div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="panel text-[#a5a9b0]">{t("Aucun clip publié pour le moment.")} <Link href="/blacklist" className="text-red">{t("Voir le classement")}</Link></p>}
        </div>
      </section>
    </>
  );
}
