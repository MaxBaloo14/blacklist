// Réclamations (titre, message, plusieurs liens) et suggestions de course (tracé rouge sur la carte).
import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, check, adminPage, text, act, pilotLogin } from "./lib.mjs";
const b = await launch();

const v = await newPage(b); await v.goto(BASE + "/reclamation"); await v.waitForLoadState("networkidle");
check("visiteur : /reclamation renvoie vers la connexion", /\/login/.test(v.url()), v.url());
await v.goto(BASE + "/suggestion"); await v.waitForLoadState("networkidle");
check("visiteur : /suggestion renvoie vers la connexion", /\/login/.test(v.url()), v.url());

const z = await newPage(b, { width: 1280, height: 900 }); await pilotLogin(z, "0600000013");
const menu = await z.locator("nav, header").first().innerText().catch(() => "");
await z.goto(BASE + "/reclamation"); await z.waitForLoadState("networkidle"); await z.waitForTimeout(4500);
check("onglet Réclamation accessible au pilote", /RÉCLAMATION/i.test(await text(z)));

// Réclamation avec plusieurs liens
await z.fill("[name=title]", "Résultat du duel contesté");
await z.fill("[name=message]", "Le résultat de dimanche a été mal saisi : voici le clip et une capture du classement.");
await z.locator("input[name=link]").first().fill("https://medal.tv/games/gta-v/clips/AbCdEf123456");
for (let i = 0; i < 2; i++) { await z.locator('button:has-text("AJOUTER UN LIEN")').click(); }
await z.locator("input[name=link]").nth(1).fill("https://i.imgur.com/capture.png");
await z.locator("input[name=link]").nth(2).fill("https://www.youtube.com/watch?v=abcdefghijk");
check("3 champs de lien (ajout dynamique)", (await z.locator("input[name=link]").count()) === 3);
await z.screenshot({ path: `${SHOT}/310-reclamation-formulaire.png`, fullPage: false });
await act(z, "ENVOYER LA RÉCLAMATION");
await z.goto(BASE + "/reclamation"); await z.waitForLoadState("networkidle");
const tr = await text(z);
check("réclamation enregistrée avec ses 3 liens cliquables", /Résultat du duel contesté/i.test(tr) && (await z.locator('article a[href^="https://"]').count()) === 3 && /medal\.tv/.test(tr) && /imgur\.com/.test(tr), tr.slice(tr.indexOf("MES RÉCLAMATIONS"), tr.indexOf("MES RÉCLAMATIONS") + 300));
check("liens ouverts dans un nouvel onglet, sans fuite (noopener)", (await z.locator('article a[target=_blank][rel*=noopener]').count()) === 3);
// lien dangereux
await z.fill("[name=title]", "Test lien dangereux"); await z.fill("[name=message]", "Un message assez long pour passer la validation.");
await z.locator("input[name=link]").first().evaluate((el) => { el.type = "text"; }); await z.locator("input[name=link]").first().fill("javascript:alert(1)");
await act(z, "ENVOYER LA RÉCLAMATION");
check("lien javascript: refusé par le serveur", /http/i.test((await z.locator(".toast").allInnerTexts()).join(" ")), (await z.locator(".toast").allInnerTexts()).join(" "));

// Organisation : traite la réclamation
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/claims"); await ad.waitForLoadState("networkidle");
check("admin : réclamation reçue avec ses liens", /Résultat du duel contesté/i.test(await text(ad)) && (await ad.locator('article a[href^="https://"]').count()) >= 3);
await ad.screenshot({ path: `${SHOT}/311-admin-reclamations.png`, fullPage: true });
const art = ad.locator("article", { hasText: "Résultat du duel contesté" });
await art.locator("select[name=status]").selectOption("resolved");
await art.locator("textarea[name=reply]").fill("Après visionnage du clip, le résultat a été corrigé.");
await act(ad, "ENREGISTRER", { form: "article:has-text('Résultat du duel contesté') form" });
await z.goto(BASE + "/reclamation"); await z.waitForLoadState("networkidle");
const tr2 = await text(z);
check("pilote : réponse de l'organisation et statut « Traitée »", /Après visionnage du clip/.test(tr2) && /TRAITÉE/i.test(tr2));
await z.goto(BASE + "/notifications"); await z.waitForLoadState("networkidle");
check("pilote prévenu par notification", /réclamation/i.test(await text(z)));

// Suggestion de course : tracé rouge sur la carte
await z.goto(BASE + "/suggestion"); await z.waitForLoadState("networkidle"); await z.waitForTimeout(4500);
const mapOk = await z.locator(".route-drawer img").evaluate((i) => i.complete && i.naturalWidth > 500);
check("carte de tracé chargée", mapOk);
await z.locator(".route-drawer").scrollIntoViewIfNeeded(); await z.waitForTimeout(400);
await z.locator('button:has-text("SUIVRE LES ROUTES")').click();   // tracé libre : les clics ne dépendent pas des routes
const box = await z.locator(".route-drawer").boundingBox();
const pts = [[0.2, 0.25], [0.4, 0.2], [0.6, 0.4], [0.7, 0.65], [0.5, 0.8]];
for (const [fx, fy] of pts) { await z.mouse.click(box.x + box.width * fx, box.y + box.height * fy); await z.waitForTimeout(150); }
check("5 points posés : tracé rouge, départ et arrivée", /5 point/.test(await text(z)) && (await z.locator('.route-drawer svg path[stroke="#e03232"]').count()) === 1 && (await z.locator(".route-drawer svg rect").count()) === 1);
check("joueur : aperçu avec tracé rouge visible, flèches et bouton Agrandir", (await z.locator('[data-plan-preview] path[stroke="#e01919"]').count()) >= 1 && (await z.locator("[data-plan-preview] .route-zoom").count()) === 1);
check("joueur : aperçu du plan (cadre + voiture animée) avant d'envoyer", (await z.locator("[data-plan-preview]").count()) === 1 && (await z.locator("[data-plan-preview] animateMotion").count()) >= 1 && (await z.locator('[data-plan-preview] image[href*="plan-frame"]').count()) === 1);
await z.locator("[data-plan-preview]").scrollIntoViewIfNeeded(); await z.waitForTimeout(1200);
await z.screenshot({ path: `${SHOT}/318-apercu-joueur.png`, fullPage: false });
await z.locator('button:has-text("ANNULER LE DERNIER POINT")').click();
check("annuler le dernier point", /4 point/.test(await text(z)));
await z.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
await z.fill("[name=name]", "Boucle du port"); await z.fill("textarea[name=description]", "Départ au port, arrivée dans les collines.");
await z.screenshot({ path: `${SHOT}/312-suggestion-trace.png`, fullPage: false });
await act(z, "ENVOYER MA SUGGESTION");
await z.goto(BASE + "/suggestion"); await z.waitForLoadState("networkidle");
const ts = await text(z);
check("suggestion enregistrée avec son aperçu recadré", /Boucle du port/i.test(ts) && /EN ATTENTE/i.test(ts) && (await z.locator("article svg path").count()) >= 2, ts.slice(ts.indexOf("MES SUGGESTIONS"), ts.indexOf("MES SUGGESTIONS") + 200));
await z.locator("article svg").first().scrollIntoViewIfNeeded();
await z.screenshot({ path: `${SHOT}/313-suggestion-liste.png`, fullPage: false });
// envoi sans tracé
await z.fill("[name=name]", "Sans tracé"); await act(z, "ENVOYER MA SUGGESTION");
check("suggestion sans tracé refusée", /au moins 2 points/i.test((await z.locator(".toast").allInnerTexts()).join(" ")), (await z.locator(".toast").allInnerTexts()).join(" "));
await ad.goto(BASE + "/admin/suggestions"); await ad.waitForLoadState("networkidle");
check("admin : suggestion avec aperçu du tracé", /Boucle du port/i.test(await text(ad)) && (await ad.locator("article svg path").count()) >= 2);
await ad.screenshot({ path: `${SHOT}/314-admin-suggestions.png`, fullPage: false });
await ad.locator("article", { hasText: "Boucle du port" }).locator("input[name=note]").first().fill("Super idée, on la retient pour la saison.");
await act(ad, "RETENIR ET CRÉER LE CIRCUIT", { form: "article:has-text('Boucle du port') form:has(button:has-text('RETENIR'))" });
// la fabrication du plan (image + envoi) peut prendre quelques secondes à froid : on attend la décision
for (let i = 0; i < 12; i++) { await z.goto(BASE + "/suggestion"); await z.waitForLoadState("networkidle"); if (/RETENUE/i.test(await text(z))) break; await z.waitForTimeout(2000); }
check("pilote : suggestion retenue avec le message", /RETENUE/i.test(await text(z)) && /on la retient pour la saison/i.test(await text(z)));
// le circuit officiel existe avec son plan (carte + cadre) et la voiture animée
const pub = await newPage(b, { width: 1300, height: 1000 });
await pub.goto(BASE + "/race-network"); await pub.waitForLoadState("networkidle"); await pub.waitForTimeout(4500);
const card = pub.locator("article", { hasText: "Boucle du port" });
check("circuit officiel créé depuis la suggestion (tracé animé + voiture)", (await card.count()) === 1 && (await card.locator(".route-zoom").count()) === 1 && (await card.locator("animateMotion").count()) >= 1);
await card.scrollIntoViewIfNeeded(); await pub.waitForTimeout(1500);
const dims = await card.locator("img").first().evaluate((i) => ({ ok: i.complete && i.naturalWidth > 500, w: i.naturalWidth, src: i.currentSrc.slice(-24) }));
check("le plan fabriqué se charge (image du cadre BooBoo Crew)", dims.ok, JSON.stringify(dims));
await pub.screenshot({ path: `${SHOT}/315-circuit-cree.png`, fullPage: false });
{
  // le tracé rouge est bien dessiné DANS l'image publiée (comme sur les plans d'origine)
  const sharp = (await import("sharp")).default;
  const url = await card.locator("img").first().evaluate((i) => i.currentSrc);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let red = 0; for (let i = 0; i < data.length; i += info.channels) if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) red++;
  check("le tracé rouge est visible dans l'image du plan publié", red > 3000, `${red} pixels rouges`);
}

// Éditeur de circuit (Control Center) : trace → circuit officiel
await ad.goto(BASE + "/admin/editor"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(1500);
await ad.locator(".route-drawer").scrollIntoViewIfNeeded(); await ad.waitForTimeout(400);
await ad.locator('button:has-text("SUIVRE LES ROUTES")').click();
const bx = await ad.locator(".route-drawer").boundingBox();
for (const [fx, fy] of [[0.15, 0.3], [0.35, 0.2], [0.55, 0.45], [0.8, 0.5]]) { await ad.mouse.click(bx.x + bx.width * fx, bx.y + bx.height * fy); await ad.waitForTimeout(120); }
check("éditeur admin : 4 points posés", /4 point/.test(await text(ad)));
// glisser le 2e point
const p2 = await ad.locator('[data-point="1"] circle').first().boundingBox();
await ad.mouse.move(p2.x + p2.width / 2, p2.y + p2.height / 2); await ad.mouse.down(); await ad.mouse.move(p2.x + p2.width / 2 + 40, p2.y + p2.height / 2 + 60, { steps: 6 }); await ad.mouse.up();
const moved = await ad.locator('[data-point="1"] circle').first().boundingBox();
check("éditeur : un point se déplace en le glissant", Math.abs(moved.x - p2.x) > 20 && /4 point/.test(await text(ad)), `${p2.x}->${moved.x}`);
await ad.locator('[data-point="2"] circle').first().click({ force: true }); await ad.locator('button:has-text("SUPPRIMER LE POINT")').click();
check("éditeur : suppression du point sélectionné", /3 point/.test(await text(ad)));
check("admin : aperçu du plan (cadre + voiture animée) avant de créer le circuit", (await ad.locator("[data-plan-preview]").count()) === 1 && (await ad.locator("[data-plan-preview] animateMotion").count()) >= 1);
await ad.locator("[data-plan-preview]").scrollIntoViewIfNeeded(); await ad.waitForTimeout(1200);
await ad.screenshot({ path: `${SHOT}/319-apercu-admin.png`, fullPage: false });
await ad.fill("[name=name]", "Circuit de l'éditeur");
await ad.screenshot({ path: `${SHOT}/316-admin-editeur.png`, fullPage: false });
await act(ad, "CRÉER LE CIRCUIT");
// la fabrication du plan peut prendre quelques secondes : on attend l'apparition du circuit
for (let i = 0; i < 10; i++) { await pub.goto(BASE + "/race-network"); await pub.waitForLoadState("networkidle"); await pub.waitForTimeout(3500); if (await pub.locator("article", { hasText: "Circuit de l'éditeur" }).count()) break; await pub.waitForTimeout(1500); }
check("circuit créé depuis l'éditeur : visible avec tracé animé", (await pub.locator("article", { hasText: "Circuit de l'éditeur" }).locator(".route-zoom").count()) === 1);

// Mode « Suivre les routes » : deux clics suffisent, le parcours épouse la route
{
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp("public/img/map-roads.png").greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; const road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[y * W + x] > 127;
  const nearest = (x, y, r = 40) => { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (road(x + dx, y + dy) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [x + dx, y + dy]; } return best; };
  await ad.goto(BASE + "/admin/editor"); await ad.waitForSelector('.route-drawer[data-roads="ready"]', { timeout: 15000 }); await ad.waitForTimeout(1500);
  await ad.locator(".route-drawer").scrollIntoViewIfNeeded(); await ad.waitForTimeout(400);
  check("mode « Suivre les routes » actif par défaut", /SUIVRE LES ROUTES : OUI/i.test(await text(ad)));
  const cont = await ad.locator(".route-drawer").boundingBox(); const inner = await ad.locator(".route-drawer > div").boundingBox();
  const toMap = (sx, sy) => [Math.round(((sx - inner.x) / inner.width) * W), Math.round(((sy - inner.y) / inner.height) * H)];
  const toScr = ([mx, my]) => [inner.x + (mx / W) * inner.width, inner.y + (my / H) * inner.height];
  const ptsMap = [[0.25, 0.45], [0.55, 0.5], [0.75, 0.3]].map(([fx, fy]) => nearest(...toMap(cont.x + cont.width * fx, cont.y + cont.height * fy)));
  check("des routes existent près des points choisis", ptsMap.every(Boolean), JSON.stringify(ptsMap));
  for (const m of ptsMap) { const [sx, sy] = toScr(m); await ad.mouse.click(sx + 2, sy + 1); await ad.waitForTimeout(400); }
  check("3 points posés en suivant les routes", /3 point/.test(await text(ad)), (await text(ad)).slice(0, 0));
  const d = await ad.locator("input[name=path]").inputValue();
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number); const ends = []; for (let i = 0; i + 1 < nums.length; i += 2) ends.push([nums[i], nums[i + 1]]);
  const on = ends.filter(([x, y]) => nearest(Math.round(x), Math.round(y), 6)).length;
  check("le parcours suit la route : nombreuses courbes (pas une ligne droite)", (d.match(/C/g) ?? []).length >= 8, `${(d.match(/C/g) ?? []).length} courbes`);
  check("le parcours reste sur les routes (≥ 90 % des points à moins de 6 px d'une route)", ends.length > 10 && on / ends.length >= 0.9, `${on}/${ends.length}`);
  await ad.screenshot({ path: `${SHOT}/317-editeur-routes.png`, fullPage: false });
  // clic dans la mer : aucune route -> message, aucun point ajouté
  const sea = toScr([60, 1800]);
  await ad.locator(".route-drawer").evaluate((e) => { e.scrollLeft = 0; e.scrollTop = e.scrollHeight; });
  const innerB = await ad.locator(".route-drawer > div").boundingBox(); const contB = await ad.locator(".route-drawer").boundingBox();
  await ad.mouse.click(innerB.x + (20 / W) * innerB.width, innerB.y + (1900 / H) * innerB.height);
  check("clic loin de toute route : message clair, aucun point ajouté", /Aucune route à cet endroit/.test(await text(ad)) && /3 point/.test(await text(ad)));
}
// parcours trop étendu (d'un bout à l'autre de la carte)
await ad.goto(BASE + "/admin/editor"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(1500);
for (let i = 0; i < 6; i++) await ad.locator('button[aria-label="Dézoomer"]').click();
await ad.locator(".route-drawer").scrollIntoViewIfNeeded(); await ad.waitForTimeout(400);
await ad.locator('button:has-text("SUIVRE LES ROUTES")').click();
const b2 = await ad.locator(".route-drawer").boundingBox();
await ad.mouse.click(b2.x + 5, b2.y + 5); await ad.mouse.click(b2.x + b2.width - 40, b2.y + Math.min(b2.height - 40, 600));
await ad.fill("[name=name]", "Trop grand"); await act(ad, "CRÉER LE CIRCUIT");
check("parcours trop étendu refusé avec un message clair", /trop étendu/i.test((await ad.locator(".toast").allInnerTexts()).join(" ")), (await ad.locator(".toast").allInnerTexts()).join(" "));
// anglais
await z.locator('button[aria-label="English"]:visible').first().click(); await z.waitForTimeout(1500);
const en = await text(z);
check("version anglaise de la page suggestion", /Selected|DRAW MY RACE|MY SUGGESTIONS/i.test(en) && !/TRACER MA COURSE/.test(en));
check("aucune erreur JavaScript", ![v, z, ad].some((p) => p.errors.length), JSON.stringify([v.errors, z.errors, ad.errors]));
// ménage : les contrôles d'anglais qui suivent ne doivent pas voir ces données de test (noms et descriptions écrits en français)
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
sql("delete from race_tracks where name in ('Boucle du port', 'Circuit de l''éditeur', 'Trop grand')");
sql("delete from course_suggestions; delete from claims; delete from notifications where kind in ('claim','claim_new','suggestion','suggestion_new');");
await b.close();
