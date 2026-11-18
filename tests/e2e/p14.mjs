import { launch, newPage, BASE, SHOT } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1400, height: 900 }); await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3800);
await p.screenshot({ path: `${SHOT}/120-demo-podium.png`, fullPage: true });
const links = await p.locator('a[href^="/blacklist/"]').evaluateAll((a) => a.map((x) => x.getAttribute("href")));
await p.goto(BASE + links[1]); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${SHOT}/121-demo-oby.png`, clip: { x: 0, y: 0, width: 1400, height: 760 } });
await p.goto(BASE + "/"); await p.waitForLoadState("networkidle");
console.log(p.errors); await b.close();
