import { launch, newPage, BASE, act, text, adminPage, pilotLogin } from "./lib.mjs";
import { execSync } from "node:child_process";
const b = await launch();
const names = [["Nova","Kael","0600000011"],["Vex","Ryn","0600000012"],["Drift","Zane","0600000013"],["Cobra","Mika","0600000014"],["Saber","Lio","0600000015"]];
const cars = ["Vapid Dominator GT","Annis Elegy RH","Karin Sultan RS","Dinka Jester","Bravado Gauntlet"];
for (const [i, [ln, fn, ph]] of names.entries()) {
  const p = await newPage(b); await p.goto(BASE + "/register");
  await p.fill('[name=last_name]', ln); await p.fill('[name=first_name]', fn); await p.fill('[name=phone]', ph);
  await p.fill('[name=password]', "PiloteTest12345"); await p.fill('[name=make_model]', cars[i]); await p.selectOption('[name=vehicle_class]', { index: 1 });
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
// photos pour les 3 premiers (stockage du banc d'essai)
const rows = execSync(`su postgres -c "psql -d bl_e2e -Atc \\"select v.id||'|'||v.owner_id from vehicles v join blacklist_rankings r on r.driver_id=v.owner_id where r.position<=3 order by r.position\\""`).toString().trim().split("\n");
for (const [k, r] of rows.entries()) {
  const [vid, oid] = r.split("|"); const path = `${oid}/seed${k}.jpg`;
  execSync(`curl -s -X POST -H "apikey: sb_secret_e2e" -H "Authorization: Bearer sb_secret_e2e" -H "Content-Type: image/jpeg" --data-binary @/tmp/e2e-media/car${k + 1}.jpg http://127.0.0.1:54321/storage/v1/object/vehicle-photos/${path}`);
  execSync(`su postgres -c "psql -d bl_e2e -qc \\"update vehicles set photo_path='${path}' where id='${vid}'\\""`);
}
// duel #5 (Lio) défie #4 (Mika), Mika fixe la date, résultat : Lio gagne -> mouvement
const lio = await newPage(b); await pilotLogin(lio, "0600000015"); await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle"); await act(lio, "DÉFIER LE #4");
const mika = await newPage(b); await pilotLogin(mika, "0600000014"); await mika.goto(BASE + "/challenges"); await mika.waitForLoadState("networkidle");
const d = new Date(Date.now() + 2 * 864e5), pad = (n) => String(n).padStart(2, "0");
await mika.fill('[name=when]', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T21:00`); await act(mika, "FIXER LA DATE DU DUEL");
await ad.goto(BASE + "/admin/challenges");
const form = ad.locator("form", { has: ad.locator('button:visible:has-text("ENREGISTRER")') }).first();
await form.locator('[name=winner]').selectOption({ index: 1 }); await form.locator('button:has-text("ENREGISTRER")').click(); await ad.waitForTimeout(1500);
const ok = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok.count()) { await ok.click(); await ad.waitForTimeout(1500); }
await ad.goto(BASE + "/admin/challenges"); await act(ad, "VALIDER LE RÉSULTAT");
// nouveau duel programmé : Mika (maintenant #5) défie Lio (#4) -> "EN DUEL"
await mika.goto(BASE + "/challenges"); await mika.waitForLoadState("networkidle"); await act(mika, "DÉFIER LE #4");
await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle");
await lio.fill('[name=when]', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T22:00`); await act(lio, "FIXER LA DATE DU DUEL");
console.log("seed ok"); await b.close();
