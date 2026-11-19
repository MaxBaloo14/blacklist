// Clips intégrés : bouton, fenêtre, adresse d'intégration, liens inconnus laissés en simples liens.
import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, check, text } from "./lib.mjs";
const psql = (q) => execSync(`su postgres -c "psql -d bl_e2e -Atc \\"${q}\\""`).toString().trim();
const ids = psql("select id from challenges where status='completed' order by validated_at desc").split("\n");
psql(`update challenges set clip_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ' where id='${ids[0]}'`);
psql(`update challenges set clip_url='https://clips.twitch.tv/FunnyBraveCatPJSalt-abc123' where id='${ids[1]}'`);
psql(`update challenges set clip_url='https://exemple-inconnu.fr/mon-clip' where id='${ids[2]}'`);
await new Promise((r) => setTimeout(r, 16000));   // le site garde les duels en mémoire 15 s : on laisse le cache expirer
const b = await launch(); const p = await newPage(b, { width: 1300, height: 900 });
// le site sert d'abord la version en mémoire puis la rafraîchit en arrière-plan : on recharge jusqu'à voir les clips
let n = 0;
for (let i = 0; i < 6 && n === 0; i++) { await p.goto(BASE + "/clips"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(i === 0 ? 3800 : 2500); n = await p.locator(".clip-card").count(); }
check("page Clips : seuls les clips reconnus sont listés (2 sur 3)", n === 2, String(n));
await p.screenshot({ path: `${SHOT}/230-clips.png`, fullPage: true });
check("aucun cadre externe n'est chargé avant le clic", (await p.locator("iframe").count()) === 0);
await p.locator(".clip-card .clip-btn").first().click(); await p.waitForTimeout(800);
const src = await p.locator("dialog[open] iframe").getAttribute("src");
check("YouTube/Twitch : cadre ouvert avec l'adresse d'intégration", /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|clips\.twitch\.tv\/embed\?clip=)/.test(src ?? ""), src ?? "");
const sb = await p.locator("dialog[open] iframe").getAttribute("sandbox");
check("le cadre est isolé (sandbox)", /allow-scripts/.test(sb ?? "") && !/allow-top-navigation/.test(sb ?? ""), sb ?? "");
await p.screenshot({ path: `${SHOT}/231-clip-dialog.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
check("Échap ferme la fenêtre", (await p.locator("dialog[open]").count()) === 0);
await p.locator(".clip-card .clip-btn").nth(1).click(); await p.waitForTimeout(600);
const src2 = await p.locator("dialog[open] iframe").getAttribute("src");
check("Twitch : le domaine du site est passé en paramètre parent", /parent=127\.0\.0\.1/.test(src2 ?? ""), src2 ?? "");
await p.keyboard.press("Escape");
// Sur le classement : le clip inconnu reste un simple lien externe sûr
let ok = false;
for (let i = 0; i < 6 && !ok; i++) { await p.goto(BASE + "/blacklist"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(i === 0 ? 3800 : 2500); ok = (await p.locator("button.clip-btn").count()) >= 2; }
const ext = p.locator('a.clip-btn[href="https://exemple-inconnu.fr/mon-clip"]');
check("clip d'un site inconnu : simple lien (jamais intégré)", (await ext.count()) === 1 && (await ext.getAttribute("rel")) === "noopener noreferrer" && (await ext.getAttribute("target")) === "_blank");
check("clip reconnu : bouton « Regarder le clip » sur le duel", (await p.locator("button.clip-btn").count()) >= 2);
const errs = p.errors.filter((e) => !/Permissions policy violation/.test(e));   // message bénin du lecteur intégré
check("aucune erreur console", errs.length === 0, errs.join(" | "));
await b.close();
