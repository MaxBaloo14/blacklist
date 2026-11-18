import { launch, newPage, BASE, SHOT, pilotLogin, text } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1400, height: 900 });
await p.goto(BASE + "/"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3800);
await p.mouse.wheel(0, 650); await p.waitForTimeout(1500);
await p.screenshot({ path: `${SHOT}/90-home-preview.png` });
await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3500);
const duels = p.locator(".duel-card").first(); await duels.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
await p.locator("h2:has-text('asphalte')").first().scrollIntoViewIfNeeded();
await p.screenshot({ path: `${SHOT}/91-duel-cards.png` });
// fiche pilote avec badges
const href = await p.locator('a[href^="/blacklist/"]').first().getAttribute("href"); await p.goto(BASE + href); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${SHOT}/92-fiche-badges.png`, clip: { x: 0, y: 0, width: 1400, height: 700 } });
const lio = await p.goto(BASE + "/blacklist"); await p.locator('a[href^="/blacklist/"]:has-text("LIO SABER")').first().click(); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${SHOT}/93-fiche-lio.png`, clip: { x: 0, y: 0, width: 1400, height: 620 } });
// squelette : on retarde la page pour voir le chargement
const s = await newPage(b, { width: 1400, height: 800 }); await s.goto(BASE + "/race-network"); await s.waitForLoadState("networkidle"); await s.waitForTimeout(3500);
await s.route("**/blacklist**", async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
await s.locator('nav a:has-text("LA BLACKLIST")').first().click(); await s.waitForTimeout(900);
await s.screenshot({ path: `${SHOT}/94-skeleton.png` });
// cloche
const n = await newPage(b, { width: 1500, height: 800 }); await pilotLogin(n, "0600000015"); await n.goto(BASE + "/blacklist"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(3500);
await n.locator("button.bell:visible").first().click(); await n.waitForTimeout(1200);
await n.screenshot({ path: `${SHOT}/95-bell.png`, clip: { x: 700, y: 0, width: 800, height: 520 } });
console.log(p.errors, s.errors, n.errors); await b.close();
