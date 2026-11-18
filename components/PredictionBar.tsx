"use client";
import { useActionState } from "react";
import Link from "next/link";
import { predictDuel } from "@/app/actions/driver";
import { useT } from "@/components/LangProvider";

type Props = { challengeId: string; challenger: string; defender: string; ch: number; df: number; mine: "challenger" | "defender" | null; canVote: boolean; loggedIn: boolean };

/** Pronostic : barre de répartition des votes + boutons pour voter (pilotes connectés, jamais sur son propre duel). */
export default function PredictionBar({ challengeId, challenger, defender, ch, df, mine, canVote, loggedIn }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(predictDuel, {});
  const total = ch + df;
  const pc = total ? Math.round((ch / total) * 100) : 50;
  const pd = total ? 100 - pc : 50;
  return (
    <div className="predict" aria-label={t("Pronostic")}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-cond text-[11px] font-bold tracking-[.26em] text-red">{t("PRONOSTIC")}</span>
        <span className="font-cond text-[11px] tracking-[.14em] text-metal">{total ? t("{n} vote(s)", { n: total }) : t("Aucun vote")}</span>
      </div>
      <div className="predict-bar" role="img" aria-label={`${challenger} ${pc} %, ${defender} ${pd} %`}>
        <div className="predict-ch" style={{ width: `${pc}%` }}>{total ? `${pc}%` : ""}</div>
        <div className="predict-df" style={{ width: `${pd}%` }}>{total ? `${pd}%` : ""}</div>
      </div>
      {canVote ? (
        <form action={action} className="mt-2 grid grid-cols-2 gap-2">
          <input type="hidden" name="challenge" value={challengeId} />
          <button name="pick" value="challenger" disabled={pending} aria-pressed={mine === "challenger"} className={`predict-btn ${mine === "challenger" ? "predict-btn-on" : ""}`}>{mine === "challenger" ? "✓ " : ""}{challenger}</button>
          <button name="pick" value="defender" disabled={pending} aria-pressed={mine === "defender"} className={`predict-btn ${mine === "defender" ? "predict-btn-on" : ""}`}>{mine === "defender" ? "✓ " : ""}{defender}</button>
        </form>
      ) : (
        <p className="mt-2 text-xs text-metal">{loggedIn ? t("Tu ne peux pas pronostiquer ton propre duel.") : <>{t("Pilotes : connecte-toi pour pronostiquer.")} <Link href="/login" className="text-red underline underline-offset-4 hover:text-white">{t("CONNEXION")}</Link></>}</p>
      )}
      {state.message && <p role="status" className={`mt-2 text-xs ${state.ok ? "text-ok" : "text-[#ff6b6b]"}`}>{state.message}</p>}
    </div>
  );
}
