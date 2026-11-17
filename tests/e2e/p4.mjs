import { launch, newPage, BASE, SHOT, act, text, check, adminPage, pilotLogin } from "./lib.mjs";
const b = await launch();
// Bravo (#10) défie Alpha (#9)
const pb = await newPage(b); await pilotLogin(pb, "0600000002");
await pb.goto(BASE + "/challenges"); await pb.screenshot({ path: `${SHOT}/20-challenges-bravo.png` });
check("Bravo voit sa cible #9", /DÉFIER LE #9/i.test(await text(pb)));
await act(pb, "DÉFIER LE #9");
const tb = await text(pb); check("défi lancé", /DÉFIS EN COURS/.test(tb) && /ATTENTE|48/i.test(tb), tb.slice(tb.indexOf("DÉFIS EN COURS"), tb.indexOf("DÉFIS EN COURS") + 300));
await pb.screenshot({ path: `${SHOT}/21-challenge-launched.png` });
// Alpha fixe la date
const pa = await newPage(b); await pilotLogin(pa, "0600000001");
await pa.goto(BASE + "/challenges");
const d = new Date(Date.now() + 3 * 864e5); const pad = (n) => String(n).padStart(2, "0");
await pa.fill('[name=when]', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T21:00`);
await act(pa, "FIXER LA DATE DU DUEL");
const ta = await text(pa); check("date fixée côté défendeur", /PROGRAMM|Date du duel enregistrée/i.test(ta), ta.slice(ta.indexOf("DÉFIS EN COURS"), ta.indexOf("DÉFIS EN COURS") + 500));
await pa.screenshot({ path: `${SHOT}/22-alpha-scheduled.png` });
// Notifications
await pb.goto(BASE + "/notifications"); const tn = await text(pb);
check("Bravo notifié de la date", /date|programm/i.test(tn), tn.slice(0, 300));
await pb.screenshot({ path: `${SHOT}/23-notifications.png` });
// Admin : résultats
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/challenges"); await ad.screenshot({ path: `${SHOT}/24-admin-challenge.png`, fullPage: true });
let n = 0;
while (n++ < 4) {
  await ad.goto(BASE + "/admin/challenges");
  const btn = ad.locator('button:visible:has-text("ENREGISTRER")');
  if (!(await btn.count())) break;
  const form = ad.locator("form", { has: ad.locator('button:visible:has-text("ENREGISTRER")') }).first();
  await form.locator('[name=winner]').selectOption({ index: 1 }); // challenger
  await form.locator('button:has-text("ENREGISTRER")').click(); await ad.waitForTimeout(1500);
  const ok = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok.count()) { await ok.click(); await ad.waitForTimeout(1500); }
}
await ad.goto(BASE + "/admin/challenges"); const tc = await text(ad);
console.log(tc.slice(tc.indexOf("CHALLENGES") , tc.indexOf("CHALLENGES") + 900));
check("résultat prêt à valider", /VALIDER LE RÉSULTAT/.test(tc));
await ad.screenshot({ path: `${SHOT}/25-admin-awaiting-validation.png`, fullPage: true });
console.log("erreurs:", pb.errors, pa.errors, ad.errors);
await b.close();
