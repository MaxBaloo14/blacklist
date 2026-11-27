// Choix du véhicule dans la liste à l'inscription + photos du véhicule dans le classement, les duels et les fiches.
import { execSync } from "node:child_process";
import { launch, BASE, SHOT, check, newPage, adminPage, text, act, pickVehicle, pilotLogin } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const b = await launch();
sql(`delete from auth.users where id in (select id from profiles where phone = '0688000001')`);

// --- inscription : sélecteur avec photos
const r = await newPage(b, { width: 1280, height: 1000 });
await r.goto(BASE + "/register"); await r.waitForLoadState("networkidle"); await r.waitForTimeout(3500);
check("inscription : plus de champ libre « marque et modèle »", (await r.locator("[name=make_model]").count()) === 0 && (await r.locator("[name=vehicle_class]").count()) === 0);
await r.fill('[role=combobox][aria-label]', "blis"); await r.waitForTimeout(1200);
const opts = await r.locator("[role=option]").count();
check("recherche instantanée : propositions avec photo", opts >= 2 && (await r.locator("[role=option] img").count()) >= 1, String(opts));
await r.screenshot({ path: `${SHOT}/410-inscription-recherche.png`, fullPage: false });
await r.keyboard.press("ArrowDown"); await r.keyboard.press("Enter");
await r.locator("[data-picked]").waitFor({ timeout: 5000 });
const label = (await r.locator("[data-picked] .font-display").innerText()).trim();
check("choix au clavier : carte du véhicule choisi (photo, catégorie, « autorisé »)", /Blista/i.test(label) && (await r.locator("[data-picked] img").count()) === 1 && /AUTORIS/i.test(await r.locator("[data-picked]").innerText()), label);
check("le champ caché porte l'identifiant du catalogue", /blista/.test(await r.locator("[name=catalog_slug]").inputValue()));
await r.screenshot({ path: `${SHOT}/411-inscription-choisi.png`, fullPage: false });

// --- refus côté serveur d'un identifiant trafiqué
await r.fill('[name=last_name]', "Essai"); await r.fill('[name=first_name]', "Liste"); await r.fill('[name=phone]', "0688000001"); await r.fill('[name=password]', "PiloteTest12345");
await r.evaluate(() => { document.querySelector("[name=catalog_slug]").value = "voiture-inventee"; });
await act(r, "ENVOYER");
await r.waitForTimeout(1500);
check("identifiant inventé : refusé par le serveur", /Choisis ton véhicule/i.test((await r.locator(".toast").allInnerTexts()).join(" ")) && sqlv("select count(*) from profiles where phone = '0688000001'") === "0", (await r.locator(".toast").allInnerTexts()).join(" "));
check("après une erreur du serveur, les champs saisis sont conservés (nom, téléphone, mot de passe, véhicule choisi)", (await r.inputValue("[name=phone]")) === "0688000001" && (await r.inputValue("[name=password]")).length > 5 && (await r.locator("[data-picked]").count()) === 1);
// sans choix : le navigateur bloque (champ obligatoire)
await r.locator("[data-picked] button").click();
await r.locator('button:has-text("ENVOYER")').first().click({ trial: true }).catch(() => {});
check("sans véhicule choisi : formulaire bloqué (champ obligatoire)", (await r.locator('[role=combobox]').evaluate((e) => !e.checkValidity())) === true);
await pickVehicle(r, "Blista Kanjo");
await act(r, "ENVOYER"); await r.waitForTimeout(3500);
check("inscription avec le véhicule choisi : compte créé, libellé et catégorie venant de la liste", sqlv("select v.make_model || '|' || v.vehicle_class from vehicles v join profiles p on p.id = v.owner_id where p.phone = '0688000001'") === "Dinka Blista Kanjo|Compactes", sqlv("select v.make_model || '|' || v.vehicle_class from vehicles v join profiles p on p.id = v.owner_id where p.phone = '0688000001'"));

// --- espace organisation : photo + « dans la liste »
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/vehicles"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(2000);
check("homologation : photo du véhicule et mention « Dans la liste autorisée »", (await ad.locator("article.req-card img").count()) >= 1 && /Dans la liste autoris/i.test(await text(ad)));
await ad.screenshot({ path: `${SHOT}/412-admin-homologation.png`, fullPage: false });
sql(`delete from auth.users where id in (select id from profiles where phone = '0688000001')`);

// --- photos publiques : classement, duels, fiche pilote, Warm-up, profil
const p = await newPage(b, { width: 1280, height: 1000 });
await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(4000);
const pod = await p.locator(".car-podium img").count();
check("classement : photo du véhicule sur chaque marche du podium", pod >= 1, String(pod));
check("classement : miniature dans les lignes #4 à #10", (await p.locator(".row-card .car-thumb img").count()) >= 1);
await p.screenshot({ path: `${SHOT}/413-classement-photos.png`, fullPage: false });
const imgOk = await p.locator(".car-podium img").first().evaluate((i) => i.complete && i.naturalWidth > 0);
check("la photo du podium est chargée", imgOk);
await p.goto(BASE + "/calendar"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3500);
check("duel : photo du véhicule de chaque duelliste", (await p.locator(".car-duel img").count()) >= 2, String(await p.locator(".car-duel img").count()));
await p.screenshot({ path: `${SHOT}/414-duel-photos.png`, fullPage: false });
const first = sqlv("select driver_id from blacklist_rankings where driver_id is not null order by position limit 1");
await p.goto(BASE + `/blacklist/${first}`); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3500);
check("fiche pilote : grande photo du véhicule", (await p.locator(".car-hero img").count()) === 1);
await p.screenshot({ path: `${SHOT}/415-fiche-pilote-photo.png`, fullPage: false });
const z = await newPage(b, { width: 1280, height: 1000 }); await pilotLogin(z, "0600000013");
await z.goto(BASE + "/profile?tab=garage"); await z.waitForLoadState("networkidle"); await z.waitForTimeout(3500);
check("profil (garage) : photo du véhicule engagé et sélecteur de véhicule", (await z.locator(".car-hero img").count()) === 1 && (await z.locator("[data-vehicle-picker]").count()) === 1);
await z.screenshot({ path: `${SHOT}/416-profil-garage.png`, fullPage: false });
check("aucune erreur JavaScript", ![r, p, z, ad].some((x) => (x.errors ?? []).length), JSON.stringify([r.errors, p.errors, z.errors]));
await b.close();
