import { launch, newPage, BASE, act, text, adminPage, pilotLogin, fillSlots, pickSlot, pickVehicle } from "./lib.mjs";
import { execSync } from "node:child_process";
const b = await launch();
const names = [["Nova","Kael","0600000011"],["Vex","Ryn","0600000012"],["Drift","Zane","0600000013"],["Cobra","Mika","0600000014"],["Saber","Lio","0600000015"]];
const cars = ["Dominator GT","Elegy RH8","Sultan RS Super","Jester Modern","Gauntlet V8"];   // recherches dans la liste des véhicules autorisés
for (const [i, [ln, fn, ph]] of names.entries()) {
  const p = await newPage(b); await p.goto(BASE + "/register");
  await p.fill('[name=last_name]', ln); await p.fill('[name=first_name]', fn); await p.fill('[name=phone]', ph);
  await p.fill("[name=password]", "PiloteTest12345");
  await pickVehicle(p, cars[i]);
  await act(p, "ENVOYER"); await p.context().close();
}
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/drivers");
const hrefs = await ad.locator('a[href^="/admin/drivers/"]').evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")))]);
for (const h of hrefs) { await ad.goto(BASE + h); await ad.selectOption('[name=decision]', "validated"); await act(ad, "ENREGISTRER LA DÉCISION"); }
for (let i = 0; i < 5; i++) { await ad.goto(BASE + "/admin/vehicles"); if (!(await ad.locator('button:has-text("HOMOLOGUER")').count())) break; await act(ad, "HOMOLOGUER"); }
await ad.goto(BASE + "/admin/ranking");
for (const [pos, n] of [[1, "Kael"], [2, "Ryn"], [3, "Zane"], [4, "Mika"], [5, "Lio"]]) { const s = ad.locator(`[name=pos${pos}]`); await s.selectOption(await s.locator("option", { hasText: n }).first().getAttribute("value")); }
await ad.fill('[name=reason]', "Mise en place"); await act(ad, "APPLIQUER LA MODIFICATION");
// duel #5 (Lio) défie #4 (Mika), Mika fixe la date, résultat : Lio gagne -> mouvement
const lio = await newPage(b); await pilotLogin(lio, "0600000015"); await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle"); await fillSlots(lio); await act(lio, "DÉFIER LE #4");
const mika = await newPage(b); await pilotLogin(mika, "0600000014"); await mika.goto(BASE + "/challenges"); await mika.waitForLoadState("networkidle");
await pickSlot(mika); await act(mika, "CONFIRMER CE CRÉNEAU");
// les jour et l'heure se choisissent entre 21 h et 00 h : pour les tests, on avance le duel à « dans 2 h » directement en base
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
sql("update challenges set scheduled_at = now() + interval '2 hours' where status = 'scheduled'");
await ad.goto(BASE + "/admin/challenges");
const form = ad.locator("form", { has: ad.locator('button:visible:has-text("ENREGISTRER")') }).first();
await form.locator('[name=winner]').selectOption({ index: 1 }); await form.locator('button:has-text("ENREGISTRER")').click(); await ad.waitForTimeout(1500);
const ok = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok.count()) { await ok.click(); await ad.waitForTimeout(1500); }
await ad.goto(BASE + "/admin/challenges"); await act(ad, "VALIDER LE RÉSULTAT");
// nouveau duel programmé : Mika (maintenant #5) défie Lio (#4) -> "EN DUEL"
await mika.goto(BASE + "/challenges"); await mika.waitForLoadState("networkidle"); await fillSlots(mika); await act(mika, "DÉFIER LE #4");
await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle");
await pickSlot(lio); await act(lio, "CONFIRMER CE CRÉNEAU");
sql("update challenges set scheduled_at = now() + interval '3 hours' where status = 'scheduled'");
console.log("seed ok"); await b.close();
