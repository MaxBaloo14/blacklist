import { launch, newPage, BASE, SHOT, text, act, adminPage } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1400, height: 900 });
await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1800);
await p.screenshot({ path: `${SHOT}/80-blacklist-podium.png`, fullPage: true });
await p.hover('a[href^="/blacklist/"] >> nth=3'); await p.waitForTimeout(700);
await p.screenshot({ path: `${SHOT}/81-row-hover.png`, clip: { x: 0, y: 560, width: 1400, height: 340 } });
const m = await newPage(b, { width: 390, height: 900 }); await m.goto(BASE + "/blacklist"); await m.waitForLoadState("networkidle"); await m.waitForTimeout(1500);
await m.screenshot({ path: `${SHOT}/82-blacklist-mobile.png`, fullPage: true });
// transition de page : image 150 ms après le clic
await p.goto(BASE + "/race-network"); await p.waitForLoadState("networkidle");
await p.locator('nav a:has-text("LA BLACKLIST")').first().click(); await p.waitForTimeout(160);
await p.screenshot({ path: `${SHOT}/83-transition.png`, clip: { x: 0, y: 0, width: 1400, height: 500 } });
// formulaires : focus + message
const f = await newPage(b, { width: 1100, height: 900 }); await f.goto(BASE + "/register"); await f.waitForLoadState("networkidle"); await f.waitForTimeout(3500);
await f.fill('[name=last_name]', "Test"); await f.focus('[name=phone]');
await f.screenshot({ path: `${SHOT}/84-form-focus.png`, clip: { x: 150, y: 100, width: 800, height: 560 } });
await f.goto(BASE + "/login"); await f.fill('[name=phone]', "0600000011"); await f.fill('[name=password]', "mauvais"); await act(f, "SE CONNECTER");
await f.screenshot({ path: `${SHOT}/85-form-error.png`, clip: { x: 300, y: 200, width: 560, height: 420 } });
console.log(p.errors, m.errors, f.errors); await b.close();
