import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const Body = z.object({ subscription: z.object({ endpoint: z.string().max(600), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) }), lang: z.enum(["fr", "en"]).default("fr") });

// Un appareil s'abonne (pilote ou organisateur connecté). L'adresse du service push doit appartenir à un fournisseur reconnu.
export async function POST(req: Request) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!(await rateLimit("push-sub", 20, 10 * 60_000, user.id))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || !isAllowedPushEndpoint(p.data.subscription.endpoint)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const sb = createServiceClient();
  await sb.from("push_subscriptions").delete().eq("endpoint", p.data.subscription.endpoint);   // un appareil change de compte : on le réaffecte
  const { error } = await sb.from("push_subscriptions").insert({ user_id: user.id, endpoint: p.data.subscription.endpoint, p256dh: p.data.subscription.keys.p256dh, auth: p.data.subscription.keys.auth, lang: p.data.lang });
  return error ? NextResponse.json({ error: "failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { user, supabase } = await getSession();
  if (!user || !supabase) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const body = z.object({ endpoint: z.string().max(600) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.data.endpoint);   // la RLS limite aux appareils du compte
  return NextResponse.json({ ok: true });
}
