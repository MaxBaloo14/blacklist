import "server-only";
import * as webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/admin";
import { localizeNotif } from "@/lib/notif-i18n";
import type { Lang } from "@/lib/i18n-core";
import type { Row } from "@/lib/types";

const SUBJECT = "mailto:contact@blacklist-bbc.app";

/** Hôtes de services push autorisés (le serveur ne contacte jamais une autre adresse). PUSH_ALLOW_HOSTS : hôtes de test supplémentaires. */
const ALLOWED = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/, /\.push\.services\.mozilla\.com$/];
export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const extra = (process.env.PUSH_ALLOW_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return ALLOWED.some((re) => re.test(u.hostname)) || extra.includes(u.host);
  } catch { return false; }
}

/** Clés VAPID : lues en base, ou créées une seule fois au premier usage. La clé privée ne quitte jamais le serveur. */
export async function getVapid() {
  const sb = createServiceClient();
  const read = async () => (await sb.from("push_keys").select("public_key,private_key").eq("id", 1).maybeSingle()).data;
  let k = await read();
  if (!k) {
    const g = webpush.generateVAPIDKeys();
    await sb.from("push_keys").insert({ id: 1, public_key: g.publicKey, private_key: g.privateKey });   // en cas de course, l'insertion échoue : on relit
    k = await read();
  }
  if (!k) throw new Error("clés push indisponibles");
  return { publicKey: k.public_key as string, privateKey: k.private_key as string };
}

export type PushPayload = { title: string; body?: string | null; url?: string | null; tag?: string };

/** Envoie une notification à tous les appareils d'un utilisateur ; les appareils qui ne répondent plus sont retirés. */
export async function pushToUser(userId: string, make: (lang: Lang) => PushPayload): Promise<{ sent: number; removed: number }> {
  const sb = createServiceClient();
  const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth,lang").eq("user_id", userId);
  if (!subs?.length) return { sent: 0, removed: 0 };
  const v = await getVapid();
  let sent = 0, removed = 0;
  await Promise.all(subs.map(async (s: Row) => {
    if (!isAllowedPushEndpoint(s.endpoint)) { await sb.from("push_subscriptions").delete().eq("id", s.id); removed++; return; }
    const p = make(s.lang === "en" ? "en" : "fr");
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: p.title, body: p.body ?? "", url: p.url ?? "/notifications", tag: p.tag }),
        { vapidDetails: { subject: SUBJECT, publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 3600, urgency: "normal", timeout: 8000 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from("push_subscriptions").delete().eq("id", s.id); removed++; }
    }
  }));
  return { sent, removed };
}

export const payloadFromNotification = (n: Row) => (lang: Lang): PushPayload => { const x = localizeNotif(n as never, lang); return { title: x.title, body: x.body, url: n.link, tag: n.id }; };
