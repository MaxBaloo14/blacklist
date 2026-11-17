import { launch, newPage, BASE, SHOT, act, text, check } from "./lib.mjs";
const b = await launch(); const p = await newPage(b);
await p.goto(BASE + "/admin/login");
await p.fill('[name=email]', "orga@test.local"); await p.fill('[name=password]', "MotDePasseOrga123"); await act(p, "ENTRER");
// 1. valider les inscriptions
await p.goto(BASE + "/admin/drivers");
const hrefs = await p.locator('a[href^="/admin/drivers/"]').evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")))]);
console.log("fiches:", hrefs.length);
for (const h of hrefs) {
  await p.goto(BASE + h);
  await p.selectOption('[name=decision]', "validated");
  await act(p, "ENREGISTRER LA DÉCISION");
}
await p.goto(BASE + "/admin/drivers"); const t1 = await text(p);
check("3 inscriptions validées", (t1.match(/VALIDÉE/g) ?? []).length >= 3, t1.slice(t1.indexOf("PILOTE\t"), t1.indexOf("PILOTE\t") + 400));
await p.screenshot({ path: `${SHOT}/10-admin-drivers.png` });
// 2. homologuer les véhicules
for (let i = 0; i < 3; i++) { await p.goto(BASE + "/admin/vehicles"); if (!(await p.locator('button:has-text("HOMOLOGUER")').count())) break; await act(p, "HOMOLOGUER"); }
await p.goto(BASE + "/admin/vehicles"); const tv = await text(p);
check("3 véhicules engagés", /VÉHICULES ENGAGÉS \(3\)/.test(tv), tv.match(/VÉHICULES ENGAGÉS \(\d\)/)?.[0]);
await p.screenshot({ path: `${SHOT}/11-admin-vehicles.png` });
// 3. classement manuel : Bravo 10, Alpha 9, Charlie 8
await p.goto(BASE + "/admin/ranking");
const sel = async (pos, name) => { const s = p.locator(`[name=pos${pos}]`); const v = await s.locator("option", { hasText: name }).first().getAttribute("value"); await s.selectOption(v); };
await sel(10, "Bravo"); await sel(9, "Alpha"); await sel(8, "Charlie");
await p.fill('[name=reason]', "Mise en place initiale du classement");
await act(p, "APPLIQUER LA MODIFICATION");
await p.goto(BASE + "/blacklist"); const tb = await text(p);
check("classement public à jour", /ALPHA/i.test(tb) && /BRAVO/i.test(tb) && /CHARLIE/i.test(tb));
await p.screenshot({ path: `${SHOT}/12-blacklist-public.png`, fullPage: true });
check("aucune erreur console (admin)", p.errors.length === 0, p.errors.join(" ; "));
await b.close();
