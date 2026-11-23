import { createRequire } from "node:module";
// Playwright : installé dans le projet (CI) ou globalement (poste de travail)
const { chromium } = (() => {
  for (const base of [process.env.PW_ROOT, process.cwd(), "/opt/node22/lib/node_modules"].filter(Boolean)) {
    try { return createRequire(base.replace(/\/?$/, "/"))("playwright"); } catch { /* suivant */ }
  }
  throw new Error("Playwright introuvable : npm i --no-save playwright && npx playwright install chromium");
})();
export const BASE = "http://127.0.0.1:3100";
export const SHOT = "/tmp/shots/e2e";
export async function launch() {
  // En tant que root (CI, conteneur) Chromium exige --no-sandbox
  const browser = await chromium.launch({ args: process.getuid?.() === 0 ? ["--no-sandbox"] : [] });
  return browser;
}
export async function newPage(browser, vp = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "fr-FR" });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of (401|404)/.test(m.text())) page.errors.push(m.text()); });
  return page;
}
export const results = [];
export function check(name, ok, info = "") { results.push({ name, ok: !!ok, info }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`); }
/** Clique un bouton d'action et confirme la boîte de dialogue éventuelle. */
export async function act(page, label, { form } = {}) {
  const t0 = Date.now();
  try { return await act_(page, label, { form }); } finally { if (process.env.ACT_TRACE) console.log(`act ${label} ${Date.now() - t0} ms`); }
}
async function act_(page, label, { form } = {}) {
  const scope = form ? page.locator(form) : page;
  await scope.locator(`button:visible:has-text("${label}")`).first().click();
  await page.waitForTimeout(500);
  const ok = page.locator('dialog[open] button:has-text("CONFIRMER")');
  if (await ok.count()) await ok.first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}
export const text = async (p) => (await p.locator("body").innerText()).replace(/\n+/g, " | ");
import fs from "node:fs";
const STATE = "/tmp/e2e-admin-state.json";
export async function adminPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fr-FR", storageState: fs.existsSync(STATE) ? STATE : undefined });
  const page = await ctx.newPage(); page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  await page.goto(BASE + "/admin");
  if (/\/admin\/login/.test(page.url())) {
    await page.fill('[name=email]', "orga@test.local"); await page.fill('[name=password]', "MotDePasseOrga123");
    await act(page, "ENTRER"); await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
    await ctx.storageState({ path: STATE });
  }
  return page;
}
export async function pilotLogin(p, phone) {
  await p.goto(BASE + "/login");
  await p.fill('[name=identifier], [name=phone]', phone); await p.fill('[name=password]', "PiloteTest12345");
  await p.locator('button:visible:has-text("CONNEXION"), button:visible:has-text("ENTRER"), button:visible:has-text("SE CONNECTER")').first().click();
  await p.waitForURL(/\/profile|\/challenges/, { timeout: 15000 });
}

// Un seul échec suffit à faire échouer le script (utilisé par l'exécution automatique et la CI)
process.on("exit", (code) => { if (!code && results.some((r) => !r.ok)) process.exitCode = 1; });
/** Heure de Paris (format datetime-local) dans `ms` millisecondes, sans jamais passer à la semaine suivante :
 *  le site exige un duel dans la semaine en cours, donc le test doit marcher n'importe quel jour (même un dimanche soir). */
export function parisSoon(ms = 3600_000) {
  const fmt = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d).replace(" ", "T");
  const wd = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(d);
  let t = new Date(Date.now() + ms);
  if (wd(t) === "Mon" && wd(new Date()) !== "Mon") t = new Date(Date.now() + 120_000);
  return fmt(t);
}

/** Remplit les 3 créneaux du formulaire de défi : dernier jour de la semaine (dimanche), 22 h 30 / 23 h 00 / 23 h 30 (heure de Paris). */
export async function fillSlots(page) {
  for (const [i, time] of [[1, "22:30"], [2, "23:00"], [3, "23:30"]]) {
    const days = await page.locator(`[name=slot_day_${i}] option:not([disabled])`).evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    await page.selectOption(`[name=slot_day_${i}]`, days[days.length - 1]);
    await page.selectOption(`[name=slot_time_${i}]`, time);
  }
}
/** Le défié choisit le premier créneau proposé. */
export async function pickSlot(page) { await page.locator("input[name=slot]").first().check(); }
