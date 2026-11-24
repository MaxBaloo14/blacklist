// Boutique : édition limitée (badge, compte à rebours, « plus que N »), disparition à l'échéance.
import { execSync } from "node:child_process";
import { launch, BASE, SHOT, check, newPage, text, pilotLogin } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const b = await launch();
sql(`delete from shop_items where name in ('Casque doré', 'Bidon périmé')`);
sql(`insert into shop_items(name, description, category, price, stock, limited, ends_at, sort) values ('Casque doré', 'Série limitée, une fois épuisé il ne revient pas.', 'Accessoires', 500, 3, true, now() + interval '2 hours', 1)`);
sql(`insert into shop_items(name, category, price, limited, ends_at, sort) values ('Bidon périmé', 'Accessoires', 500, true, now() - interval '1 hour', 2)`);
const z = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(z, "0600000013");
await z.goto(BASE + "/boutique"); await z.waitForLoadState("networkidle"); await z.waitForTimeout(3500);
const card = z.locator("article", { hasText: "Casque doré" });
check("édition limitée : badge visible", (await card.locator("[data-limited]").count()) === 1);
check("compte à rebours affiché (« Se termine dans »)", (await card.locator("[data-ends]").count()) === 1 && /Se termine dans/i.test(await card.locator("[data-ends]").innerText()) && /^0[12]:\d\d:\d\d/.test((await card.locator("[data-ends]").innerText()).trim()), await card.locator("[data-ends]").allInnerTexts().then((a) => a.join("|")));
check("stock bas : « Plus que 3 ! »", /Plus que 3/i.test(await card.innerText()));
check("article terminé : n'apparaît pas", !/Bidon périmé/i.test(await text(z)));
await card.scrollIntoViewIfNeeded(); await z.screenshot({ path: `${SHOT}/394-edition-limitee.png`, fullPage: false });
// admin : le formulaire propose la date de fin
const { adminPage } = await import("./lib.mjs");
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/shop"); await ad.waitForLoadState("networkidle");
check("admin : champ « Disponible jusqu'au » et case « Édition limitée »", (await ad.locator("input[name=ends_at]").count()) >= 1 && (await ad.locator("input[name=limited]").count()) >= 1);
// achat jusqu'à la fin du stock puis après échéance
sql(`update shop_items set ends_at = now() - interval '1 minute' where name = 'Casque doré'`);
await z.goto(BASE + "/boutique"); await z.waitForLoadState("networkidle");
check("après l'échéance : l'article disparaît de la boutique", !/Casque doré/i.test(await text(z)));
check("aucune erreur JavaScript", !(z.errors ?? []).length && !(ad.errors ?? []).length);
sql(`delete from shop_items where name in ('Casque doré', 'Bidon périmé')`);
await b.close();
