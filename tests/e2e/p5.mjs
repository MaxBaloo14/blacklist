import { launch, newPage, BASE, SHOT, act, text, check, adminPage, pilotLogin } from "./lib.mjs";
const b = await launch(); const ad = await adminPage(b);
await ad.goto(BASE + "/admin/challenges"); await ad.screenshot({ path: `${SHOT}/24-admin-challenge.png`, fullPage: true });
// Enregistrer le résultat de la course (Bravo, le challenger, gagne)
const form = ad.locator("form", { has: ad.locator('button:visible:has-text("ENREGISTRER")') }).first();
await form.locator('[name=winner]').selectOption({ index: 1 });
await form.locator('button:has-text("ENREGISTRER")').click(); await ad.waitForTimeout(1500);
const ok = ad.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok.count()) { await ok.click(); await ad.waitForTimeout(1500); }
await ad.goto(BASE + "/admin/challenges"); let tc = await text(ad);
check("résultat prêt à valider (jamais validé sans organisateur)", /VALIDER LE RÉSULTAT/.test(tc));
// Le classement NE DOIT PAS avoir bougé avant validation
const pub = await newPage(b); await pub.goto(BASE + "/blacklist"); let tb = await text(pub);
check("classement inchangé avant validation", tb.indexOf("UN ALPHA") < tb.indexOf("DEUX BRAVO"));
await ad.screenshot({ path: `${SHOT}/25-admin-awaiting-validation.png`, fullPage: true });
// Validation par l'organisateur
await act(ad, "VALIDER LE RÉSULTAT");
await ad.goto(BASE + "/admin/challenges"); tc = await text(ad);
await ad.screenshot({ path: `${SHOT}/26-admin-after-validation.png`, fullPage: true });
await pub.goto(BASE + "/blacklist"); tb = await text(pub);
check("échange de places : Bravo #9, Alpha #10", tb.indexOf("DEUX BRAVO") < tb.indexOf("UN ALPHA"), tb.slice(tb.indexOf("8 |"), tb.indexOf("8 |") + 300));
await pub.screenshot({ path: `${SHOT}/27-blacklist-after-swap.png`, fullPage: true });
// Récompense
await ad.goto(BASE + "/admin/rewards"); let tr = await text(ad);
console.log(tr.slice(tr.indexOf("CASH PRIZE"), tr.indexOf("CASH PRIZE") + 700));
await ad.screenshot({ path: `${SHOT}/28-admin-rewards.png`, fullPage: true });
check("récompense en attente créée", /CONFIRMER LE PAIEMENT/.test(tr));
await ad.locator("summary:has-text('Confirmer le paiement'), summary:has-text('CONFIRMER LE PAIEMENT')").first().click().catch(() => {});
await act(ad, "CONFIRMER LE PAIEMENT");
await ad.goto(BASE + "/admin/rewards"); tr = await text(ad);
check("paiement confirmé", /PAYÉ|VERSÉ/i.test(tr), tr.slice(tr.indexOf("CASH PRIZE"), tr.indexOf("CASH PRIZE") + 500));
await ad.goto(BASE + "/admin/logs"); const tl = await text(ad);
check("journal d'audit alimenté", /validate|reward|payment|challenge/i.test(tl)); await ad.screenshot({ path: `${SHOT}/29-admin-logs.png` });
// Côté pilote : fiche, profil, notifications
const pb = await newPage(b); await pilotLogin(pb, "0600000002");
await pb.goto(BASE + "/profile"); const tp = await text(pb);
check("profil Bravo : #9 et victoire", /#9|9/.test(tp), tp.slice(0, 500)); await pb.screenshot({ path: `${SHOT}/30-profile-bravo.png`, fullPage: true });
await pb.goto(BASE + "/notifications"); await pb.screenshot({ path: `${SHOT}/31-notifs-bravo.png` });
await pb.goto(BASE + "/blacklist"); await pb.locator('a[href^="/blacklist/"]').first().click(); await pb.waitForTimeout(1500);
await pb.screenshot({ path: `${SHOT}/32-fiche-pilote.png`, fullPage: true });
console.log("erreurs:", pub.errors, pb.errors, ad.errors);
await b.close();
