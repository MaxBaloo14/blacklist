import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export function cleanError(message: string): string {
  if (/permission denied|row-level security|42501/i.test(message)) return "Action non autorisée.";
  if (/duplicate key/i.test(message)) return "Cette entrée existe déjà.";
  if (/violates (check|foreign key)/i.test(message)) return "Données invalides.";
  return message;
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const optional = (f: FormData, k: string) => str(f, k) || null;

/** Appelle une fonction SQL avec la session de l'utilisateur : les droits et règles sont appliqués par la base. */
export async function callRpc(name: string, args: Record<string, unknown>, success: string, paths: string[] = []): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args);
  if (error) return { ok: false, message: cleanError(error.message), nonce: Date.now() };
  revalidatePath("/", "layout");
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, message: success, nonce: Date.now() };
}
