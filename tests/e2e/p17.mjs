import { launch, newPage, BASE, SHOT, pilotLogin, adminPage, act, text, check } from "./lib.mjs";
const b = await launch();
const n = await newPage(b, { width: 1400, height: 900 }); await pilotLogin(n, "0600000015");
await n.goto(BASE + "/profile?tab=rewards"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(3600);
check("avertissement IBAN manquant (onglet Récompenses)", /IBAN manquant/.test(await text(n)));
await n.screenshot({ path: `${SHOT}/150-rewards-no-iban.png`, clip: { x: 0, y: 150, width: 1400, height: 520 } });
await n.goto(BASE + "/profile"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(800);
await n.fill('[name=bank_iban]', "FR76 3000 6000 0112 3456 7890 189"); await n.locator('[name=bank_iban]').focus();
await n.screenshot({ path: `${SHOT}/151-profile-iban.png`, clip: { x: 700, y: 330, width: 700, height: 560 } });
await act(n, "ENREGISTRER", { form: "form:has([name=bank_iban])" });
check("IBAN enregistré", /mises à jour/i.test(await text(n)));
await n.goto(BASE + "/profile?tab=rewards"); await n.waitForLoadState("networkidle"); await n.waitForTimeout(800);
check("avertissement disparu", !/IBAN manquant/.test(await text(n)));
// format invalide
await n.goto(BASE + "/profile"); await n.waitForLoadState("networkidle"); await n.fill('[name=bank_iban]', "<script>x"); await act(n, "ENREGISTRER", { form: "form:has([name=bank_iban])" });
check("format invalide refusé", /invalides/i.test(await text(n)), (await text(n)).slice(-150));
// Admin
const ad = await adminPage(b); await ad.goto(BASE + "/admin/rewards"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(900);
check("l'organisateur voit l'IBAN sur la prime", /FR76 3000 6000/.test(await text(ad)));
await ad.screenshot({ path: `${SHOT}/152-admin-rewards-iban.png`, clip: { x: 250, y: 0, width: 1030, height: 520 } });
const full = await (await ad.request.get(BASE + "/api/export/ranking?full=1")).text();
check("export organisation contient l'IBAN", /IBAN/.test(full) && /FR76 3000/.test(full));
const pub = await (await fetch(BASE + "/api/export/ranking")).text();
check("export public sans IBAN", !/FR76|IBAN/.test(pub));
const pj = await (await fetch(BASE + "/api/blacklist")).text();
check("API publique sans IBAN", !/FR76|bank_iban/.test(pj));
console.log(n.errors, ad.errors); await b.close();
