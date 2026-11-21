// Plans de course : image + petite voiture qui suit le tracé rouge du départ à l'arrivée.
import { launch, newPage, BASE, SHOT, check, adminPage, text } from "./lib.mjs";
const b = await launch();
const p = await newPage(b, { width: 1300, height: 1000 });
let n = 0;
for (let i = 0; i < 6 && n < 5; i++) { await p.goto(BASE + "/race-network"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(i ? 2500 : 3800); n = await p.locator(".route-zoom").count(); }
check("5 plans de course affichés avec leur carte", n === 5, String(n));
const imgs = await p.locator('div[style*="aspect-ratio"] img').evaluateAll((a) => a.map((i) => ({ ok: i.complete && i.naturalWidth > 100, src: i.currentSrc.split("/").pop() })));
await p.locator(".route-zoom").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
const imgs2 = await p.locator('div[style*="aspect-ratio"] img').evaluateAll((a) => a.map((i) => ({ ok: i.complete && i.naturalWidth > 100, src: i.currentSrc.split("/").pop() })));
check("les images des cartes se chargent (version légère sur les cartes)", imgs2.length === 5 && imgs2.every((i) => /-md\.webp$/.test(i.src)), JSON.stringify(imgs2.map((i) => i.src)));
check("aucune distance inventée : « — » quand elle est inconnue", (await text(p)).split("DISTANCE | —").length - 1 >= 5);
await p.screenshot({ path: `${SHOT}/270-circuits.png`, fullPage: false });

// Animation : on pilote le temps de la 1re carte et on vérifie que la voiture reste SUR le tracé, du départ à l'arrivée
const card = p.locator('div[style*="aspect-ratio"]').first();
await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
const info = await card.evaluate((box) => {
  const svg = box.querySelector("svg"); const am = svg.querySelector("animateMotion"); const g = am.parentElement;
  const path = svg.querySelector("defs path");
  const cycle = parseFloat(am.getAttribute("dur")); const f = parseFloat(am.getAttribute("keyTimes").split(";")[1]); const dur = cycle * f;
  const vb = svg.viewBox.baseVal; const len = path.getTotalLength();
  const samples = Array.from({ length: 700 }, (_, i) => path.getPointAtLength((len * i) / 699));
  svg.pauseAnimations();
  const rows = []; const frames = [0.001, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.999];
  const out = [];
  for (const fr of frames) {
    svg.setCurrentTime(dur * fr);
    const r = svg.getBoundingClientRect(); const c = g.querySelector('[data-car="body"]').getBoundingClientRect();
    const x = ((c.left + c.width / 2 - r.left) / r.width) * vb.width, y = ((c.top + c.height / 2 - r.top) / r.height) * vb.height;
    const dmin = Math.min(...samples.map((s) => Math.hypot(s.x - x, s.y - y)));
    out.push({ fr, x: Math.round(x), y: Math.round(y), dev: +dmin.toFixed(1), op: getComputedStyle(g).opacity });
  }
  const end = path.getPointAtLength(len); const start = path.getPointAtLength(0);
  return { cycle, dur: +dur.toFixed(2), len: Math.round(len), out, start: [Math.round(start.x), Math.round(start.y)], end: [Math.round(end.x), Math.round(end.y)], vb: [vb.width, vb.height] };
});
console.log(JSON.stringify(info));
check("la voiture reste sur le tracé à chaque instant (écart max < 14 px de l'image)", info.out.every((o) => o.dev < 14), info.out.map((o) => o.dev).join(", "));
check("elle part du départ", Math.hypot(info.out[0].x - info.start[0], info.out[0].y - info.start[1]) < 20, `${info.out[0].x},${info.out[0].y} vs ${info.start}`);
check("elle arrive à l'arrivée", Math.hypot(info.out.at(-1).x - info.end[0], info.out.at(-1).y - info.end[1]) < 20, `${info.out.at(-1).x},${info.out.at(-1).y} vs ${info.end}`);
check("elle avance vraiment (positions toutes différentes)", new Set(info.out.map((o) => `${Math.round(o.x / 15)},${Math.round(o.y / 15)}`)).size >= 7);
check("la voiture est visible pendant toute la course", info.out.slice(1).every((o) => Number(o.op) > 0.5));
// captures à plusieurs moments
for (const [i, fr] of [[1, 0.001], [2, 0.3], [3, 0.6], [4, 0.999]]) {
  await card.evaluate((box, [d, fr]) => { const svg = box.querySelector("svg"); svg.pauseAnimations(); svg.setCurrentTime(d * fr); }, [info.dur, fr]);
  await p.waitForTimeout(150);
  await card.screenshot({ path: `${SHOT}/271-voiture-${i}.png` });
}
// pause quand la carte n'est plus visible
await p.evaluate(() => window.scrollTo(0, 0)); await p.mouse.wheel(0, 4000); await p.waitForTimeout(800);
// Agrandir
await p.locator(".route-zoom").first().scrollIntoViewIfNeeded(); await p.locator(".route-zoom").first().click(); await p.waitForTimeout(1500);
const big = await p.locator("dialog[open] img").evaluate((i) => ({ src: i.currentSrc.split("/").pop(), w: i.naturalWidth }));
check("« Agrandir » ouvre la carte en grande taille (image complète)", big.src === "course-1.webp" && big.w >= 1400, JSON.stringify(big));
check("la voiture est aussi sur la grande carte", (await p.locator("dialog[open] animateMotion").count()) === 1);
await p.screenshot({ path: `${SHOT}/272-agrandi.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
check("Échap ferme la grande carte", (await p.locator("dialog[open]").count()) === 0);
// Réduction des animations
const rctx = await b.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: "reduce" }); const rp = await rctx.newPage();
for (let i = 0; i < 6; i++) { await rp.goto(BASE + "/race-network"); await rp.waitForLoadState("networkidle"); await rp.waitForTimeout(2500); if (await rp.locator(".route-zoom").count() === 5) break; }
check("animations réduites : aucune animation, voiture posée au départ", (await rp.locator('div[style*="aspect-ratio"] animateMotion').count()) === 0 && (await rp.locator('div[style*="aspect-ratio"] svg g[transform^="translate"]').count()) === 5);
// Téléphone
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
for (let i = 0; i < 6; i++) { await m.goto(BASE + "/race-network"); await m.waitForLoadState("networkidle"); await m.waitForTimeout(2500); if (await m.locator(".route-zoom").count() === 5) break; }
await m.locator(".route-zoom").first().scrollIntoViewIfNeeded(); await m.waitForTimeout(1500);
check("téléphone : la carte tient dans l'écran", await m.evaluate(() => document.documentElement.scrollWidth <= 391));
await m.screenshot({ path: `${SHOT}/273-mobile.png` });
// Administration
const ad = await adminPage(b); await ad.setViewportSize({ width: 1300, height: 900 }); await ad.goto(BASE + "/admin/tracks"); await ad.waitForLoadState("networkidle"); await ad.waitForTimeout(900);
const ta = await text(ad);
check("Control Center : 5 badges « Tracé animé » et miniatures", (ta.match(/TRACÉ ANIMÉ/g) ?? []).length === 5 && (await ad.locator('img[src^="/img/circuits/"]').count()) === 5);
await ad.screenshot({ path: `${SHOT}/274-admin-circuits.png`, fullPage: false });
check("aucune erreur console", (p.errors ?? []).length === 0, (p.errors ?? []).join(" | "));
await b.close();
