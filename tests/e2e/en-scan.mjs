import { launch, BASE, pilotLogin, adminPage } from "./lib.mjs";
const b = await launch();
const FR = /[éèêëàâùûçôîï]|\b(le|la|les|de|du|des|et|pour|une|un|ton|ta|tes|sur|avec|dans|est|pas|ce|cette|sont|vous|tu|ou|qui|que|aux|ne|plus)\b/i;
const DATA = /Boucle rapide|Tracé de la dernière|Long sprint urbain|Last Race|La Mesa|Cypress|Palomino|Compactes|Coupés|Muscle|Sportives|Supersportives|Berlines|Tout-terrain|Motos|^\[(aria-label|title)\] Français$|Compte en double|Dossier incomplet|Numéro de téléphone injoignable|Catégorie interdite|Modèle incorrect|Véhicule de boutique|Absence justifiée|Délai dépassé|Pilote injoignable|Un compte existe déjà|Ton dossier est incomplet|Ton numéro de téléphone semble|Cette catégorie de véhicule|Le modèle indiqué|Les véhicules de boutique ne sont|Duel annulé|Compact|Permanently delete/i;
const OK = /^(BBC|BLACKLIST|Los Santos|DISCORD|WARM-UP|CASH PRIZE|IBAN|CSV|BooBoo Crew|A BOOBOO CREW PRODUCTION\.?|Blacklist — there is no second place\.|10 DRIVERS\. 10 POSITIONS\. ONE KING\.|Two brothers\.|One mission\.)/i;
const seen = new Map();
async function scan(p, path, label) {
  await p.goto(BASE + path); await p.waitForLoadState("networkidle"); await p.waitForTimeout(3600);
  const texts = await p.evaluate(() => {
    const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t || t.length < 3) continue; const el = n.parentElement; if (!el || el.closest("script,style,noscript,.sr-only-ignore")) continue; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue; out.add(t); }
    // attributs visibles à l'utilisateur
    document.querySelectorAll("[aria-label],[title],[placeholder]").forEach((e) => ["aria-label", "title", "placeholder"].forEach((a) => { const v = e.getAttribute(a); if (v && v.length > 2) out.add(`[${a}] ${v}`); }));
    return [...out];
  });
  const bad = texts.filter((t) => FR.test(t) && !OK.test(t) && !DATA.test(t));
  console.log(`\n## ${label} ${path} — ${bad.length} texte(s) à vérifier`); bad.forEach((t) => { console.log("   " + t.slice(0, 140)); seen.set(t, (seen.get(t) ?? 0) + 1); });
}
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: "en-GB" }); await ctx.addCookies([{ name: "lang", value: "en", url: BASE }]); const p = await ctx.newPage(); return p; };
const pub = await mk();
for (const p of ["/", "/blacklist", "/calendar", "/hall-of-fame", "/race-network", "/boutique", "/boutique?tab=paris", "/rules", "/login", "/register", "/warmup", "/news", "/guide", "/crew"]) await scan(pub, p, "public");
const href = await pub.goto(BASE + "/blacklist").then(() => pub.locator('a[href^="/blacklist/"]').first().getAttribute("href")); await scan(pub, href, "fiche");
const plCtx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const pl = await plCtx.newPage(); await pilotLogin(pl, "0600000015"); await pl.context().addCookies([{ name: "lang", value: "en", url: BASE }]);
for (const p of ["/profile", "/profile?tab=challenges", "/profile?tab=history", "/profile?tab=rewards", "/profile?tab=garage", "/profile?tab=badges", "/challenges", "/notifications"]) await scan(pl, p, "pilote");
await pl.locator("button.bell:visible").first().click().catch(() => {}); await pl.waitForTimeout(1200); await scan(pl, "/blacklist", "pilote+cloche");
await plCtx.addCookies([{ name: "lang", value: "en", url: BASE }]);
const ad = await adminPage(b); await ad.setViewportSize({ width: 1400, height: 900 }); await ad.context().addCookies([{ name: "lang", value: "en", url: BASE }]);
for (const p of ["/admin", "/admin/drivers", "/admin/rewards", "/admin/stats", "/admin/ranking", "/admin/challenges", "/admin/templates", "/admin/exports", "/admin/vehicles", "/admin/tracks", "/admin/warmup", "/admin/reserve", "/admin/inactivity", "/admin/news", "/admin/rules", "/admin/logs"]) await scan(ad, p, "admin");
console.log("\n=== TEXTES FRANÇAIS NON TRADUITS :", seen.size); await b.close(); if (seen.size > 0) process.exitCode = 1;
