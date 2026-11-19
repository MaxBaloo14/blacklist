// Notifications push, de bout en bout : abonnement, envoi chiffré vers un faux service push, nettoyage, service worker.
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { launch, BASE, pilotLogin, check } from "./lib.mjs";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));
// Décryptage d'un message Web Push (RFC 8291, aes128gcm) pour vérifier ce qui est réellement envoyé à l'appareil
function decrypt(body, uaPriv, uaPub, authSecret) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.setPrivateKey(uaPriv);
  const secret = ecdh.computeSecret(asPub);
  const prk = hkdf(authSecret, secret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32);
  const cek = hkdf(salt, prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16), nonce = hkdf(salt, prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  let end = plain.length - 1; while (end > 0 && plain[end] === 0) end--;   // retire le remplissage
  return JSON.parse(plain.subarray(0, end).toString());
}

const received = [];
const gone = new Set();
const srv = https.createServer({ key: fs.readFileSync("/tmp/e2e-push-key.pem"), cert: fs.readFileSync("/tmp/e2e-push-cert.pem") }, (req, res) => {
  const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => {
    const path = req.url; if (gone.has(path)) { res.writeHead(410); return res.end(); }
    received.push({ path, headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(201); res.end();
  });
}).listen(9443, "127.0.0.1");

const sub = () => { const e = crypto.createECDH("prime256v1"); e.generateKeys(); return { e, auth: crypto.randomBytes(16) }; };
const psql = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q.replace(/"/g, '\\"')}\\""`).toString().trim();

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); await ctx.grantPermissions(["notifications"], { origin: BASE }); const page = await ctx.newPage();
await page.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "granted" }); } catch {} });   // le navigateur de test sans écran refuse toujours
await pilotLogin(page, "0600000015");
const lioId = psql("select id from profiles where first_name='Lio'");
const post = (url, body, method = "POST") => page.evaluate(async ([u, bdy, m]) => { const r = await fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: bdy ? JSON.stringify(bdy) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; }, [url, body, method]);

// 1. Clé publique stable
const k1 = await (await fetch(BASE + "/api/push/key")).json(), k2 = await (await fetch(BASE + "/api/push/key")).json();
check("clé publique VAPID créée et stable", k1.publicKey?.length > 80 && k1.publicKey === k2.publicKey, k1.publicKey?.slice(0, 20) + "…");
check("clé privée jamais exposée", !JSON.stringify(k1).includes("private"));
// 2. Abonnement
const A = sub(); const epA = "https://127.0.0.1:9443/push/appareil-A";
const s1 = await post("/api/push/subscribe", { subscription: { endpoint: epA, keys: { p256dh: b64u(A.e.getPublicKey()), auth: b64u(A.auth) } }, lang: "fr" });
check("abonnement d'un appareil accepté", s1.status === 200, JSON.stringify(s1.json));
check("l'abonnement est enregistré pour le bon pilote", psql(`select count(*) from push_subscriptions where endpoint='${epA}' and user_id='${lioId}'`) === "1");
for (const [name, ep] of [["adresse http", "http://127.0.0.1:9443/x"], ["service inconnu (SSRF)", "https://169.254.169.254/latest/meta-data"], ["adresse interne", "https://localhost/push"], ["identifiants dans l'adresse", "https://user:pw@fcm.googleapis.com/fcm/send/abcdefghijklmnop"]]) {
  const r = await post("/api/push/subscribe", { subscription: { endpoint: ep, keys: { p256dh: b64u(A.e.getPublicKey()), auth: b64u(A.auth) } } });
  check(`abonnement refusé : ${name}`, r.status === 400, String(r.status));
}
const anon = await fetch(BASE + "/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: { endpoint: epA, keys: { p256dh: "x".repeat(30), auth: "y".repeat(12) } } }) });
check("abonnement refusé sans connexion", anon.status === 401, String(anon.status));
// 3. Envoi réel chiffré
const nid = psql(`insert into notifications(user_id, kind, title, body, link) values ('${lioId}', 'challenge_scheduled', 'Your duel has been scheduled', '20/11 22:00', '/challenges') returning id`).split("\n")[0];
const d1 = await fetch(BASE + "/api/push/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: nid }) });
await new Promise((r) => setTimeout(r, 1200));
const got = received.filter((r) => r.path === "/push/appareil-A");
check("la notification est bien envoyée au service push (1 envoi)", d1.status === 200 && got.length === 1, `${got.length} requête(s)`);
if (got[0]) {
  check("en-tête VAPID présent", /^vapid t=.+,\s*k=.+/.test(got[0].headers.authorization ?? ""), (got[0].headers.authorization ?? "").slice(0, 30));
  check("message chiffré (aes128gcm)", got[0].headers["content-encoding"] === "aes128gcm" && got[0].body.length > 60);
  const msg = decrypt(got[0].body, A.e.getPrivateKey(), A.e.getPublicKey(), A.auth);
  check("le contenu déchiffré est traduit en français", msg.title === "Ton duel est programmé" && msg.url === "/challenges", JSON.stringify(msg));
}
await fetch(BASE + "/api/push/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: nid }) }); await new Promise((r) => setTimeout(r, 600));
check("rejouer l'appel n'envoie rien de plus", received.filter((r) => r.path === "/push/appareil-A").length === 1);
check("dispatch : identifiant invalide refusé", (await fetch(BASE + "/api/push/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "pas-un-uuid" }) })).status === 400);
check("dispatch : identifiant inconnu sans effet", (await (await fetch(BASE + "/api/push/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000000" }) })).json()).ok === true);
// 4. Appareil disparu → retiré
const B = sub(); const epB = "https://127.0.0.1:9443/push/appareil-B"; gone.add("/push/appareil-B");
await post("/api/push/subscribe", { subscription: { endpoint: epB, keys: { p256dh: b64u(B.e.getPublicKey()), auth: b64u(B.auth) } }, lang: "en" });
const nid2 = psql(`insert into notifications(user_id, kind, title) values ('${lioId}', 'challenge_new', 'A new challenge has been issued') returning id`).split("\n")[0];
await fetch(BASE + "/api/push/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: nid2 }) }); await new Promise((r) => setTimeout(r, 1200));
check("appareil qui ne répond plus (410) : abonnement supprimé", psql(`select count(*) from push_subscriptions where endpoint='${epB}'`) === "0");
check("l'autre appareil a bien reçu la 2e notification", received.filter((r) => r.path === "/push/appareil-A").length === 2);
// 5. Envoi de test depuis le profil
const t1 = await post("/api/push/test", {}); await new Promise((r) => setTimeout(r, 800));
check("« Envoyer un test » atteint l'appareil", t1.json?.ok === true && received.filter((r) => r.path === "/push/appareil-A").length === 3, JSON.stringify(t1.json));
// 6. Désabonnement
const del = await post("/api/push/subscribe", { endpoint: epA }, "DELETE");
check("désabonnement d'un appareil", del.status === 200 && psql(`select count(*) from push_subscriptions where endpoint='${epA}'`) === "0");
// 7. Service worker
const r = await fetch(BASE + "/sw.js"); const swHeaders = r.headers.get("cache-control") ?? "";
check("sw.js servi sans cache", r.ok && /no-cache/.test(swHeaders), swHeaders);
const mf = await (await fetch(BASE + "/manifest.webmanifest")).json();
check("manifeste d'application valide (installable)", mf.display === "standalone" && mf.icons?.length >= 2 && mf.start_url === "/", `${mf.name} / ${mf.icons?.length} icônes`);
await page.goto(BASE + "/notifications"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const state = await page.locator("[data-push-state]").first().getAttribute("data-push-state");
check("panneau « Notifications sur ton appareil » affiché", ["off", "on"].includes(state), String(state));
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 8000 }).catch(() => null));
if (sw) {
  // On intercepte showNotification dans le service worker (le navigateur de test n'affiche pas de vraies notifications)
  const shown = await sw.evaluate(async () => {
    const seen = []; self.registration.showNotification = (title, o) => { seen.push({ title, body: o.body, url: o.data?.url, icon: o.icon, tag: o.tag }); return Promise.resolve(); };
    const fire = (payload) => new Promise((resolve) => { const e = new PushEvent("push", { data: JSON.stringify(payload) }); let p; e.waitUntil = (x) => { p = x; }; self.dispatchEvent(e); Promise.resolve(p).then(resolve); });
    await fire({ title: "Ton duel commence dans 1 h", body: "Mika vs Lio", url: "/challenges", tag: "t1" });
    await fire({ title: "x", url: "https://evil.example/", tag: "t2" });
    await fire({ title: "y", url: "javascript:alert(1)", tag: "t3" });
    return seen;
  });
  check("le service worker affiche la notification reçue", shown[0]?.title === "Ton duel commence dans 1 h" && shown[0]?.url === "/challenges" && shown[0]?.icon === "/img/icon-512.png", JSON.stringify(shown[0]));
  check("une adresse externe dans la notification est neutralisée", shown[1]?.url === "/notifications", String(shown[1]?.url));
  check("une adresse javascript: dans la notification est neutralisée", shown[2]?.url === "/notifications", String(shown[2]?.url));
} else check("service worker enregistré", false, "aucun service worker");
srv.close(); await b.close();
