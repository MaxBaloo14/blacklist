"use server";
import { z } from "zod";
import { callRpc, str } from "@/lib/action";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const fail = async (message: string): Promise<ActionState> => ({ ok: false, message: (await getT())(message), nonce: Date.now() });

export async function buyItem(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  if (!user) return await fail("Connexion requise.");
  if (!(await rateLimit("shop", 10, 60_000, user.id))) return await fail("Trop de requêtes. Patiente un instant.");
  const item = z.string().uuid().safeParse(str(f, "item"));
  if (!item.success) return await fail("Article invalide.");
  return callRpc("shop_buy", { p_item: item.data }, (await getT())("Commande enregistrée : l'organisation te remet l'article en jeu."), ["/boutique"]);
}

export async function placeBet(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  if (!user) return await fail("Connexion requise.");
  if (!(await rateLimit("bet", 12, 60_000, user.id))) return await fail("Trop de requêtes. Patiente un instant.");
  const id = z.string().uuid().safeParse(str(f, "challenge")), side = z.enum(["challenger", "defender"]).safeParse(str(f, "side"));
  const stake = Math.trunc(Number(str(f, "stake")));
  if (!id.success || !side.success) return await fail("Choix invalide.");
  if (!Number.isFinite(stake) || stake < 500 || stake > 50000 || stake % 500 !== 0) return await fail("La mise doit être un montant rond (multiple de 500) compris entre 500 et 50 000 zigollars.");
  return callRpc("place_bet", { p_challenge: id.data, p_side: side.data, p_stake: stake }, (await getT())("Pari enregistré. Bonne chance !"), ["/boutique", "/blacklist"]);
}
