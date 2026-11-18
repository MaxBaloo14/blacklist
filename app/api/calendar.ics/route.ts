import { NextResponse } from "next/server";
import { getLatestDuels, getWarmups } from "@/lib/data";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const nm = (f?: string, l?: string) => `${f ?? ""} ${l ?? ""}`.trim();

// Agenda au format iCalendar : tous les duels programmés et les Warm-up à venir (ou un seul duel avec ?duel=<id>).
export async function GET(req: Request) {
  const only = new URL(req.url).searchParams.get("duel");
  const [duels, warmups] = await Promise.all([getLatestDuels(200), getWarmups()]);
  const now = stamp(new Date());
  const ev: string[] = [];
  for (const d of duels) {
    if (d.status !== "scheduled" || !d.scheduled_at || (only && d.id !== only)) continue;
    const start = new Date(d.scheduled_at);
    ev.push(["BEGIN:VEVENT", `UID:duel-${d.id}@blacklist-bbc`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 3600_000))}`,
      `SUMMARY:${esc(`Blacklist — ${nm(d.challenger_first, d.challenger_last)} vs ${nm(d.defender_first, d.defender_last)}`)}`,
      `DESCRIPTION:${esc(`Duel #${d.challenger_position} → #${d.defender_position}${d.is_podium ? " (meilleur des 3)" : ""}`)}`,
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Duel dans 1 heure", "END:VALARM", "END:VEVENT"].join("\r\n"));
  }
  if (!only) for (const w of warmups) {
    if (!["scheduled", "running"].includes(w.status) || !w.scheduled_at) continue;
    const start = new Date(w.scheduled_at);
    ev.push(["BEGIN:VEVENT", `UID:warmup-${w.id}@blacklist-bbc`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 3600_000))}`, "SUMMARY:Blacklist — Warm-up Race", "DESCRIPTION:La course d'entrée du dimanche", "END:VEVENT"].join("\r\n"));
  }
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blacklist BooBoo Crew//Duels//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Blacklist — duels", ...ev, "END:VCALENDAR"].join("\r\n") + "\r\n";
  return new NextResponse(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${only ? "duel" : "blacklist-duels"}.ics"`, "Cache-Control": "no-store" } });
}
