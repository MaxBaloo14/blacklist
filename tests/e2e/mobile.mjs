import { launch, BASE, pilotLogin, adminPage } from "./lib.mjs";
import { createRequire } from "node:module";
const lang = process.env.LANG_TEST ?? "fr";
const outDir = process.env.OUT ?? "/tmp/shots/mob";
const b = await launch();
const mk = async (storage) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "en" ? "en-GB" : "fr-FR", storageState: storage }); const p = await ctx.newPage(); p.errors = []; p.on("pageerror", (e) => p.errors.push(String(e))); return p; };
async function setLang(p, l) { if (l !== "en") return; await p.context().addCookies([{ name: "lang", value: "en", url: BASE }]); }
const report = [];
async function scan(p, path, name) {
  await p.goto(BASE + path); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3600);
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.right > vw + 2 && cs.position !== "fixed" && !e.closest(".tline, .overflow-x-auto, nav .overflow-x-auto, table, svg") && cs.visibility !== "hidden"; }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} (${Math.round(e.getBoundingClientRect().right)})`);
    const small = [...document.querySelectorAll("a, button, input, select, summary")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 30 || b.width < 30) && getComputedStyle(e).visibility !== "hidden" && !e.closest(".splash"); }).length;
    return { scrollW: document.documentElement.scrollWidth, vw, bad, small };
  });
  const over = r.scrollW > r.vw + 1;
  report.push({ name, path, over, bad: r.bad, small: r.small, errs: p.errors.length });
  await p.screenshot({ path: `${outDir}/${lang}-${name}.png`, fullPage: true });
  console.log(`${over || r.bad.length ? "✗" : "✓"} ${path.padEnd(28)} scrollW=${r.scrollW}/${r.vw}  petitsCibles=${r.small}${r.bad.length ? "  DÉBORDE: " + r.bad.join(" | ") : ""}`);
}
const pub = await mk(); await setLang(pub, lang);
const pubPages = [["/", "home"], ["/blacklist", "blacklist"], ["/calendar", "calendar"], ["/hall-of-fame", "hall"], ["/race-network", "circuits"], ["/rules", "rules"], ["/login", "login"], ["/register", "register"], ["/warmup", "warmup"], ["/news", "news"], ["/guide", "guide"], ["/crew", "crew"]];
for (const [path, name] of pubPages) await scan(pub, path, name);
const href = await pub.goto(BASE + "/blacklist").then(() => pub.locator('a[href^="/blacklist/"]').first().getAttribute("href")); await scan(pub, href, "fiche");
const pl = await mk(); await setLang(pl, lang); await pilotLogin(pl, "0600000015");
for (const [path, name] of [["/profile", "profile"], ["/profile?tab=challenges", "profile-challenges"], ["/profile?tab=history", "profile-history"], ["/profile?tab=rewards", "profile-rewards"], ["/profile?tab=garage", "profile-garage"], ["/profile?tab=badges", "profile-badges"], ["/challenges", "challenges"], ["/notifications", "notifications"]]) await scan(pl, path, name);
const ctxA = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "en" ? "en-GB" : "fr-FR" });
const adm = await adminPage(b); await ctxA.close(); const actx = adm.context(); await adm.setViewportSize({ width: 390, height: 844 }); await setLang(adm, lang);
for (const [path, name] of [["/admin", "adm-dash"], ["/admin/drivers", "adm-drivers"], ["/admin/rewards", "adm-rewards"], ["/admin/stats", "adm-stats"], ["/admin/ranking", "adm-ranking"], ["/admin/challenges", "adm-challenges"], ["/admin/templates", "adm-templates"]]) await scan(adm, path, name);
console.log("\nPages avec débordement :", report.filter((r) => r.over || r.bad.length).map((r) => r.path).join(", ") || "aucune"); await b.close();
