import fs from "node:fs";
import { launch, newPage, BASE, pilotLogin, adminPage } from "./lib.mjs";
const axeSrc = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const b = await launch();
async function scan(page, path, label) {
  await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3800);
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  const v = res.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, sample: x.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? "").slice(0, 90)) }));
  console.log(`\n## ${label} ${path} — ${v.length} type(s) de violations`); v.forEach((x) => console.log(`  [${x.impact}] ${x.id} ×${x.n}\n     ${x.sample.join("\n     ")}`));
  return v.length;
}
let total = 0;
const pub = await newPage(b, { width: 1400, height: 900 });
for (const p of ["/", "/blacklist", "/calendar", "/hall-of-fame", "/race-network", "/rules", "/login", "/register", "/warmup", "/news", "/guide"]) total += await scan(pub, p, "public");
const lio = await newPage(b, { width: 1400, height: 900 }); await pilotLogin(lio, "0600000015");
for (const p of ["/profile", "/profile?tab=badges", "/challenges", "/notifications"]) total += await scan(lio, p, "pilote");
const ad = await adminPage(b); await ad.setViewportSize({ width: 1400, height: 900 });
for (const p of ["/admin", "/admin/drivers", "/admin/rewards", "/admin/stats", "/admin/templates", "/admin/exports"]) total += await scan(ad, p, "admin");
console.log("\nTOTAL types de violations :", total); await b.close();
