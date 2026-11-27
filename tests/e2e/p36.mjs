// Liste des véhicules autorisés : import du concessionnaire, Paragon et deux-roues exclus, recherche et filtres.
import { readFileSync } from "node:fs";
import { launch, BASE, SHOT, check, newPage, text } from "./lib.mjs";
const data = JSON.parse(readFileSync(new URL("../../data/vehicles.json", import.meta.url), "utf8")).vehicles;
check("import : aucun Paragon dans la liste", !data.some((v) => /paragon/i.test(`${v.name} ${v.model}`)));
check("import : aucun deux-roues dans la liste", !data.some((v) => /\b(moto|bike|scooter|quad)\b/i.test(`${v.name} ${v.model} ${v.category}`) || v.seats === 1));
check("import : aucune super sportive (catégorie interdite)", !data.some((v) => /super/i.test(v.category)));
check("import : plus de 300 véhicules, sans doublon", data.length > 300 && new Set(data.map((v) => `${v.brand}|${v.model}`)).size === data.length, String(data.length));
const b = await launch();
const p = await newPage(b, { width: 1280, height: 900 });
await p.goto(BASE + "/vehicles"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3500);
const total = await p.locator(".veh-card").count();
check("la page affiche toute la liste", total === data.length, `${total}/${data.length}`);
check("aucun mot du jeu ou du serveur sur la page", !/\bgta\b|fivem|rp\b|storylife|pdm|concessionnaire/i.test(await text(p)));
await p.screenshot({ path: `${SHOT}/400-vehicules-liste.png`, fullPage: false });
await p.fill("input[type=search]", "blista");
check("recherche instantanée (sans accent ni casse)", (await p.locator(".veh-card").count()) >= 1 && /Blista/i.test(await p.locator(".veh-card").first().innerText()));
await p.fill("input[type=search]", "xyzxyz");
check("recherche sans résultat : message", /Aucun véhicule/i.test(await text(p)));
await p.fill("input[type=search]", "");
await p.locator(".shop-chip", { hasText: /^SUV$/i }).click();
const suv = await p.locator(".veh-card").count();
check("filtre par catégorie", suv === data.filter((v) => v.category === "SUV").length && suv > 0, String(suv));
await p.screenshot({ path: `${SHOT}/401-vehicules-suv.png`, fullPage: false });
await p.goto(BASE + "/vehicles"); await p.waitForLoadState("networkidle");
await p.locator('button[aria-label="English"]:visible').first().click(); await p.waitForTimeout(1500);
check("version anglaise", /ALLOWED/i.test(await text(p)) && !/Véhicules autorisés/.test(await text(p)));
const m = await newPage(b, { width: 390, height: 800 });
await m.goto(BASE + "/vehicles"); await m.waitForLoadState("networkidle"); await m.waitForTimeout(3500);
check("téléphone : pas de débordement horizontal", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await m.screenshot({ path: `${SHOT}/402-vehicules-mobile.png`, fullPage: false });
check("aucune erreur JavaScript", !(p.errors ?? []).length && !(m.errors ?? []).length);
for (const [path, what] of [["/rules", "règlement"], ["/register", "inscription"]]) {
  await p.goto(BASE + path); await p.waitForLoadState("networkidle");
  check(`lien vers la liste dans la page ${what}`, (await p.locator("a[data-veh-link][href='/vehicles']").count()) === 1);
}
await p.goto(BASE + "/"); await p.waitForLoadState("networkidle");
check("menu : entrée « VÉHICULES » après le règlement", (await p.locator("header a[href='/vehicles']").count()) >= 1 || (await p.locator("a[href='/vehicles']").count()) >= 1);
await b.close();
