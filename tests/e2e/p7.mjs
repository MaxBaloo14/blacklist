import { launch, newPage, BASE, SHOT, act, text, check, adminPage, pilotLogin } from "./lib.mjs";
const b = await launch();
// Sécurité : un pilote n'entre pas dans l'admin ; anonyme non plus
const pb = await newPage(b); await pilotLogin(pb, "0600000015");
await pb.goto(BASE + "/admin"); await pb.waitForLoadState("networkidle");
check("pilote refusé dans le Control Center", /\/admin\/login/.test(pb.url()), pb.url());
const an = await newPage(b); await an.goto(BASE + "/admin/drivers"); await an.waitForLoadState("networkidle");
check("visiteur anonyme refusé", /\/admin\/login/.test(an.url()));
await an.goto(BASE + "/challenges"); await an.waitForLoadState("networkidle");
check("visiteur anonyme renvoyé vers la connexion (défis)", /\/login/.test(an.url()), an.url());
// API directe : un pilote ne peut pas appeler une fonction d'admin
const tok = await pb.context().cookies(); 
const r = await fetch("http://127.0.0.1:54321/rest/v1/rpc/admin_set_ranking", { method: "POST", headers: { apikey: "sb_publishable_e2e", "content-type": "application/json" }, body: JSON.stringify({}) });
check("fonction d'admin non appelable en anonyme", r.status >= 400, String(r.status));
// Vidéo invalides
const ad = await adminPage(b); await ad.goto(BASE + "/admin/tracks"); await ad.waitForLoadState("networkidle");
const f = ad.locator('input[type=file][accept^="video"]').nth(1);
await f.evaluate((el) => { let d = el.closest("details"); while (d) { d.open = true; d = d.parentElement?.closest("details"); } });
for (const [file, label] of [["/tmp/e2e-media/fake.mp4", "faux fichier .mp4 refusé"], ["/tmp/e2e-media/big.mp4", "fichier de plus de 20 Mo refusé"]]) {
  await f.setInputFiles(file); await ad.waitForTimeout(1500);
  const box = await f.locator("xpath=ancestor::div[1]").innerText(); const val = await ad.locator('input[name=video_path]').nth(1).inputValue();
  check(label, val === "" && /(trop|invalide|impossible|Mo|vidéo)/i.test(box), box.split("\n").slice(-1)[0]);
}
await ad.screenshot({ path: `${SHOT}/50-video-rejected.png` });
// Anglais
const en = await newPage(b); await en.goto(BASE + "/race-network"); await en.locator('button[aria-label="English"]:visible').first().click(); await en.waitForTimeout(1500);
const te = await text(en); check("version anglaise : titre et libellés traduits", /OFFICIAL|RACE NETWORK|Start|Distance/i.test(te) && !/Départ/.test(te), te.slice(40, 260));
await en.screenshot({ path: `${SHOT}/51-circuits-en.png`, fullPage: true });
await en.goto(BASE + "/blacklist"); await en.screenshot({ path: `${SHOT}/52-blacklist-en.png` });
// Warm-up : programmer une édition
await ad.goto(BASE + "/admin/warmup"); await ad.waitForLoadState("networkidle");
const d = new Date(Date.now() + 5 * 864e5); const pad = (n) => String(n).padStart(2, "0");
await ad.fill('[name=when]', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T20:00`);
await act(ad, "PROGRAMMER LA WARM-UP"); await ad.goto(BASE + "/admin/warmup"); await ad.waitForLoadState("networkidle");
const tw = await text(ad); check("warm-up programmée", /PROGRAMM|INSCRIRE UN PARTICIPANT/i.test(tw));
await ad.screenshot({ path: `${SHOT}/53-admin-warmup.png`, fullPage: true });
const pub = await newPage(b); await pub.goto(BASE + "/warmup"); await pub.waitForLoadState("networkidle"); await pub.screenshot({ path: `${SHOT}/54-warmup-public.png`, fullPage: true });
console.log("erreurs:", pb.errors, an.errors, ad.errors, en.errors, pub.errors);
await b.close();
