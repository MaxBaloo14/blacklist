import { createRequire } from "node:module";
const require = createRequire((process.env.PW_ROOT ?? "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
export const BASE = "http://127.0.0.1:3100";
export const SHOT = "/tmp/shots/e2e";
export async function launch() {
  const browser = await chromium.launch();
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
