import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/i18n";
import { dateTime } from "@/lib/format";
import { localizeNotif } from "@/lib/notif-i18n";

export const dynamic = "force-dynamic";

// Les dernières notifications du compte connecté (la RLS ne renvoie que les siennes).
export async function GET() {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  const lang = await getLang();
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  const { data } = await supabase.from("notifications").select("id,kind,title,body,link,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
  const items = (data ?? []).map((n) => { const x = localizeNotif(n, lang); return { id: n.id, kind: n.kind, title: x.title, body: x.body, link: n.link, read: Boolean(n.read_at), at: dateTime(n.created_at, locale) }; });
  return NextResponse.json({ items, unread: items.filter((i) => !i.read).length }, { headers: { "Cache-Control": "no-store" } });
}
