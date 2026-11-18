import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DuelCard from "@/components/DuelCard";
import PageHead from "@/components/PageHead";
import { getLatestDuels, getRewards, getWarmups } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getPredictions } from "@/lib/predictions";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); // 2026-12-31
const hm = (d: Date, locale: string) => new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const [sp, { t, locale }, duels, warmups, rewards] = await Promise.all([searchParams, getI18n(), getLatestDuels(200), getWarmups(), getRewards()]);
  const today = ymd(new Date());
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const [Y, M] = m.split("-").map(Number);
  const first = new Date(Date.UTC(Y, M - 1, 1));
  const daysInMonth = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;                    // lundi = 0
  const prev = M === 1 ? `${Y - 1}-12` : `${Y}-${String(M - 1).padStart(2, "0")}`;
  const next = M === 12 ? `${Y + 1}-01` : `${Y}-${String(M + 1).padStart(2, "0")}`;
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));

  type Ev = { at: Date; label: string; kind: "duel" | "done" | "warmup"; href?: string };
  const events = new Map<string, Ev[]>();
  const add = (e: Ev) => { const k = ymd(e.at); (events.get(k) ?? events.set(k, []).get(k)!).push(e); };
  for (const d of duels) {
    const at = d.scheduled_at ?? d.validated_at; if (!at) continue;
    add({ at: new Date(at), kind: d.status === "scheduled" ? "duel" : "done", label: `${d.challenger_first} vs ${d.defender_first}` });
  }
  for (const w of warmups) if (w.scheduled_at && w.status !== "cancelled") add({ at: new Date(w.scheduled_at), kind: "warmup", label: "Warm-up Race" });

  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const upcoming = duels.filter((d) => d.status === "scheduled" && d.scheduled_at && new Date(d.scheduled_at).getTime() > Date.now()).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  const predictions = await getPredictions(upcoming);

  return (
    <>
      <PageHead kicker={t("AGENDA")} title={t("Calendrier")} em={t("des duels")}>{t("Tous les duels programmés et les Warm-up Race, avec compte à rebours et pronostics.")}</PageHead>
      <section className="py-12">
        <div className="wrap">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link href={`/calendar?m=${prev}`} aria-label={t("Mois précédent")} className="cal-nav"><ChevronLeft size={18} /></Link>
              <h2 className="font-display min-w-[220px] text-center text-3xl uppercase tracking-wide">{monthName}</h2>
              <Link href={`/calendar?m=${next}`} aria-label={t("Mois suivant")} className="cal-nav"><ChevronRight size={18} /></Link>
              {m !== today.slice(0, 7) && <Link href="/calendar" className="font-cond ml-2 text-xs font-semibold tracking-[.2em] text-red hover:text-white">{t("AUJOURD'HUI")}</Link>}
            </div>
          </div>

          <table className="cal-table">
            <caption className="sr-only">{monthName}</caption>
            <thead><tr>{weekdays.map((w) => <th key={w} scope="col" className="cal-head">{w}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: cells.length / 7 }, (_, r) => (
                <tr key={r}>
                  {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
                    if (!day) return <td key={i} className="cal-cell cal-empty" aria-hidden />;
                    const key = `${m}-${String(day).padStart(2, "0")}`;
                    const list = (events.get(key) ?? []).sort((a, b) => +a.at - +b.at);
                    return (
                      <td key={i} className={`cal-cell ${key === today ? "cal-today" : ""} ${list.length ? "cal-has" : ""}`}>
                        <span className="cal-day">{day}{key === today && <span className="sr-only"> ({t("AUJOURD'HUI")})</span>}</span>
                        <ul className="grid gap-1">
                          {list.map((e, j) => <li key={j} className={`cal-ev cal-ev-${e.kind}`} title={e.label}><b>{hm(e.at, locale)}</b> {e.label}</li>)}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-cond mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs tracking-[.14em] text-metal">
            <span><i className="cal-dot bg-red" /> {t("Duel programmé")}</span><span><i className="cal-dot bg-ok" /> {t("Duel terminé")}</span><span><i className="cal-dot bg-[#e6bd68]" /> Warm-up Race</span>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="wrap">
          <div className="kicker mb-2.5">{t("À VENIR")}</div>
          <h2 className="h2 mb-8">{t("Prochains")} <em>{t("duels")}</em></h2>
          {upcoming.length
            ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.slice(0, 6).map((d: Row) => <DuelCard key={d.id} d={d} rewards={rewards} prediction={predictions.get(d.id)} />)}</div>
            : <p className="panel text-[#a5a9b0]">{t("Aucun duel programmé pour le moment.")}</p>}
        </div>
      </section>
    </>
  );
}
