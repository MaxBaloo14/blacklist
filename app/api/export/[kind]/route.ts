import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBlacklist, getLatestDuels, getRewards } from "@/lib/data";
import { toCsv } from "@/lib/csv";
import { getLang } from "@/lib/i18n";
import { fullName } from "@/lib/format";

export const dynamic = "force-dynamic";

const T = {
  fr: {
    ranking: ["Position", "Prénom", "Nom", "Véhicule", "Catégorie", "Victoires", "Défaites", "Cash Prize du rang ($)", "Dans la Blacklist depuis"],
    rankingFull: ["Téléphone", "Statut du compte"],
    duels: ["Date", "Rang challenger", "Challenger", "Rang défendeur", "Défendeur", "Format", "Statut", "Vainqueur", "Score challenger", "Score défendeur", "Clip"],
    duelsFull: ["Créé le", "Validé le", "Motif d'annulation"],
    podium: "Meilleur des 3", single: "1 course",
    status: { scheduled: "Programmé", completed: "Terminé", forfeited: "Forfait", awaiting_schedule: "Date à fixer", awaiting_validation: "À valider", cancelled: "Annulé" } as Record<string, string>,
    file: { ranking: "classement", duels: "historique-duels" },
  },
  en: {
    ranking: ["Position", "First name", "Last name", "Vehicle", "Category", "Wins", "Losses", "Rank Cash Prize ($)", "In the Blacklist since"],
    rankingFull: ["Phone", "Account status"],
    duels: ["Date", "Challenger rank", "Challenger", "Defender rank", "Defender", "Format", "Status", "Winner", "Challenger score", "Defender score", "Clip"],
    duelsFull: ["Created on", "Validated on", "Cancel reason"],
    podium: "Best of 3", single: "1 race",
    status: { scheduled: "Scheduled", completed: "Completed", forfeited: "Forfeit", awaiting_schedule: "Awaiting date", awaiting_validation: "Awaiting validation", cancelled: "Cancelled" } as Record<string, string>,
    file: { ranking: "ranking", duels: "duel-history" },
  },
};
const iso = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

// Exports CSV : version publique (données déjà visibles sur le site) ; ?full=1 = version organisation (téléphones, défis annulés…), réservée aux organisateurs.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "ranking" && kind !== "duels") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const lang = await getLang(); const tr = T[lang];
  const full = new URL(req.url).searchParams.get("full") === "1";
  const { supabase, isAdmin } = await getSession();
  if (full && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let header: string[], rows: (string | number | null | undefined)[][];
  if (kind === "ranking") {
    const [list, rewards] = await Promise.all([getBlacklist(), getRewards()]);
    const extra = new Map<string, { phone: string; account_status: string }>();
    if (full && supabase) {
      const { data } = await supabase.from("profiles").select("id,phone,account_status");
      (data ?? []).forEach((p) => extra.set(p.id, p));
    }
    header = [...tr.ranking, ...(full ? tr.rankingFull : [])];
    rows = list.map((r) => [r.position, r.first_name, r.last_name, r.make_model, r.vehicle_class, r.driver_id ? r.wins : "", r.driver_id ? r.losses : "", rewards?.[String(r.position)] ?? "", iso(r.ranked_since),
      ...(full ? [extra.get(r.driver_id)?.phone ?? "", extra.get(r.driver_id)?.account_status ?? ""] : [])]);
  } else if (full && supabase) {
    const [{ data: ch }, { data: profs }] = await Promise.all([
      supabase.from("challenges").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name"),
    ]);
    const name = new Map((profs ?? []).map((p) => [p.id, fullName(p)]));
    header = [...tr.duels, ...tr.duelsFull];
    rows = (ch ?? []).map((c) => [iso(c.scheduled_at ?? c.created_at), c.challenger_position, name.get(c.challenger_id), c.defender_position, name.get(c.defender_id), c.is_podium ? tr.podium : tr.single,
      tr.status[c.status] ?? c.status, c.winner_id ? name.get(c.winner_id) : "", c.is_podium ? c.challenger_wins : "", c.is_podium ? c.champion_wins : "", c.clip_url ?? "", iso(c.created_at), iso(c.validated_at), c.cancel_reason ?? ""]);
  } else {
    const duels = await getLatestDuels(500);
    header = tr.duels;
    rows = duels.map((d) => [iso(d.validated_at ?? d.scheduled_at), d.challenger_position, `${d.challenger_first} ${d.challenger_last}`.trim(), d.defender_position, `${d.defender_first} ${d.defender_last}`.trim(), d.is_podium ? tr.podium : tr.single,
      tr.status[d.status] ?? d.status, d.winner_id ? (d.winner_id === d.challenger_id ? `${d.challenger_first} ${d.challenger_last}` : `${d.defender_first} ${d.defender_last}`).trim() : "", d.is_podium ? d.challenger_wins : "", d.is_podium ? d.champion_wins : "", d.clip_url ?? ""]);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(header, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${tr.file[kind]}-${stamp}${full ? "-organisation" : ""}.csv"`, "Cache-Control": "no-store" } });
}
