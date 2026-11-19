import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pushToUser } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// « Envoyer une notification de test » : vérifie de bout en bout que l'appareil reçoit bien les notifications.
export async function POST() {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!(await rateLimit("push-test", 5, 10 * 60_000, user.id))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await pushToUser(user.id, (lang) => ({ title: lang === "en" ? "Test notification" : "Notification de test", body: lang === "en" ? "Notifications work on this device." : "Les notifications fonctionnent sur cet appareil.", url: "/notifications", tag: "test" }));
  return NextResponse.json({ ok: r.sent > 0, ...r });
}
