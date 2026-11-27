import { launch, newPage, BASE, SHOT, pilotLogin, adminPage, text, check } from "./lib.mjs";
const b = await launch();
// Calendrier + pronostic
const z = await newPage(b, { width: 1400, height: 1000 }); await pilotLogin(z, "0600000013");
await z.goto(BASE + "/calendar"); await z.waitForLoadState("networkidle"); await z.waitForTimeout(3600);
{
  // le calendrier montre le mois en cours : on attend les duels programmés DANS ce mois (le jeu d'essai est daté par rapport à aujourd'hui, un duel peut tomber le mois suivant)
  const { execSync } = await import("node:child_process");
  const inMonth = Number(execSync(`su postgres -c "psql -d bl_e2e -Atc \\"select count(*) from challenges where status = 'scheduled' and date_trunc('month', scheduled_at at time zone 'Europe/Paris') = date_trunc('month', now() at time zone 'Europe/Paris')\\""`).toString().trim());
  check("calendrier : duels visibles dans la grille", inMonth > 0 && (await z.locator(".cal-ev-duel").count()) >= inMonth, `${await z.locator(".cal-ev-duel").count()} / ${inMonth}`);
}
await z.screenshot({ path: `${SHOT}/180-calendar.png`, fullPage: true });
const firstVote = z.locator(".predict-btn").first(); await firstVote.click(); await z.waitForTimeout(1800);
const t1 = await text(z); check("vote enregistré (1 vote, 100 %)", /1 vote/.test(t1) && /100%|100 %/.test(t1), (t1.match(/PRONOSTIC.{0,80}/) ?? [""])[0]);
// un duelliste ne peut pas voter sur son duel
const lio = await newPage(b, { width: 1400, height: 900 }); await pilotLogin(lio, "0600000015"); await lio.goto(BASE + "/calendar"); await lio.waitForLoadState("networkidle"); await lio.waitForTimeout(3600);
const mine = await lio.locator(".duel-card:has-text('LIO SABER') .predict-btn").count();
check("un duelliste ne peut pas pronostiquer son duel", mine === 0, String(mine));
// visiteur : lecture seule
const v = await newPage(b, { width: 1400, height: 900 }); await v.goto(BASE + "/calendar"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(3600);
check("visiteur : pas de boutons de vote", (await v.locator(".predict-btn").count()) === 0 && /connecte-toi pour pronostiquer/i.test(await text(v)));
// Hall of Fame
await v.goto(BASE + "/hall-of-fame"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(3600);
const th = await text(v); check("hall of fame : 3 rois listés", /KAEL NOVA/.test(th) && /RYN VEX/.test(th) && /ZANE DRIFT/.test(th));
await v.screenshot({ path: `${SHOT}/181-hall.png`, fullPage: true });
// Admin : modèles + picker + stats
const ad = await adminPage(b); await ad.setViewportSize({ width: 1400, height: 900 });
await ad.goto(BASE + "/admin/templates"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(800);
await ad.screenshot({ path: `${SHOT}/182-admin-templates.png`, fullPage: true });
await ad.goto(BASE + "/admin/drivers"); const href = await ad.locator('a[href^="/admin/drivers/"]').first().getAttribute("href"); await ad.goto(BASE + href); await ad.waitForLoadState("networkidle");
const sel = ad.locator("select:has(option:has-text('Insérer un modèle'))").first();
const opt = await sel.locator("option").nth(1).getAttribute("value"); await sel.selectOption(opt); await ad.waitForTimeout(300);
const noteVal = await ad.locator("[name=note]").inputValue();
check("modèle inséré dans le champ de motif", noteVal.length > 10, noteVal.slice(0, 60));
await ad.goto(BASE + "/admin/stats"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(900);
await ad.screenshot({ path: `${SHOT}/183-admin-stats.png`, fullPage: true });
check("stats : graphiques présents", (await ad.locator("figure.chart svg").count()) === 4);
// Nav avec Calendrier
for (const w of [1280, 1500]) { const n = await newPage(b, { width: w, height: 700 }); await pilotLogin(n, "0600000015"); await n.goto(BASE + "/blacklist"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(3600);
  await n.screenshot({ path: `${SHOT}/184-nav-${w}.png`, clip: { x: 0, y: 0, width: w, height: 90 } }); }
console.log(z.errors, v.errors, ad.errors); await b.close();
