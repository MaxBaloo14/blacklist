// Points, boutique, paris à cotes, choix de la carte, Hall of Fame (statistiques) et retrait du faux duel d'exemple.
import { launch, newPage, BASE, SHOT, check, adminPage, text, act, pilotLogin } from "./lib.mjs";
const b = await launch();

// Retrait du duel d'exemple
const v = await newPage(b);
await v.goto(BASE + "/blacklist"); await v.waitForLoadState("networkidle");
const tv = await text(v);
check("plus de faux duel d'exemple (ni « EXEMPLE » ni Coby/Oby)", !/EXEMPLE/.test(tv) && !/COBY|OBY/i.test(tv));

// Visiteur : boutique lisible, paris réservés aux pilotes
await v.goto(BASE + "/boutique"); await v.waitForLoadState("networkidle");
const tb = await text(v);
check("visiteur : boutique et articles visibles", /FUSÉE DE DÉTRESSE/i.test(tb) && /PÉTOIRE/i.test(tb) && /10 000 points offerts/.test(tb), tb.slice(0, 200));
check("visiteur : pas de bouton d'achat", (await v.locator('button:has-text("ACHETER")').count()) === 0);
await v.goto(BASE + "/boutique?tab=paris"); await v.waitForLoadState("networkidle");
const tvp = await text(v);
check("visiteur : cotes visibles mais paris verrouillés", /× \d\.\d\d/.test(tvp) && /Connecte-toi avec un compte pilote/.test(tvp), tvp.slice(0, 300));
await v.screenshot({ path: `${SHOT}/280-paris-visiteur.png`, fullPage: true });

// Carte : Lio (défié du duel programmé) choisit la sienne ; Mika (challenger) attend
const lio = await newPage(b); await pilotLogin(lio, "0600000015");
await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle");
check("défié : choix de carte proposé, 5 cartes visibles", /CHOISIS TA CARTE/.test(await text(lio)) && (await lio.locator(".track-pick").count()) >= 5, String(await lio.locator(".track-pick").count()));
await lio.screenshot({ path: `${SHOT}/281-choix-carte.png`, fullPage: true });
await lio.locator(".track-pick").nth(1).click();
await act(lio, "VALIDER MA CARTE");
await lio.goto(BASE + "/challenges"); await lio.waitForLoadState("networkidle");
const tl = await text(lio);
check("carte enregistrée : plus de choix à faire", !/CHOISIS TA CARTE/.test(tl) && /Course \d/.test(tl), tl.slice(tl.indexOf("DÉFIS EN COURS"), tl.indexOf("DÉFIS EN COURS") + 500));
const mika = await newPage(b); await pilotLogin(mika, "0600000014");
await mika.goto(BASE + "/challenges"); await mika.waitForLoadState("networkidle");
const tm = await text(mika);
check("challenger : voit la carte choisie par le défié, sans pouvoir choisir", /Course \d/.test(tm) && !/CHOISIS TA CARTE/.test(tm));
await mika.screenshot({ path: `${SHOT}/282-challenger-carte.png`, fullPage: true });

// Paris : Zane (spectateur) mise, un participant ne peut pas miser sur son duel
const zane = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(zane, "0600000013");
await zane.goto(BASE + "/boutique"); await zane.waitForLoadState("networkidle");
check("10 000 points offerts à l'inscription", /10 000 pts/.test(await text(zane)), (await text(zane)).slice(0, 200));
await zane.goto(BASE + "/boutique?tab=paris"); await zane.waitForLoadState("networkidle");
check("2 duels programmés avec des cotes", (await zane.locator(".bet").count()) === 2, String(await zane.locator(".bet").count()));
await zane.screenshot({ path: `${SHOT}/283-paris-zane.png`, fullPage: true });
const bet0 = zane.locator(".bet").first();
await bet0.locator("input[type=number]").fill("750");
check("mise non ronde (750) : bouton PARIER désactivé", await bet0.locator('button:has-text("PARIER")').isDisabled());
await bet0.locator("input[type=number]").fill("100000");
check("mise au-dessus de 50 000 : bouton PARIER désactivé", await bet0.locator('button:has-text("PARIER")').isDisabled());
check("mises rapides 500 / 1 000 / 2 000 + case libre", (await bet0.locator(".bet-chip").count()) === 3 && (await bet0.locator("input[type=number]").count()) === 1);
await bet0.locator("input[type=number]").fill("2500");
await zane.screenshot({ path: `${SHOT}/283b-paris-montant-libre.png`, fullPage: false });
await bet0.locator('button:has-text("PARIER")').click(); await zane.waitForTimeout(2200);
await zane.goto(BASE + "/boutique?tab=paris"); await zane.waitForLoadState("networkidle");
const tz = await text(zane);
check("pari placé (2 500 pts libres) : solde débité de la mise", /7 500 pts/.test(tz), tz.slice(0, 250));
check("pari visible : « Ton pari » et ligne dans « Mes paris »", /Ton pari/i.test(tz) && /MES PARIS/i.test(tz) && /En cours/i.test(tz));
await zane.screenshot({ path: `${SHOT}/284-pari-place.png`, fullPage: true });
await mika.goto(BASE + "/boutique?tab=paris"); await mika.waitForLoadState("networkidle");
check("participant : pari sur son propre duel bloqué", /Tu ne peux pas parier sur ton propre duel/.test(await text(mika)));

// Boutique : achat, commande, historique
await zane.goto(BASE + "/boutique"); await zane.waitForLoadState("networkidle");
await zane.screenshot({ path: `${SHOT}/285-boutique.png`, fullPage: true });
await zane.locator("article", { hasText: "Fusée de détresse" }).locator('button:has-text("ACHETER")').click(); await zane.waitForTimeout(500);
await zane.locator('dialog[open] button:has-text("CONFIRMER")').click(); await zane.waitForTimeout(2200);
await zane.goto(BASE + "/boutique?tab=historique"); await zane.waitForLoadState("networkidle");
const th = await text(zane);
check("achat : solde 7 000 pts, commande en attente et historique", /7 000 pts/i.test(th) && /Fusée de détresse/i.test(th) && /En attente de remise/i.test(th) && /Bonus de bienvenue/i.test(th), th.slice(0, 400));
await zane.screenshot({ path: `${SHOT}/286-historique.png`, fullPage: true });

// Organisation : nouvel article, remise de la commande
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/shop"); await ad.waitForLoadState("networkidle");
check("admin : commande à remettre visible", /COMMANDES À REMETTRE \(1\)/i.test(await text(ad)) && /Fusée de détresse/i.test(await text(ad)));
await ad.screenshot({ path: `${SHOT}/287-admin-shop.png`, fullPage: true });
const form = ad.locator("form", { has: ad.locator('button:has-text("AJOUTER L\'ARTICLE")') });
await form.locator("[name=name]").fill("Pneus neufs"); await form.locator("[name=category]").fill("Mécanique"); await form.locator("[name=price]").fill("1200"); await form.locator("[name=stock]").fill("2");
await act(ad, "AJOUTER L'ARTICLE", { form: "form:has(button:has-text(\"AJOUTER L'ARTICLE\"))" });
await ad.goto(BASE + "/admin/shop"); await ad.waitForLoadState("networkidle");
check("admin : article ajouté", /PNEUS NEUFS/i.test(await text(ad)));
await act(ad, "REMIS EN JEU");
await ad.goto(BASE + "/admin/shop"); await ad.waitForLoadState("networkidle");
check("admin : commande marquée remise", /COMMANDES À REMETTRE \(0\)/.test(await text(ad)) && /COMMANDES TRAITÉES/.test(await text(ad)));
await zane.goto(BASE + "/boutique"); await zane.waitForLoadState("networkidle");
check("nouvel article visible en boutique avec son stock", /PNEUS NEUFS/i.test(await text(zane)) && /2 restant/i.test(await text(zane)));
await zane.goto(BASE + "/boutique?tab=historique"); await zane.waitForLoadState("networkidle");
check("pilote : commande remise", /Remis/i.test(await text(zane)));

// Hall of Fame : statistiques par pilote
await v.goto(BASE + "/hall-of-fame"); await v.waitForLoadState("networkidle");
const thf = await text(v);
check("Hall of Fame : tableau des statistiques (V, D, duels, courses, séries, Cash Prize)", /STATISTIQUES DES PILOTES/i.test(thf) && /Courses gagnées/i.test(thf) && /Meilleure série/i.test(thf) && /LIO/i.test(thf), thf.slice(thf.indexOf("STATISTIQUES"), thf.indexOf("STATISTIQUES") + 300));
check("Hall of Fame : nouveaux records", /Plus de courses disputées/i.test(thf) && /Meilleur taux de victoire/i.test(thf) && /Plus gros gains/i.test(thf));
await v.screenshot({ path: `${SHOT}/288-hall.png`, fullPage: true });
console.log("erreurs:", v.errors, lio.errors, zane.errors, ad.errors);
check("aucune erreur JavaScript", ![v, lio, zane, mika].some((p) => p.errors.length), JSON.stringify([v.errors, lio.errors, zane.errors]));
await b.close();
