// Importe le catalogue du concessionnaire (premier lien) dans data/vehicles.json, sans les exclusions décidées par l'organisation.
//   node scripts/import-pdm.mjs [url]      (par défaut : l'adresse ci-dessous)
// Le catalogue est lu dans le script public du site ; rien n'est modifié côté concessionnaire.
import { writeFileSync } from "node:fs";
const slugOf = (brand, model) => `${brand}-${model}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const URL0 = process.argv[2] ?? "https://pdm-premium-deluxe-motorsport-558464922075.europe-west1.run.app/";

// Exclusions : Paragon (R et S), catégorie Super sportives (interdite par le règlement) et tout véhicule à deux roues (motos, quads, vélos…)
const EXCLUDE_CATEGORY = /^super sportives?$/i;
const EXCLUDE_NAME = /paragon/i;
const TWO_WHEELS = /\b(moto|motos|motocyclette|scooter|bike|deux[- ]roues|2[- ]roues|v[ée]lo|bmx|quad)\b|\b(akuma|bati|pcj|sanchez|faggio|hexer|vader|bagger|daemon|nemesis|double-t|ruffian|lectro|esskey|diablous|chimera|manchez|avarus|zombie|sovereign|cliffhanger|gargoyle|wolfsbane|defiler|fcr|oppressor|shotaro|reever|vortex|stryder|rampant|sanctus|hakuchou|carbon rs|thrust|bf400|scorcher|tribike)\b/i;

const base = new URL(URL0);
const html = await (await fetch(base)).text();
const src = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
if (!src) throw new Error("Script du catalogue introuvable.");
const js = await (await fetch(new URL(src, base))).text();

const q = '"((?:[^"\\\\]|\\\\.)*)"';
const re = new RegExp(`\\{id:"([^"]+)",name:${q},brand:${q},model:${q},category:"([^"]*)",price:([0-9.e]+),(.*?),createdAt:`, "gs");
const num = (body, k) => { const m = body.match(new RegExp(`${k}:([0-9.e]+)`)); return m ? Math.round(Number(m[1])) : null; };
const images = {};
const seen = new Map(), dropped = { paragon: [], twoWheels: [], supers: 0 };
for (const m of js.matchAll(re)) {
  const [, id, name, brand, model, category, , body] = m;
  if (id === "pdm-showroom-fallback" || seen.has(id)) continue;
  const desc = body.match(/description:"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
  const row = { name: name.replace(/‑/g, "-").trim(), brand: brand.trim(), model: model.replace(/‑/g, "-").trim(), category, hp: num(body, "powerHp"), seats: num(body, "seats"), trunk: num(body, "trunkKg"), fuel: body.match(/fuelType:"([^"]*)"/)?.[1] ?? null, gearbox: body.match(/transmission:"([^"]*)"/)?.[1] ?? null };
  if (EXCLUDE_NAME.test(`${name} ${model}`)) { dropped.paragon.push(row.name); continue; }
  if (EXCLUDE_CATEGORY.test(category)) { dropped.supers++; continue; }
  if (TWO_WHEELS.test(`${name} ${model} ${category}`) || /\b(moto|deux[- ]roues|2[- ]roues|motocyclette)\b/i.test(desc) || row.seats === 1) { dropped.twoWheels.push(row.name); continue; }
  const img = body.match(/imageUrl:"(https:\/\/[^"]+)"/)?.[1];
  row.slug = slugOf(row.brand, row.model);
  if (img) { images[row.slug] = img; row.img = true; }
  seen.set(id, row);
}
const ORDER = ["Compactes", "Berlines", "Coupés", "Sportives", "Sportives Classiques", "Grosse cylindrées", "Lowrider", "Drift", "Rallye", "SUV", "Vans"];
const list = [...seen.values()].sort((a, b) => (ORDER.indexOf(a.category) - ORDER.indexOf(b.category)) || a.name.localeCompare(b.name, "fr"));
writeFileSync(new URL("../data/vehicles.json", import.meta.url), JSON.stringify({ source: "concessionnaire", importedAt: new Date().toISOString().slice(0, 10), vehicles: list }, null, 1));
writeFileSync(new URL("../data/vehicle-images.json", import.meta.url), JSON.stringify(images, null, 1));   // adresses d'origine : lues uniquement par le serveur, jamais envoyées au navigateur
console.log(`${list.length} véhicules importés · Paragon retirés : ${dropped.paragon.join(", ") || "aucun"} · deux-roues retirés : ${dropped.twoWheels.join(", ") || "aucun"} · super sportives retirées : ${dropped.supers}`);
