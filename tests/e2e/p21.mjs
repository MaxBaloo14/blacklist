import { launch, BASE, SHOT, pilotLogin, text, check } from "./lib.mjs";
const b = await launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// Visiteur : barre du bas
const v = await (await b.newContext(mobile)).newPage(); await v.goto(BASE + "/blacklist"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(3800);
check("visiteur : barre du bas visible (5 onglets)", (await v.locator(".bottombar-item:visible").count()) === 5);
await v.screenshot({ path: `${SHOT}/200-bottom-visitor.png` });
await v.locator('.bottombar-item:has-text("Calendrier")').click(); await v.waitForTimeout(1500);
check("la barre navigue vers le calendrier", /\/calendar/.test(v.url()));
// Desktop : pas de barre
const d = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); await d.goto(BASE + "/blacklist"); await d.waitForLoadState("networkidle");
check("ordinateur : barre du bas masquée", (await d.locator(".bottombar-item:visible").count()) === 0);
// Pilote : barre + alerte IBAN
const pctx = await b.newContext(mobile); const p = await pctx.newPage(); await pilotLogin(p, "0600000015");
await p.goto(BASE + "/notifications"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3800);
const tn = await text(p);
check("notification « Ajoute ton IBAN » reçue par le gagnant sans IBAN", /Ajoute ton IBAN pour recevoir ton Cash Prize/.test(tn) && /ne peut pas être versé/.test(tn), (tn.match(/Ajoute ton IBAN.{0,120}/) ?? [""])[0]);
check("pilote : barre du bas avec Défis, Alertes, Profil", (await p.locator('.bottombar-item:has-text("Défis"), .bottombar-item:has-text("Alertes"), .bottombar-item:has-text("Profil")').count()) === 3);
await p.screenshot({ path: `${SHOT}/201-bottom-pilot-notif.png` });
// Après saisie de l'IBAN, plus de relance au prochain gain (pas testé ici) ; version anglaise
await p.context().addCookies([{ name: "lang", value: "en", url: BASE }]); await p.goto(BASE + "/notifications"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3800);
const te = await text(p);
check("notification IBAN en anglais", /Add your IBAN to receive your Cash Prize/.test(te), (te.match(/Add your IBAN.{0,100}/) ?? [""])[0]);
await p.screenshot({ path: `${SHOT}/202-bottom-pilot-en.png` });
// Accueil desktop (image)
const h = await (await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage(); await h.goto(BASE + "/"); await h.waitForLoadState("networkidle"); await h.waitForTimeout(4200);
await h.screenshot({ path: `${SHOT}/203-home-hero.png` });
console.log(v.errors, p.errors); await b.close();
