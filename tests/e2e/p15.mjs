import { launch, newPage, BASE, SHOT } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1400, height: 1000 }); await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3800);
await p.locator("h2:has-text('asphalte')").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(1000);
await p.mouse.wheel(0, 300); await p.waitForTimeout(600); await p.screenshot({ path: `${SHOT}/130-duel-detail.png` });
const m = await newPage(b, { width: 390, height: 900 }); await m.goto(BASE + "/blacklist"); await m.waitForLoadState("networkidle"); await m.waitForTimeout(3800);
await m.locator("h2:has-text('asphalte')").first().scrollIntoViewIfNeeded(); await m.waitForTimeout(800);
await m.screenshot({ path: `${SHOT}/131-duel-detail-mobile.png`, fullPage: false });
console.log(p.errors, m.errors); await b.close();
