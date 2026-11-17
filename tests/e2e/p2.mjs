import { launch, newPage, BASE, SHOT, act, text } from "./lib.mjs";
const b = await launch(); const p = await newPage(b);
await p.goto(BASE + "/admin/login");
await p.fill('[name=email]', "orga@test.local"); await p.fill('[name=password]', "MotDePasseOrga123");
await act(p, "ENTRER"); console.log(p.url());
for (const path of ["", "/drivers", "/vehicles", "/ranking"]) {
  await p.goto(BASE + "/admin" + path); await p.waitForTimeout(1500); console.log("=== " + path, p.url(), (await text(p)).slice(0, 900));
  await p.screenshot({ path: `${SHOT}/adm${path.replace("/", "-") || "-dash"}.png` });
}
console.log(p.errors); await b.close();
