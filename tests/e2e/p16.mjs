import { launch, newPage, BASE, SHOT, pilotLogin, adminPage, text, check } from "./lib.mjs";
const b = await launch();
// Rappel : le duel est dans 23 h -> rappel 24 h apparaît dans la cloche
const n = await newPage(b, { width: 1500, height: 800 }); await pilotLogin(n, "0600000015");
await n.goto(BASE + "/blacklist"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(4500);
await n.locator("button.bell:visible").first().click(); await n.waitForTimeout(1200);
const panel = await n.locator(".bell-panel").innerText();
check("rappel 24 h dans la cloche", /24 h/.test(panel), panel.split("\n").slice(0, 6).join(" | "));
await n.screenshot({ path: `${SHOT}/140-reminder-bell.png`, clip: { x: 700, y: 0, width: 800, height: 420 } });
// L'autre pilote aussi
const m = await newPage(b, { width: 1500, height: 800 }); await pilotLogin(m, "0600000014"); await m.goto(BASE + "/notifications"); await m.waitForLoadState("networkidle"); await m.waitForTimeout(3600);
check("l'adversaire reçoit aussi le rappel", /24 h/.test(await text(m)));
await m.screenshot({ path: `${SHOT}/141-reminder-page.png`, clip: { x: 0, y: 100, width: 1100, height: 520 } });
// Frise
const p = await newPage(b, { width: 1400, height: 900 }); await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3600);
await p.locator('a[href^="/blacklist/"]:has-text("LIO SABER")').first().click(); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
await p.locator("text=FRISE DES DUELS").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
await p.screenshot({ path: `${SHOT}/142-timeline.png` });
check("frise : 4 duels", (await p.locator(".tline li").count()) === 4, String(await p.locator(".tline li").count()));
// Exports
const ad = await adminPage(b); await ad.goto(BASE + "/admin/exports"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(800);
await ad.screenshot({ path: `${SHOT}/143-admin-exports.png` });
const full = await ad.request.get(BASE + "/api/export/ranking?full=1"); const fullTxt = await full.text();
check("export classement organisation (téléphones)", full.ok() && /Téléphone/.test(fullTxt) && /0600000015/.test(fullTxt), fullTxt.split("\r\n").slice(0, 3).join(" // "));
const fd = await ad.request.get(BASE + "/api/export/duels?full=1"); const fdTxt = await fd.text();
check("export duels organisation", fd.ok() && fdTxt.split("\r\n").length >= 5, fdTxt.split("\r\n").slice(0, 3).join(" // "));
const pub = await fetch(BASE + "/api/export/ranking"); const pubTxt = await pub.text();
check("export public sans téléphone", pub.ok && !/Téléphone|06000000/.test(pubTxt) && /Position/.test(pubTxt), pubTxt.split("\r\n").slice(0, 3).join(" // "));
const pf = await fetch(BASE + "/api/export/ranking?full=1");
check("version organisation refusée aux visiteurs", pf.status === 403, String(pf.status));
const pd = await fetch(BASE + "/api/export/duels"); const pdTxt = await pd.text();
check("export public des duels", pd.ok && /Rang challenger/.test(pdTxt), pdTxt.split("\r\n").slice(0, 3).join(" // "));
console.log(n.errors, m.errors, p.errors, ad.errors); await b.close();
