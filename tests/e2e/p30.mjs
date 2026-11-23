// Règlement à jour, distance estimée (et calibrage), votes des pilotes sur les suggestions, classement des meilleurs parieurs.
import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, check, adminPage, text, act, pilotLogin } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const b = await launch();
const ZANE_SUG = "70000000-0000-4000-8000-000000000001";
sql(`delete from suggestion_votes; delete from course_suggestions where id = '${ZANE_SUG}'; delete from duel_bets;`);

// --- Règlement
const v = await newPage(b); await v.goto(BASE + "/rules"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(4500);
const tr = await text(v);
check("règlement : zigollars, paris, réclamations et suggestions", /ZIGOLLARS ET BOUTIQUE/i.test(tr) && /PARIS SUR LES DUELS/i.test(tr) && /RÉCLAMATIONS ET SUGGESTIONS/i.test(tr) && /500 zigollars offerts à chaque participant/i.test(tr), tr.slice(0, 0));
check("règlement : Bo3 à jour (challenger, défié, tirage au sort) et créneaux", /carte choisie par le challenger/i.test(tr) && /tirée au sort/i.test(tr) && /3 créneaux/i.test(tr) && !/Last Race/.test(tr.split("DUEL DU PODIUM")[1] ?? ""));
await v.screenshot({ path: `${SHOT}/340-reglement.png`, fullPage: true });

// --- Distance estimée dans l'éditeur + calibrage (organisation)
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/editor"); await ad.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await ad.waitForTimeout(1500);
await ad.locator(".route-drawer").scrollIntoViewIfNeeded(); await ad.waitForTimeout(400);
const sharp = (await import("sharp")).default;
const { data, info } = await sharp("public/img/map-roads.png").greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height; const road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[y * W + x] > 127;
const nearest = (x, y, r = 40) => { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (road(x + dx, y + dy) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [x + dx, y + dy]; } return best; };
const cont = await ad.locator(".route-drawer").boundingBox(); const inner = await ad.locator(".route-drawer > div").boundingBox();
const toMap = (sx, sy) => [Math.round(((sx - inner.x) / inner.width) * W), Math.round(((sy - inner.y) / inner.height) * H)];
const toScr = ([mx, my]) => [inner.x + (mx / W) * inner.width, inner.y + (my / H) * inner.height];
for (const [fx, fy] of [[0.25, 0.45], [0.6, 0.5]]) { const m = nearest(...toMap(cont.x + cont.width * fx, cont.y + cont.height * fy)); const [sx, sy] = toScr(m); await ad.mouse.click(sx + 2, sy + 1); await ad.waitForTimeout(450); }
const d0 = (await ad.locator("[data-distance]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
check("éditeur : distance estimée affichée en direct (≈ x,x km)", /≈ \d+,\d km/.test(d0), d0);
const km0 = parseFloat(d0.match(/(\d+,\d)/)[1].replace(",", "."));
await ad.screenshot({ path: `${SHOT}/341-distance-editeur.png`, fullPage: false });
// calibrage : on déclare que ce tracé fait 2 × plus long -> toutes les distances doublent
await ad.locator("summary:has-text('CALIBRER')").click();
await ad.fill("input[name=km]", String((km0 * 2).toFixed(1)).replace(".", ","));
await ad.locator('button:has-text("ENREGISTRER L\'ÉCHELLE")').click(); await ad.waitForTimeout(2500);
check("calibrage de l'échelle enregistré", /Échelle enregistrée/.test((await ad.locator(".toast").allInnerTexts()).join(" ")), (await ad.locator(".toast").allInnerTexts()).join(" "));
await ad.reload(); await ad.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await ad.waitForTimeout(1500);
await ad.locator(".route-drawer").scrollIntoViewIfNeeded(); await ad.waitForTimeout(300);
const c2 = await ad.locator(".route-drawer").boundingBox(); const i2 = await ad.locator(".route-drawer > div").boundingBox();
const toMap2 = (sx, sy) => [Math.round(((sx - i2.x) / i2.width) * W), Math.round(((sy - i2.y) / i2.height) * H)]; const toScr2 = ([mx, my]) => [i2.x + (mx / W) * i2.width, i2.y + (my / H) * i2.height];
for (const [fx, fy] of [[0.25, 0.45], [0.6, 0.5]]) { const m = nearest(...toMap2(c2.x + c2.width * fx, c2.y + c2.height * fy)); const [sx, sy] = toScr2(m); await ad.mouse.click(sx + 2, sy + 1); await ad.waitForTimeout(450); }
const d1 = (await ad.locator("[data-distance]").first().innerText()).replace(/\s+/g, " ");
const km1 = parseFloat(d1.match(/(\d+,\d)/)[1].replace(",", "."));
check("après calibrage : la distance du même tracé double", Math.abs(km1 / km0 - 2) < 0.15, `${km0} -> ${km1}`);
// le circuit créé enregistre la distance (recalculée par le serveur)
await ad.fill("[name=name]", "Circuit distance"); await act(ad, "CRÉER LE CIRCUIT");
const pub = await newPage(b, { width: 1300, height: 1000 });
let card;
for (let i = 0; i < 10; i++) { await pub.goto(BASE + "/race-network"); await pub.waitForLoadState("networkidle"); await pub.waitForTimeout(3000); card = pub.locator("article", { hasText: "Circuit distance" }); if (await card.count()) break; await pub.waitForTimeout(1500); }
const ct = (await card.innerText()).replace(/\s+/g, " ");
check("circuit publié : distance enregistrée (pas « — »)", /DISTANCE\s*\d+(\.\d)? km/i.test(ct) && !/DISTANCE\s*—/i.test(ct), ct.slice(-80));
sql("update settings set value = '6.5' where key = 'map_scale_m_per_px'; delete from race_tracks where name = 'Circuit distance';");

// --- Votes des pilotes
sql(`insert into course_suggestions(id, user_id, name, description, route_path, route_w, route_h) select '${ZANE_SUG}', id, 'Boucle de Zane', 'Une course nocturne.', 'M300 900 C340 920 380 960 420 1000 C470 1050 520 1090 580 1120', 1280, 1920 from profiles where first_name = 'Zane'`);
const mika = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(mika, "0600000014");
await mika.goto(BASE + "/suggestion"); await mika.waitForLoadState("networkidle"); await mika.waitForTimeout(4500);
const tm = await text(mika);
check("pilote : la suggestion d'un autre est proposée au vote (avec auteur et distance)", /VOTE DES PILOTES/.test(tm) && /BOUCLE DE ZANE/i.test(tm) && /Zane Drift/.test(tm) && /≈ \d+,\d km/.test(tm), tm.slice(0, 0));
await mika.locator("article", { hasText: "Boucle de Zane" }).locator('button:has-text("VOTER POUR CETTE COURSE")').click(); await mika.waitForTimeout(500);
const ok = mika.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok.count()) await ok.click();
await mika.waitForTimeout(2500); await mika.goto(BASE + "/suggestion"); await mika.waitForLoadState("networkidle");
const a1 = mika.locator("article", { hasText: "Boucle de Zane" });
check("vote enregistré : 1 vote et bouton « Retirer mon vote »", /1 vote/i.test(await a1.innerText()) && (await a1.locator('button:has-text("RETIRER MON VOTE")').count()) === 1);
await mika.screenshot({ path: `${SHOT}/342-votes.png`, fullPage: false });
const zane = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(zane, "0600000013");
await zane.goto(BASE + "/suggestion"); await zane.waitForLoadState("networkidle"); await zane.waitForTimeout(3000);
const tz = await text(zane);
check("auteur : sa suggestion montre ses votes mais n'est pas votable par lui", /BOUCLE DE ZANE[\s\S]*1 vote/i.test(tz) && (await zane.locator('button:has-text("VOTER POUR CETTE COURSE")').count()) === 0);
await ad.goto(BASE + "/admin/suggestions"); await ad.waitForLoadState("networkidle");
check("admin : la suggestion affiche ses votes et sa distance", /1 vote/i.test(await text(ad)) && /≈ \d+,\d km/.test(await text(ad)));
// retirer le vote
await mika.locator("article", { hasText: "Boucle de Zane" }).locator('button:has-text("RETIRER MON VOTE")').click(); await mika.waitForTimeout(500);
const ok2 = mika.locator('dialog[open] button:has-text("CONFIRMER")'); if (await ok2.count()) await ok2.click();
await mika.waitForTimeout(2500); await mika.goto(BASE + "/suggestion"); await mika.waitForLoadState("networkidle");
check("vote retiré : 0 vote", /0 vote/i.test(await mika.locator("article", { hasText: "Boucle de Zane" }).innerText()));
sql(`delete from course_suggestions where id = '${ZANE_SUG}'; delete from notifications where kind in ('suggestion_new');`);

// --- Meilleurs parieurs (paris réglés simulés)
sql("insert into duel_bets(challenge_id, user_id, side, stake, odds, status, payout, settled_at) select c.id, p.id, 'challenger', 1000, 2.5, 'won', 2500, now() from challenges c, profiles p where c.status = 'completed' and p.first_name = 'Zane' limit 1");
sql("insert into duel_bets(challenge_id, user_id, side, stake, odds, status, payout, settled_at) select c.id, p.id, 'defender', 2000, 1.8, 'lost', 0, now() from challenges c, profiles p where c.status = 'completed' and p.first_name = 'Mika' limit 1");
await v.goto(BASE + "/hall-of-fame"); await v.waitForLoadState("networkidle"); await v.waitForTimeout(4000);
const th = await text(v);
const rows = await v.locator("table[data-bettors] tbody tr").allInnerTexts();
check("Hall of Fame : classement des meilleurs parieurs (bénéfice trié)", /MEILLEURS PARIEURS/.test(th) && rows.length === 2 && /ZANE/i.test(rows[0]) && /\+1.?500/.test(rows[0].replace(/\s/g, "")) && /MIKA/i.test(rows[1]) && /-2.?000/.test(rows[1].replace(/\s/g, "")), JSON.stringify(rows));
check("Hall of Fame : record « Meilleur parieur »", /Meilleur parieur/i.test(th) && /ZANE/i.test(th));
await v.screenshot({ path: `${SHOT}/343-parieurs.png`, fullPage: true });
sql("delete from duel_bets");
check("aucune erreur JavaScript", ![v, mika, zane, ad].some((p) => p.errors.length), JSON.stringify([v.errors, mika.errors, ad.errors]));
await b.close();
