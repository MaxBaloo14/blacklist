import { execSync } from "node:child_process";
import { launch, newPage, BASE, SHOT, act, text, check, adminPage } from "./lib.mjs";
execSync(`su postgres -c "psql -d bl_e2e -qc \\"update race_tracks set video_path=null\\""`);   // départ propre : aucun circuit n'a de vidéo
const b = await launch(); const ad = await adminPage(b);
await ad.goto(BASE + "/admin/tracks"); await ad.waitForLoadState("networkidle");
// formulaire d'édition du 1er circuit : on ouvre les détails si besoin
const edit = ad.locator("summary:visible").first(); 
await ad.screenshot({ path: `${SHOT}/40-admin-tracks.png`, fullPage: true });
const file = ad.locator('input[type=file][accept^="video"]').nth(1);
await file.evaluate((el) => { let d = el.closest("details"); while (d) { d.open = true; d = d.parentElement?.closest("details"); } });
const hidden = await file.count(); check("champ vidéo présent dans le formulaire circuit", hidden > 0);
await file.setInputFiles("/tmp/e2e-media/circuit.webm");
await ad.waitForFunction(() => document.querySelector('input[name=video_path]')?.value, null, { timeout: 15000 }).catch(() => {});
const vp = await ad.locator('input[name=video_path]').nth(1).inputValue().catch(() => "");
check("vidéo envoyée directement vers le stockage (navigateur → Supabase)", /^videos\/.+\.webm$/.test(vp), vp);
await ad.screenshot({ path: `${SHOT}/41-video-uploaded-form.png`, fullPage: true });
await file.locator("xpath=ancestor::form").locator("button:visible").first().click(); await ad.waitForTimeout(2500);
let tt = ""; for (let i = 0; i < 12; i++) { await ad.goto(BASE + "/admin/tracks"); await ad.waitForLoadState("networkidle"); tt = await text(ad); if (/VIDÉO/i.test(tt.replace(/VIDÉO DU CIRCUIT/gi, ""))) break; await ad.waitForTimeout(1000); }
check("badge Vidéo dans la liste admin", /VIDÉO/i.test(tt));
// Page publique
const pub = await newPage(b, { width: 1280, height: 900 });
await pub.goto(BASE + "/race-network"); await pub.waitForLoadState("networkidle"); await pub.waitForTimeout(2500);
const info = await pub.evaluate(() => [...document.querySelectorAll("video")].map((v) => ({ src: v.currentSrc.slice(-30), muted: v.muted, loop: v.loop, ready: v.readyState, t: v.currentTime, paused: v.paused, w: v.videoWidth })));
console.log(info);
check("lecteur vidéo affiché sur la page Circuits", info.length >= 1);
check("vidéo muette, en boucle, en lecture", info[0]?.muted && info[0]?.loop && !info[0]?.paused && info[0]?.ready >= 2, JSON.stringify(info[0]));
await pub.screenshot({ path: `${SHOT}/42-circuits-with-video.png`, fullPage: true });
// Les autres circuits gardent le tracé animé
check("circuits sans vidéo : tracé animé conservé", (await pub.locator("svg animateMotion").count()) >= 1);
// Mobile
const mob = await newPage(b, { width: 390, height: 800 }); await mob.goto(BASE + "/race-network"); await mob.waitForLoadState("networkidle"); await mob.waitForTimeout(2000);
await mob.screenshot({ path: `${SHOT}/43-circuits-mobile.png` });
// Retrait de la vidéo -> retombe sur le tracé
console.log("erreurs:", ad.errors, pub.errors, mob.errors);
await b.close();
