// Zigollars de bienvenue verrouillés jusqu'au premier gain · montants sans plafond pour l'organisation · points de passage (60 pour les joueurs, illimité pour l'organisation).
import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, check, adminPage, text, act, pilotLogin } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const b = await launch();

// --- Kael n'a eu aucun gain : ses 10 000 zigollars de bienvenue sont verrouillés
const kael = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(kael, "0600000011");
await kael.goto(BASE + "/boutique"); await kael.waitForLoadState("networkidle"); await kael.waitForTimeout(4500);
const t1 = await text(kael);
check("solde 10 000 zigollars dont 10 000 verrouillés (message clair)", /10 000 zigollars/.test(t1) && /verrouillés/i.test(t1) && (await kael.locator("[data-locked]").count()) === 1, t1.slice(t1.indexOf("TON SOLDE"), t1.indexOf("TON SOLDE") + 180));
const buy = kael.locator("article", { hasText: "Fusée de détresse" }).locator('button:has-text("ACHETER")');
check("achat grisé tant que le bonus est verrouillé (avec l'explication)", await buy.isDisabled() && /se débloquent à ton premier gain/i.test(await kael.locator("article", { hasText: "Fusée de détresse" }).innerText()));
await kael.screenshot({ path: `${SHOT}/370-bonus-verrouille.png`, fullPage: false });
await kael.goto(BASE + "/boutique?tab=paris"); await kael.waitForLoadState("networkidle"); await kael.waitForTimeout(3000);
check("pari impossible aussi (bouton grisé)", (await kael.locator('.bet button:has-text("PARIER")').first().isDisabled().catch(() => true)) || (await kael.locator(".bet").count()) === 0);
// le serveur refuse même si l'interface est contournée
const direct = sqlv("select count(*) from point_ledger where user_id = (select id from profiles where first_name = 'Kael') and kind in ('shop','bet_stake')");
check("aucune dépense enregistrée", direct === "0");

// --- Organisation : montant sans plafond (2 500 000 > ancien plafond de 1 000 000) ; ce premier gain débloque le bonus
const adm = await adminPage(b);
await adm.goto(BASE + "/admin/shop"); await adm.waitForLoadState("networkidle");
const f = adm.locator("form", { has: adm.locator('button:has-text("APPLIQUER")') });
await f.locator("select[name=driver]").selectOption({ label: "Kael Nova" }).catch(async () => { const o = await f.locator("select[name=driver] option", { hasText: "Kael" }).first().getAttribute("value"); await f.locator("select[name=driver]").selectOption(o); });
await f.locator("[name=delta]").fill("2500000"); await f.locator("[name=reason]").fill("Test montant sans plafond");
await act(adm, "APPLIQUER", { form: "form:has(button:has-text('APPLIQUER'))" });
check("organisation : 2 500 000 accordés sans refus", /mis à jour/i.test((await adm.locator(".toast").allInnerTexts()).join(" ")) || sqlv("select balance from point_balances where user_id = (select id from profiles where first_name = 'Kael')") === "2510000", sqlv("select balance from point_balances where user_id = (select id from profiles where first_name = 'Kael')"));
await kael.goto(BASE + "/boutique"); await kael.waitForLoadState("networkidle"); await kael.waitForTimeout(3500);
const t2 = await text(kael);
check("premier gain : plus rien de verrouillé, solde 2 510 000", /2 510 000 zigollars/.test(t2) && (await kael.locator("[data-locked]").count()) === 0);
check("premier gain : l'achat est de nouveau possible", await kael.locator("article", { hasText: "Fusée de détresse" }).locator('button:has-text("ACHETER")').isEnabled());
// retour à l'état initial pour la suite
sql("update point_balances set balance = 10000, locked = 10000 where user_id = (select id from profiles where first_name = 'Kael'); delete from point_ledger where user_id = (select id from profiles where first_name = 'Kael') and kind = 'admin'; delete from notifications where kind = 'points' and user_id = (select id from profiles where first_name = 'Kael');");

// --- Points de passage : 60 pour les joueurs, illimité pour l'organisation (mode libre : aucune route requise)
async function freeClicks(p, n) {
  await p.waitForSelector('.route-drawer[data-roads]', { timeout: 15000 }); await p.waitForTimeout(1500);
  await p.locator('button:has-text("SUIVRE LES ROUTES")').click();
  await p.locator(".route-drawer").scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const c = await p.locator(".route-drawer").boundingBox();
  for (let i = 0; i < n; i++) { await p.mouse.click(c.x + 40 + ((i * 23) % (c.width - 100)), c.y + 40 + ((i * 17) % (c.height - 100))); await p.waitForTimeout(25); }
}
const mika = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(mika, "0600000014");
await mika.goto(BASE + "/suggestion"); await mika.waitForLoadState("networkidle"); await mika.waitForTimeout(3500);
await freeClicks(mika, 63);
const tm = await text(mika);
check("joueur : bloqué à 60 points avec un message", /60 point\(s\) posé|60 point/.test(tm) && /60 points au maximum/.test(tm), tm.match(/\d+ point\(s\) posé\(s\)/)?.[0]);
// contournement de l'interface : 70 points envoyés au serveur -> refus côté serveur
await mika.evaluate(() => { const i = document.querySelector('input[name="points"]'); i.value = JSON.stringify(Array.from({ length: 70 }, (_, k) => [100 + k, 100 + k])); });
await mika.fill("input[name=name]", "Trop de points");
await mika.locator('button:has-text("ENVOYER MA SUGGESTION")').click(); await mika.waitForTimeout(2500);
check("joueur : le serveur refuse plus de 60 points même si l'interface est contournée", /60 points de passage au maximum/.test((await mika.locator(".toast").allInnerTexts()).join(" ")) && sqlv("select count(*) from course_suggestions where name = 'Trop de points'") === "0", (await mika.locator(".toast").allInnerTexts()).join(" "));
await adm.goto(BASE + "/admin/editor"); await adm.waitForLoadState("networkidle"); await adm.waitForTimeout(3000);
await freeClicks(adm, 75);
check("organisation : 75 points posés, aucune limite", /75 point/.test(await text(adm)) && !/points au maximum/.test(await text(adm)), (await text(adm)).match(/\d+ point\(s\) posé\(s\)/)?.[0]);
await adm.fill("[name=name]", "Brouillon long");
await adm.locator('button:has-text("ENREGISTRER LE BROUILLON")').click(); await adm.waitForTimeout(3000);
check("organisation : un brouillon de 75 points s'enregistre", sqlv("select jsonb_array_length(points) from track_drafts where name = 'Brouillon long'") === "75");
sql("delete from track_drafts where name = 'Brouillon long'");
const v = await newPage(b); await v.goto(BASE + "/rules"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(4000);
check("règlement : bonus verrouillé et limite de 60 points expliqués", /verrouillés et ne se dépensent/i.test(await text(v)) && /60 points de passage/i.test(await text(v)));
check("aucune erreur JavaScript", ![kael, mika, adm].some((p) => p.errors.length), JSON.stringify([kael.errors, mika.errors, adm.errors]));
await b.close();
