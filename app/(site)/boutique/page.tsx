import type { Metadata } from "next";
import Link from "next/link";
import { Coins } from "lucide-react";
import ActionForm from "@/components/ActionForm";
import BetCard from "@/components/BetCard";
import PageHead from "@/components/PageHead";
import ShopGrid from "@/components/ShopGrid";
import { WalletBalance, WalletLock, WalletProvider } from "@/components/Wallet";
import Tabs from "@/components/Tabs";
import { buyItem } from "@/app/actions/economy";
import { getSession } from "@/lib/auth";
import { dateTime, points } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { Row } from "@/lib/types";

export const metadata: Metadata = { title: "Boutique & paris" };
export const dynamic = "force-dynamic";

export default async function Boutique({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ t, locale }, sp, { supabase, user, profile }] = await Promise.all([getI18n(), searchParams, getSession()]);
  const tab = ["boutique", "paris", "historique"].includes(sp.tab ?? "") ? sp.tab! : "boutique";
  const sb = supabase!;
  const loggedPilot = Boolean(user && profile);

  const [{ data: bal }, { data: items }, { data: duels }] = await Promise.all([
    loggedPilot ? sb.from("point_balances").select("balance,locked").eq("user_id", user!.id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("shop_items").select("*").eq("active", true).order("sort").order("name"),
    tab === "paris" ? sb.from("public_duels").select("*").eq("status", "scheduled").gt("scheduled_at", new Date().toISOString()).order("scheduled_at") : Promise.resolve({ data: [] as Row[] }),
  ]);
  const balance = loggedPilot ? Number(bal?.balance ?? 0) : null;
  const locked = loggedPilot ? Number(bal?.locked ?? 0) : 0;
  const available = balance === null ? null : Math.max(0, balance - locked);

  const tabs: [string, string][] = [["boutique", t("BOUTIQUE")], ["paris", t("PARIS")], ...(loggedPilot ? [["historique", t("MES ZIGOLLARS")] as [string, string]] : [])];

  // --- Paris : cotes de chaque duel programmé + mes paris
  let odds = new Map<string, { ch: number; df: number }>();
  let myBets = new Map<string, Row>();
  if (tab === "paris" && duels?.length) {
    const res = await Promise.all(duels.map((d: Row) => sb.rpc("duel_odds", { p_challenge: d.id })));
    odds = new Map(duels.map((d: Row, i: number) => { const r = Array.isArray(res[i].data) ? res[i].data[0] : res[i].data; return [d.id, { ch: Number(r?.challenger_odds ?? 2), df: Number(r?.defender_odds ?? 2) }]; }));
    if (loggedPilot) {
      const { data } = await sb.from("duel_bets").select("challenge_id,side,stake,odds,status,payout").in("challenge_id", duels.map((d: Row) => d.id));
      myBets = new Map((data ?? []).map((b: Row) => [b.challenge_id, b]));
    }
  }
  const { data: allBets } = tab === "paris" && loggedPilot ? await sb.from("duel_bets").select("*").order("created_at", { ascending: false }).limit(30) : { data: [] as Row[] };

  // --- Historique
  const [{ data: ledger }, { data: orders }] = tab === "historique" && loggedPilot
    ? await Promise.all([sb.from("point_ledger").select("*").order("created_at", { ascending: false }).limit(60), sb.from("shop_orders").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30)])
    : [{ data: [] as Row[] }, { data: [] as Row[] }];

  const byCat = new Map<string, Row[]>();
  for (const it of items ?? []) byCat.set(it.category, [...(byCat.get(it.category) ?? []), it]);
  const ORDER: Record<string, string> = { pending: t("En attente de remise"), delivered: t("Remis"), cancelled: t("Annulé et remboursé") };
  const BET: Record<string, [string, string]> = { open: [t("En cours"), "badge-warn"], won: [t("Gagné"), "badge-ok"], lost: [t("Perdu"), "badge-red"], refunded: [t("Remboursé"), "badge-metal"] };

  return (
    <>
      <PageHead kicker={t("ZIGOLLARS BBC")} title={t("Boutique")} em={t("& paris")}>{t("Chaque pilote reçoit 10 000 zigollars à l'inscription, verrouillés jusqu'à son premier gain. Ensuite, dépense-les dans la boutique ou mise-les sur les duels programmés.")}</PageHead>
      <section className="py-14">
        <WalletProvider initial={balance} initialLocked={locked}>
        <div className="wrap">
          <div className="wallet mb-8">
            <span className="wallet-icon" aria-hidden><Coins size={26} /></span>
            <div>
              <div className="label !mb-0">{t("TON SOLDE")}</div>
              {balance !== null ? <><div className="font-display text-5xl leading-none"><WalletBalance /></div><WalletLock template={t("dont {n} zigollars de bienvenue verrouillés jusqu'à ton premier gain (victoire en duel, Warm-up Race…)")} /></>
                : <div className="font-cond text-lg">{t("Inscris-toi pour recevoir 10 000 zigollars offerts.")} <Link href="/register" className="text-red underline underline-offset-4 hover:text-white">{t("INSCRIPTION")}</Link> · <Link href="/login" className="text-red underline underline-offset-4 hover:text-white">{t("CONNEXION")}</Link></div>}
            </div>
          </div>
          <Tabs base="/boutique" tabs={tabs} current={tab} />

          {tab === "boutique" && (
            <div className="grid gap-6">
              <p className="text-sm text-[#a5a9b0]">{t("Les articles sont remis en jeu par l'organisation après ta commande. Une commande annulée est remboursée en zigollars.")}</p>
              <ShopGrid items={(items ?? []) as never} loggedPilot={loggedPilot} />
            </div>
          )}

          {tab === "paris" && (
            <div className="grid gap-10">
              <p className="max-w-3xl text-sm text-[#a5a9b0]">{t("Mise entre 500 et 50 000 zigollars (montants ronds, par pas de 500) sur un duel programmé. Les cotes se basent sur le bilan des deux pilotes et l'avantage du défié. Le gain (mise × cote) est versé quand l'organisation valide le résultat ; si le duel est annulé, ta mise est remboursée. Tu ne peux pas parier sur ton propre duel.")}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {(duels ?? []).map((d: Row) => {
                  const o = odds.get(d.id) ?? { ch: 2, df: 2 };
                  const mine = myBets.get(d.id) ?? null;
                  const own = user && (d.challenger_id === user.id || d.defender_id === user.id);
                  const locked = !loggedPilot ? t("Connecte-toi avec un compte pilote pour parier.") : own ? t("Tu ne peux pas parier sur ton propre duel.") : null;
                  const ch = `${d.challenger_first} ${d.challenger_last}`.trim(), df = `${d.defender_first} ${d.defender_last}`.trim();
                  return (
                    <article key={d.id} className="panel">
                      <div className="font-cond mb-1 text-xs tracking-[.25em] text-metal">{d.is_podium ? t("DUEL DU PODIUM · MEILLEUR DES 3") : t("DUEL STANDARD · 1 COURSE")} · {dateTime(d.scheduled_at, locale)}</div>
                      <div className="font-display mb-4 text-2xl uppercase tracking-wide"><span className="text-metal">#{d.challenger_position}</span> {ch} <span className="font-marker text-lg text-red">vs</span> <span className="text-metal">#{d.defender_position}</span> {df}</div>
                      <BetCard challengeId={d.id} challenger={ch} defender={df} chOdds={o.ch} dfOdds={o.df} balance={available} mine={mine ? { side: mine.side, stake: Number(mine.stake), odds: Number(mine.odds) } : null} locked={locked} />
                    </article>
                  );
                })}
              </div>
              {!duels?.length && <p className="panel text-[#a5a9b0]">{t("Aucun duel programmé pour le moment : les paris ouvrent dès qu'une date est fixée.")}</p>}
              {loggedPilot && (allBets ?? []).length > 0 && (
                <div>
                  <div className="kicker mb-3">{t("MES PARIS")}</div>
                  <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Mise")}</th><th>{t("Cote")}</th><th>{t("Résultat")}</th></tr></thead><tbody>
                    {(allBets ?? []).map((b: Row) => <tr key={b.id}><td>{dateTime(b.created_at, locale)}</td><td>{points(b.stake, locale)}</td><td>× {Number(b.odds).toFixed(2)}</td><td><span className={`badge ${BET[b.status][1]}`}>{BET[b.status][0]}</span>{b.status === "won" && <b className="ml-2 text-ok">+{points(b.payout, locale)}</b>}</td></tr>)}
                  </tbody></table></div>
                </div>
              )}
            </div>
          )}

          {tab === "historique" && loggedPilot && (
            <div className="grid gap-10">
              <div>
                <div className="kicker mb-3">{t("MES COMMANDES")}</div>
                {(orders ?? []).length ? (
                  <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Article")}</th><th>{t("Prix")}</th><th>{t("Statut")}</th></tr></thead><tbody>
                    {(orders ?? []).map((o: Row) => <tr key={o.id}><td>{dateTime(o.created_at, locale)}</td><td>{t(o.item_name)}</td><td>{points(o.price, locale)}</td><td><span className={`badge ${o.status === "delivered" ? "badge-ok" : o.status === "cancelled" ? "badge-metal" : "badge-warn"}`}>{ORDER[o.status]}</span>{o.note ? <span className="ml-2 text-xs text-metal">{o.note}</span> : null}</td></tr>)}
                  </tbody></table></div>
                ) : <p className="panel text-[#a5a9b0]">{t("Aucune commande.")}</p>}
              </div>
              <div>
                <div className="kicker mb-3">{t("HISTORIQUE DES ZIGOLLARS")}</div>
                <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>{t("Date")}</th><th>{t("Motif")}</th><th className="text-right">{t("Zigollars")}</th></tr></thead><tbody>
                  {(ledger ?? []).map((l: Row) => <tr key={l.id}><td>{dateTime(l.created_at, locale)}</td><td>{t(l.reason)}</td><td className={`text-right font-bold ${l.delta > 0 ? "text-ok" : "text-[#ff6b6b]"}`}>{l.delta > 0 ? "+" : ""}{points(l.delta, locale).replace(" pts", "")}</td></tr>)}
                </tbody></table></div>
              </div>
            </div>
          )}
        </div>
        </WalletProvider>
      </section>
    </>
  );
}
