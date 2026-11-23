"use client";
import { useActionState, useEffect, useState } from "react";
import { placeBet } from "@/app/actions/economy";
import { useT } from "@/components/LangProvider";
import { useWallet } from "@/components/Wallet";

type Props = { challengeId: string; challenger: string; defender: string; chOdds: number; dfOdds: number; balance: number | null; mine: { side: string; stake: number; odds: number } | null; locked: string | null };

const STAKES = [500, 1000, 2000];
const MIN = 500, MAX = 50000, STEP = 500;
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");

/** Paris à cotes fixes : la cote est figée au moment du pari ; le gain est versé à la validation officielle du résultat. */
export default function BetCard({ challengeId, challenger, defender, chOdds, dfOdds, balance: initialBalance, mine, locked }: Props) {
  const t = useT();
  const wallet = useWallet();
  const balance = wallet.available ?? initialBalance;
  const [state, action, pending] = useActionState(placeBet, {});
  const [side, setSide] = useState<"challenger" | "defender">("defender");
  const [stake, setStake] = useState(1000);
  const [custom, setCustom] = useState("");
  useEffect(() => { if (state.ok) wallet.refresh(); }, [state.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const odds = side === "challenger" ? chOdds : dfOdds;
  const round = Number.isInteger(stake) && stake >= MIN && stake <= MAX && stake % STEP === 0;
  const cannot = balance !== null && stake > balance;
  const opt = (k: "challenger" | "defender", name: string, o: number) => (
    <button type="button" onClick={() => setSide(k)} aria-pressed={side === k} className={`bet-side ${side === k ? "bet-side-on" : ""}`}>
      <span className="font-cond block truncate text-sm font-bold uppercase tracking-wide">{name}</span>
      <span className="font-display block text-3xl leading-none">× {o.toFixed(2)}</span>
    </button>
  );
  return (
    <div className="bet">
      <div className="mb-2 flex items-center justify-between"><span className="font-cond text-[11px] font-bold tracking-[.26em] text-red">{t("COTES")}</span><span className="font-cond text-[11px] tracking-[.14em] text-metal">{t("Cote figée au moment du pari")}</span></div>
      {mine ? (
        <p className="text-sm text-[#cfcfcf]">✓ {t("Ton pari")} : <b>{fmt(mine.stake)} zigollars</b> {t("sur")} <b>{mine.side === "challenger" ? challenger : defender}</b> (× {Number(mine.odds).toFixed(2)}) — {t("gain possible")} <b className="text-ok">{fmt(Math.floor(mine.stake * Number(mine.odds)))} zigollars</b></p>
      ) : locked ? (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bet-side opacity-70"><span className="font-cond block truncate text-sm font-bold uppercase">{challenger}</span><span className="font-display block text-3xl leading-none">× {chOdds.toFixed(2)}</span></div>
            <div className="bet-side opacity-70"><span className="font-cond block truncate text-sm font-bold uppercase">{defender}</span><span className="font-display block text-3xl leading-none">× {dfOdds.toFixed(2)}</span></div>
          </div>
          <p className="mt-2 text-xs text-metal">{locked}</p>
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="challenge" value={challengeId} /><input type="hidden" name="side" value={side} /><input type="hidden" name="stake" value={stake} />
          <div className="grid grid-cols-2 gap-2">{opt("challenger", challenger, chOdds)}{opt("defender", defender, dfOdds)}</div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("Mise")}>
            {STAKES.map((v) => <button key={v} type="button" onClick={() => { setStake(v); setCustom(""); }} aria-pressed={stake === v && !custom} className={`bet-chip ${stake === v && !custom ? "bet-chip-on" : ""}`}>{fmt(v)}</button>)}
            <label className="sr-only" htmlFor={`stake-${challengeId}`}>{t("Autre montant")}</label>
            <input id={`stake-${challengeId}`} type="number" inputMode="numeric" min={MIN} max={MAX} step={STEP} placeholder={t("Autre montant")} value={custom}
              onChange={(e) => { setCustom(e.target.value); setStake(e.target.value === "" ? 1000 : Number(e.target.value)); }}
              className={`bet-input ${custom ? "bet-chip-on" : ""}`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#cfcfcf]">{t("Gain possible")} : <b className="text-ok">{fmt(Math.floor(stake * odds))} zigollars</b></p>
            <button disabled={pending || cannot || !round} className="btn btn-red btn-sm">{pending ? <span className="spin" aria-label="…" /> : t("PARIER")}</button>
          </div>
          {!round && <p className="mt-2 text-xs text-[#ff6b6b]">{t("Mise : montant rond (multiple de 500), de 500 à 50 000 zigollars.")}</p>}
          {cannot && <p className="mt-2 text-xs text-[#ff6b6b]">{wallet.locked > 0 ? t("Tes zigollars de bienvenue se débloquent à ton premier gain.") : t("Solde insuffisant.")}</p>}
        </form>
      )}
      {state.message && <p role="status" className={`mt-2 text-xs ${state.ok ? "text-ok" : "text-[#ff6b6b]"}`}>{state.message}</p>}
    </div>
  );
}
