// Éditeur : brouillons, retouche d'un circuit existant, distance saisie à la main · 2 500 zigollars par victoire en duel.
import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, check, adminPage, text, act, pilotLogin } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
sql("delete from track_drafts; delete from race_tracks where name in ('Brouillon test','Circuit retouché','Circuit de brouillon');");
const b = await launch();

// --- 2 500 zigollars pour le vainqueur d'un duel (le duel de la fixture a été validé par l'organisation : Lio l'a gagné)
const lio = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(lio, "0600000015");
await lio.goto(BASE + "/boutique?tab=historique"); await lio.waitForLoadState("networkidle"); await lio.waitForTimeout(4500);
const th = await text(lio);
check("vainqueur du duel : « Victoire en duel » +2 500 dans l'historique", /Victoire en duel/i.test(th) && /\+2 500/.test(th), th.slice(th.indexOf("HISTORIQUE"), th.indexOf("HISTORIQUE") + 200));
check("vainqueur du duel : solde = 10 000 offerts + 2 500", /12 500 zigollars/.test(th));
await lio.screenshot({ path: `${SHOT}/360-gain-duel.png`, fullPage: false });
const adm = await adminPage(b);
await adm.goto(BASE + "/admin/rules"); await adm.waitForLoadState("networkidle");
check("réglage du gain par duel visible et modifiable (Règles)", /duel_win_zigollars/.test(await text(adm)));

// --- outils : deux clics sur des routes
const sharp = (await import("sharp")).default;
const { data, info } = await sharp("public/img/map-roads.png").greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height; const road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[y * W + x] > 127;
const nearest = (x, y, r = 40) => { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (road(x + dx, y + dy) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [x + dx, y + dy]; } return best; };
async function clickRoads(p, fr) {
  await p.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.locator(".route-drawer").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const c = await p.locator(".route-drawer").boundingBox(), inn = await p.locator(".route-drawer > div").boundingBox();
  for (const [fx, fy] of fr) { const m = nearest(Math.round(((c.x + c.width * fx - inn.x) / inn.width) * W), Math.round(((c.y + c.height * fy - inn.y) / inn.height) * H)); await p.mouse.click(inn.x + (m[0] / W) * inn.width + 2, inn.y + (m[1] / H) * inn.height + 1); await p.waitForTimeout(450); }
}

// --- Brouillon
await adm.goto(BASE + "/admin/editor"); await adm.waitForLoadState("networkidle");
await clickRoads(adm, [[0.25, 0.45], [0.6, 0.5]]);
await adm.fill("[name=name]", "Brouillon test");
await adm.locator('button:has-text("ENREGISTRER LE BROUILLON")').click(); await adm.waitForTimeout(3000);
check("brouillon enregistré : l'adresse porte l'identifiant du brouillon", /[?&]draft=[0-9a-f-]{36}/.test(adm.url()), adm.url());
check("brouillon : rien n'est publié (aucun circuit créé)", sqlv("select count(*) from race_tracks where name = 'Brouillon test'") === "0");
await adm.goto(BASE + "/admin/editor"); await adm.waitForLoadState("networkidle");
check("le brouillon est listé", /MES BROUILLONS \(1\)/i.test(await text(adm)) && /Brouillon test/i.test(await text(adm)));
await adm.locator('a:has-text("REPRENDRE")').first().click(); await adm.waitForLoadState("networkidle");
await adm.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await adm.waitForTimeout(2500);
check("reprise du brouillon : nom, points et tracé restaurés", (await adm.locator("[name=name]").inputValue()) === "Brouillon test" && /2 point/.test(await text(adm)) && (await adm.locator('[data-plan-preview]').count()) === 1, (await text(adm)).slice(0, 0));
await adm.screenshot({ path: `${SHOT}/361-brouillon.png`, fullPage: false });
// publication depuis le brouillon avec une distance saisie à la main
await adm.fill("[name=name]", "Circuit de brouillon"); await adm.fill("[name=distance_km]", "7,5");
await act(adm, "CRÉER LE CIRCUIT");
const pub = await newPage(b, { width: 1300, height: 1000 });
async function card(name) { for (let i = 0; i < 10; i++) { await pub.goto(BASE + "/race-network"); await pub.waitForLoadState("networkidle"); await pub.waitForTimeout(3000); const c = pub.locator("article", { hasText: name }); if (await c.count()) return c; await pub.waitForTimeout(1500); } return pub.locator("article", { hasText: name }); }
const c1 = await card("Circuit de brouillon");
check("publication depuis le brouillon : circuit en ligne avec la distance saisie (7.5 km)", (await c1.count()) === 1 && /7\.5 km/.test(await c1.innerText()), (await c1.innerText()).replace(/\s+/g, " ").slice(-60));
check("le brouillon est supprimé après publication", sqlv("select count(*) from track_drafts") === "0");

// --- Retouche d'un circuit existant (même identifiant)
const id = sqlv("select id from race_tracks where name = 'Circuit de brouillon'");
const nb = sqlv("select count(*) from race_tracks");
const img0 = sqlv(`select image_path from race_tracks where id = '${id}'`);
await adm.goto(BASE + "/admin/editor?track=" + id); await adm.waitForLoadState("networkidle");
await adm.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await adm.waitForTimeout(2500);
check("retouche : nom, distance et points du circuit restaurés", (await adm.locator("[name=name]").inputValue()) === "Circuit de brouillon" && (await adm.locator("[name=distance_km]").inputValue()) === "7.5" && /2 point/.test(await text(adm)));
check("retouche : bouton « Mettre à jour »", /METTRE À JOUR LE CIRCUIT/i.test(await text(adm)));
await clickRoads(adm, [[0.7, 0.3]]);
check("retouche : un 3e point s'ajoute", /3 point/.test(await text(adm)));
await adm.fill("[name=name]", "Circuit retouché"); await adm.fill("[name=distance_km]", "");
await act(adm, "METTRE À JOUR LE CIRCUIT");
const c2 = await card("Circuit retouché");
const km2 = sqlv(`select distance_km from race_tracks where id = '${id}'`);
check("retouche : même circuit (identifiant conservé), pas de doublon", (await c2.count()) === 1 && sqlv("select count(*) from race_tracks") === nb && sqlv(`select name from race_tracks where id = '${id}'`) === "Circuit retouché");
check("retouche : nouveau plan fabriqué et distance estimée (distance saisie effacée)", sqlv(`select image_path from race_tracks where id = '${id}'`) !== img0 && parseFloat(km2) > 0 && km2 !== "7.5", `${img0} -> ${km2}`);
// circuit créé avant l'éditeur : message d'aide
const course1 = sqlv("select id from race_tracks where name = 'Course 1'");
await adm.goto(BASE + "/admin/editor?track=" + course1); await adm.waitForLoadState("networkidle"); await adm.waitForTimeout(1500);
check("circuit d'origine (sans points) : message d'explication, tracé à refaire", /n'a pas été créé avec l'éditeur/i.test(await text(adm)));
await adm.screenshot({ path: `${SHOT}/362-retouche-ancien.png`, fullPage: false });
check("aucune erreur JavaScript", ![lio, adm, pub].some((p) => p.errors.length), JSON.stringify([lio.errors, adm.errors, pub.errors]));
sql("delete from track_drafts; delete from race_tracks where name in ('Brouillon test','Circuit retouché','Circuit de brouillon');");
await b.close();
