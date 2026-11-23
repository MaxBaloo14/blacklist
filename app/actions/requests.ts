"use server";
import { z } from "zod";
import { callRpc, str } from "@/lib/action";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getT } from "@/lib/i18n";
import type { ActionState } from "@/lib/types";

const fail = async (message: string): Promise<ActionState> => ({ ok: false, message: (await getT())(message), nonce: Date.now() });

export async function submitClaim(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  if (!user) return await fail("Connexion requise.");
  if (!(await rateLimit("claim", 6, 60_000, user.id))) return await fail("Trop de requêtes. Patiente un instant.");
  const links = f.getAll("link").map((v) => String(v).trim()).filter(Boolean);
  if (links.length > 5) return await fail("5 liens au maximum.");
  return callRpc("submit_claim", { p_title: str(f, "title"), p_message: str(f, "message"), p_links: links }, (await getT())("Réclamation envoyée. L'organisation te répond ici."), ["/reclamation"]);
}

const dim = z.coerce.number().int().min(100).max(20000);
export async function submitSuggestion(_: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await getSession();
  if (!user) return await fail("Connexion requise.");
  if (!(await rateLimit("suggestion", 6, 60_000, user.id))) return await fail("Trop de requêtes. Patiente un instant.");
  const path = str(f, "path"), w = dim.safeParse(str(f, "w")), h = dim.safeParse(str(f, "h"));
  if (!path || !/^M[-0-9. ,CL]+$/.test(path) || !w.success || !h.success) return await fail("Trace ton parcours sur la carte : place au moins 2 points (départ puis arrivée).");
  return callRpc("submit_suggestion", { p_name: str(f, "name"), p_description: str(f, "description"), p_path: path, p_w: w.data, p_h: h.data }, (await getT())("Suggestion envoyée. L'organisation étudie ton parcours."), ["/suggestion"]);
}
