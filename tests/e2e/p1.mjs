import { launch, newPage, BASE, SHOT, check, act, text } from "./lib.mjs";
const b = await launch();
const pilots = [["Alpha","Un","0600000001"],["Bravo","Deux","0600000002"],["Charlie","Trois","0600000003"]];
for (const [ln, fn, ph] of pilots) {
  const p = await newPage(b);
  await p.goto(BASE + "/register");
  await p.fill('[name=last_name]', ln); await p.fill('[name=first_name]', fn); await p.fill('[name=phone]', ph);
  await p.fill('[name=password]', "PiloteTest12345"); await p.fill('[name=make_model]', `Test ${ln} GT`);
  await p.selectOption('[name=vehicle_class]', { index: 1 });
  await p.screenshot({ path: `${SHOT}/01-register-${ln}.png` });
  await act(p, "ENVOYER");
  console.log(ln, p.url(), (await text(p)).slice(0, 400), p.errors);
  await p.screenshot({ path: `${SHOT}/02-after-register-${ln}.png` });
  await p.context().close();
}
await b.close();
