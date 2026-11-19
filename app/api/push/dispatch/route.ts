import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { payloadFromNotification, pushToUser } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Appelé par la base à chaque nouvelle notification. Aucun secret : on ne fait confiance qu'à l'identifiant, on relit la notification
// et on la « réclame » une seule fois (push_sent_at). Rien n'est renvoyé, et rejouer cet appel n'a aucun effet.
export async function POST(req: Request) {
  if (!(await rateLimit("push-dispatch", 600, 60_000, "global"))) return NextResponse.json({ ok: false }, { status: 429 });
  const body = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const sb = createServiceClient();
  const { data: claimed } = await sb.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", body.data.id).is("push_sent_at", null).select("id,user_id,kind,title,body,link").maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true });
  await pushToUser(claimed.user_id, payloadFromNotification(claimed));
  return NextResponse.json({ ok: true });
}
