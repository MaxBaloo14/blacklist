// Protection contre les essais répétés : sur un second serveur où la limite est ACTIVE, la 9e tentative de connexion est bloquée.
import { spawn } from "node:child_process";
import { launch, check } from "./lib.mjs";
const env = { ...process.env, DISABLE_RATE_LIMIT: "0", PORT: "3101", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_e2e", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_e2e" };
const srv = spawn("npx", ["next", "start", "-p", "3101"], { env, stdio: "ignore", detached: true });
const URL = "http://127.0.0.1:3101";
for (let i = 0; i < 40; i++) { try { if ((await fetch(URL + "/login")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
const b = await launch(); const p = await (await b.newContext()).newPage();
await p.goto(URL + "/login"); await p.waitForLoadState("networkidle");
let blocked = false, wrong = 0;
for (let i = 0; i < 10 && !blocked; i++) {
  await p.fill("[name=phone]", "0600000015"); await p.fill("[name=password]", "mauvais-mot-de-passe");
  await p.locator('button:visible:has-text("SE CONNECTER")').first().click(); await p.waitForTimeout(700);
  const t = await p.locator("body").innerText();
  if (/Trop de tentatives/.test(t)) blocked = true; else if (/incorrects/.test(t)) wrong++;
}
check("les premiers essais ratés sont refusés normalement", wrong >= 6, String(wrong));
check("après 8 essais, la connexion est bloquée (« Trop de tentatives »)", blocked, `bloqué après ${wrong} essais`);
await b.close(); try { process.kill(-srv.pid); } catch {} srv.kill();
