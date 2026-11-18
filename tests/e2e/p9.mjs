import { launch, newPage, BASE, SHOT, adminPage, act } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1400, height: 520 });
await p.goto(BASE + "/race-network"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200);
await p.hover('nav a:has-text("RÈGLEMENT")'); await p.waitForTimeout(600);
await p.screenshot({ path: `${SHOT}/70-nav-tabs.png`, clip: { x: 0, y: 0, width: 1400, height: 90 } });
const m = await newPage(b, { width: 390, height: 700 }); await m.goto(BASE + "/race-network"); await m.waitForLoadState("networkidle");
// pilote connecté : onglets du profil
const pl = await newPage(b, { width: 1400, height: 800 }); await pl.goto(BASE + "/login");
await pl.fill('[name=phone]', "0600000001"); await pl.fill('[name=password]', "NouveauSecret2026"); await act(pl, "SE CONNECTER"); await pl.waitForURL(/profile/).catch(() => {});
await pl.goto(BASE + "/profile?tab=garage"); await pl.waitForLoadState("networkidle"); await pl.waitForTimeout(800);
await pl.hover('[role=tab]:has-text("DÉFIS")'); await pl.waitForTimeout(600);
await pl.screenshot({ path: `${SHOT}/71-profile-tabs.png`, clip: { x: 0, y: 0, width: 1400, height: 420 } });
await pl.screenshot({ path: `${SHOT}/72-nav-loggedin.png`, clip: { x: 0, y: 0, width: 1400, height: 90 } });
const ad = await adminPage(b); await ad.goto(BASE + "/admin/vehicles"); await ad.waitForLoadState("networkidle"); await ad.hover('aside a:has-text("PILOTES")'); await ad.waitForTimeout(600);
await ad.screenshot({ path: `${SHOT}/73-admin-sidebar.png`, clip: { x: 0, y: 0, width: 300, height: 760 } });
console.log(p.errors, pl.errors, ad.errors); await b.close();
