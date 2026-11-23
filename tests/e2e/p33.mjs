// Suppression d'un compte pilote depuis la fiche (super administrateur).
import { execSync } from "node:child_process";
import { launch, BASE, SHOT, check, adminPage, text, act } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const b = await launch();
const ID = "90000000-0000-4000-8000-000000000001";
sql(`delete from auth.users where id = '${ID}'`);
sql(`insert into auth.users(id, email) values ('${ID}', 'jetable@test.local')`);
sql(`insert into profiles(id, first_name, last_name, phone, discord_tag, registration_status) values ('${ID}', 'Jetable', 'Essai', '0699000001', 'jetable', 'validated')`);
const ad = await adminPage(b);

// compte vierge : suppression simple, avec saisie de confirmation
await ad.goto(BASE + `/admin/drivers/${ID}`); await ad.waitForLoadState("networkidle");
await ad.locator("summary:has-text('Supprimer ce compte')").click();
const info = (await ad.locator("[data-deletion-info]").innerText()).replace(/\s+/g, " ");
check("résumé avant suppression : aucun historique", /0 duel\(s\) · 0 Cash Prize · 0 sanction\(s\)/.test(info), info);
await ad.screenshot({ path: `${SHOT}/380-supprimer-compte.png`, fullPage: false });
check("pas de case « supprimer l'historique » pour un compte vierge", (await ad.locator("input[name=force]").count()) === 0);
await ad.fill("input[name=confirm]", "oups");
await ad.locator('button:has-text("SUPPRIMER DÉFINITIVEMENT")').click(); await ad.waitForTimeout(600);
const d1 = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await d1.count()) await d1.click();
await ad.waitForTimeout(2000);
check("confirmation incorrecte : refus, le compte existe toujours", /Tape SUPPRIMER/.test((await ad.locator(".toast").allInnerTexts()).join(" ")) && sqlv(`select count(*) from profiles where id = '${ID}'`) === "1");
await ad.fill("input[name=confirm]", "SUPPRIMER");
await ad.locator('button:has-text("SUPPRIMER DÉFINITIVEMENT")').click(); await ad.waitForTimeout(600);
const d2 = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await d2.count()) await d2.click();
await ad.waitForURL(/\/admin\/drivers$/, { timeout: 15000 }).catch(() => {});
await ad.waitForLoadState("networkidle");
check("suppression : retour à la liste des pilotes", /\/admin\/drivers$/.test(ad.url()), ad.url());
check("le compte a disparu (profil, utilisateur, zigollars)", sqlv(`select count(*) from profiles where id = '${ID}'`) === "0" && sqlv(`select count(*) from auth.users where id = '${ID}'`) === "0" && sqlv(`select count(*) from point_balances where user_id = '${ID}'`) === "0");
check("la liste ne montre plus ce pilote", !/Jetable Essai/i.test(await text(ad)));
check("suppression journalisée", /^[1-9]/.test(sqlv("select count(*) from admin_logs where action = 'account:delete'")));

// pilote avec un duel en cours : suppression impossible (message, pas de formulaire)
const mika = sqlv("select id from profiles where first_name = 'Mika'");
await ad.goto(BASE + `/admin/drivers/${mika}`); await ad.waitForLoadState("networkidle");
await ad.locator("summary:has-text('Supprimer ce compte')").click();
check("duel en cours : message explicatif, pas de bouton de suppression", /Un duel est en cours pour ce pilote/.test(await text(ad)) && (await ad.locator('button:has-text("SUPPRIMER DÉFINITIVEMENT")').count()) === 0);

// pilote avec historique mais sans duel en cours : case de confirmation renforcée, refus sans elle
const zane = sqlv("select id from profiles where first_name = 'Zane'");
await ad.goto(BASE + `/admin/drivers/${zane}`); await ad.waitForLoadState("networkidle");
await ad.locator("summary:has-text('Supprimer ce compte')").click();
check("historique de duels : case « supprimer aussi son historique » proposée", (await ad.locator("input[name=force]").count()) === 1 && /[1-9]\d* duel\(s\)/.test((await ad.locator("[data-deletion-info]").innerText())));
await ad.fill("input[name=confirm]", "SUPPRIMER");
await ad.locator('button:has-text("SUPPRIMER DÉFINITIVEMENT")').click(); await ad.waitForTimeout(600);
const d3 = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await d3.count()) await d3.click();
await ad.waitForTimeout(2500);
check("historique sans la case : refus avec explication, compte conservé", /historique/i.test((await ad.locator(".toast").allInnerTexts()).join(" ")) && sqlv(`select count(*) from profiles where id = '${zane}'`) === "1", (await ad.locator(".toast").allInnerTexts()).join(" "));
check("aucune erreur JavaScript", !ad.errors.length, JSON.stringify(ad.errors));
sql(`delete from auth.users where id = '${ID}'`);
await b.close();
