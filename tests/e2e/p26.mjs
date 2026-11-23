// Téléphone : plus de bouton hamburger ; la barre du bas contient toutes les rubriques (mêmes noms) et défile au doigt.
import { launch, BASE, SHOT, check, pilotLogin } from "./lib.mjs";
const b = await launch();
async function run(label, logged) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  if (logged) await pilotLogin(p, "0600000015");
  await p.goto(BASE + "/"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(4200);
  check(`${label} : plus de bouton menu en haut`, (await p.locator('button[aria-label="Menu"]:visible').count()) === 0);
  const names = await p.locator(".bottombar-item:not(.bottombar-logout *)").evaluateAll((a) => a.map((x) => x.innerText.trim().toUpperCase()));
  const want = logged ? ["ACCUEIL", "LA BLACKLIST", "CALENDRIER", "CIRCUITS", "RÈGLEMENT", "DISCORD", "MON PROFIL", "RÉCLAMATION", "NOTIFICATIONS"] : ["ACCUEIL", "LA BLACKLIST", "INSCRIPTION", "CALENDRIER", "CIRCUITS", "RÈGLEMENT", "DISCORD", "CONNEXION"];
  check(`${label} : toutes les rubriques, mêmes noms`, want.every((n) => names.some((x) => x.includes(n))), names.join(" | "));
  const m = await p.evaluate(() => { const u = document.querySelector(".bottombar-scroll"); return { sw: u.scrollWidth, cw: u.clientWidth }; });
  check(`${label} : la barre défile (contenu plus large que l'écran)`, m.sw > m.cw + 20, JSON.stringify(m));
  const hidden = await p.locator('.bottombar-item:has-text("DISCORD")').first().evaluate((el) => el.getBoundingClientRect().right > innerWidth);
  await p.locator(".bottombar-scroll").evaluate((u) => { u.scrollLeft = u.scrollWidth; }); await p.waitForTimeout(500);
  const visible = await p.locator(".bottombar-scroll li").last().evaluate((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= 0; });
  check(`${label} : en faisant défiler, le dernier onglet devient visible`, visible);
  await p.screenshot({ path: `${SHOT}/250-bar-${label}.png`, clip: { x: 0, y: 0, width: 390, height: 844 } });
  await p.locator(".bottombar-scroll").evaluate((u) => { u.scrollLeft = 0; }); await p.waitForTimeout(300);
  await p.locator('.bottombar-item:has-text("CALENDRIER")').first().click(); await p.waitForTimeout(1500);
  check(`${label} : un onglet emmène sur la bonne page`, /\/calendar/.test(p.url()), p.url());
  const bottom = await p.evaluate(() => { const b = document.querySelector(".bottombar").getBoundingClientRect(); return Math.round(innerHeight - b.bottom); });
  check(`${label} : la barre reste collée en bas`, bottom <= 1, String(bottom));
  await ctx.close();
}
await run("visiteur", false);
await run("pilote", true);
const d = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); await d.goto(BASE + "/"); await d.waitForLoadState("networkidle"); await d.waitForTimeout(3500);
check("ordinateur : barre du bas masquée, menu du haut inchangé", (await d.locator(".bottombar-item:visible").count()) === 0 && (await d.locator('nav a[href="/calendar"]:visible').count()) >= 1);
await b.close();
