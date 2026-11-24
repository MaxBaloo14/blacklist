// Compte observateur : créé par le super administrateur, invisible des joueurs, peut consulter et parier, pas d'espace pilote ni d'admin.
import { execSync } from "node:child_process";
import { launch, BASE, SHOT, check, adminPage, newPage, text, act } from "./lib.mjs";
const sql = (q) => execSync(`su postgres -c "psql -d bl_e2e -qc \\"${q}\\""`);
const sqlv = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const b = await launch();
sql(`delete from auth.users where id in (select id from profiles where is_observer)`);
const ad = await adminPage(b);
await ad.goto(BASE + "/admin/drivers"); await ad.waitForLoadState("networkidle");
await ad.locator("summary:has-text('Créer un compte observateur')").click();
await ad.fill("input[name=alias]", "Sergent Test");
await ad.fill("input[name=phone]", "0655555555");
await ad.fill("input[name=password]", "Obs3rvateurSecret");
await ad.screenshot({ path: `${SHOT}/390-observateur-creation.png`, fullPage: false });
await act(ad, "CRÉER LE COMPTE"); await ad.waitForTimeout(2500);
check("compte créé (profil observateur, zigollars non verrouillés)", sqlv("select count(*) from profiles where is_observer") === "1" && sqlv("select locked from point_balances where user_id = (select id from profiles where is_observer)") === "0");
await ad.goto(BASE + "/admin/drivers"); await ad.waitForLoadState("networkidle");
check("le staff voit le compte, marqué INVISIBLE", /Observateur Sergent Test/i.test(await text(ad)) && /INVISIBLE/i.test(await text(ad)));
await ad.screenshot({ path: `${SHOT}/391-observateur-liste-staff.png`, fullPage: false });

// connexion de l'observateur
const o = await newPage(b);
await o.goto(BASE + "/login"); await o.fill('[name=identifier], [name=phone]', "0655555555"); await o.fill('[name=password]', "Obs3rvateurSecret");
await o.locator('button:visible:has-text("CONNEXION"), button:visible:has-text("ENTRER"), button:visible:has-text("SE CONNECTER")').first().click();
await o.waitForTimeout(3500);
await o.goto(BASE + "/profile"); await o.waitForLoadState("networkidle");
check("pas d'espace pilote : /profile renvoie vers la boutique", /\/boutique/.test(o.url()), o.url());
await o.waitForTimeout(3500);
const bt = await text(o);
check("zigollars disponibles, sans ligne « dont … verrouillés »", /10\s?000/.test(bt) && !/dont\s[\d\s\u202f\u00a0]+\s?zigollars de bienvenue verrouill/i.test(bt), bt.slice(0, 300));
await o.screenshot({ path: `${SHOT}/392-observateur-boutique.png`, fullPage: false });
for (const p of ["/blacklist", "/calendar", "/race-network", "/warmup", "/challenges"]) {
  const r = await o.goto(BASE + p); await o.waitForLoadState("networkidle");
  check(`l'observateur consulte ${p}`, r.status() === 200 && !/\/login/.test(o.url()), `${r.status()} ${o.url()}`);
}
const r2 = await o.goto(BASE + "/admin/drivers"); await o.waitForLoadState("networkidle");
check("aucun accès au Control Center", /\/admin\/login/.test(o.url()), o.url());

// le staff voit l'activité de l'observateur (connexion tracée)
const oid = sqlv("select id from profiles where is_observer");
await ad.goto(BASE + `/admin/drivers/${oid}`); await ad.waitForLoadState("networkidle");
check("fiche : activité de l'observateur (connexion tracée)", (await ad.locator("[data-observer-events]").count()) === 1 && /CONNEXION/i.test(await ad.locator("[data-observer-events]").innerText()), await ad.locator("[data-observer-events]").allInnerTexts().then((a) => a.join("|")));
await ad.screenshot({ path: `${SHOT}/393-observateur-activite.png`, fullPage: false });

// invisible pour les joueurs
const id = sqlv("select id from profiles where is_observer");
const pub = await newPage(b);
const rd = await pub.goto(BASE + `/crew`); await pub.waitForLoadState("networkidle");
check("absent de la page des pilotes", !/Sergent|Observateur/i.test(await text(pub)));
await pub.goto(BASE + "/hall-of-fame"); await pub.waitForLoadState("networkidle");
check("absent du Hall of Fame", !/Sergent|Observateur/i.test(await text(pub)));
check("fiche publique inexistante", sqlv(`select count(*) from public_driver where id = '${id}'`) === "0");
check("aucune erreur JavaScript", !(o.errors ?? []).length && !(ad.errors ?? []).length);
sql(`delete from auth.users where id = '${id}'`);
await b.close();
