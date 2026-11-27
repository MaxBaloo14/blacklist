// Miniatures de véhicules : réduction, refus des fichiers qui ne sont pas des images, plafond de taille.
import http from "node:http";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fetchThumb } from "../../lib/vehicle-image.ts";

const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#884422" } }).png().toBuffer();
const big = Buffer.concat([png, Buffer.alloc(9 * 1024 * 1024)]);
const srv = http.createServer((req, res) => {
  if (req.url === "/hotlink") { if (req.headers.referer !== undefined && req.headers.referer.startsWith(`http://127.0.0.1:${srv.address().port}`)) { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(png); } res.writeHead(403); return res.end(); }
  if (req.url === "/vague") { res.writeHead(200, { "Content-Type": "application/octet-stream" }); return res.end(png); }
  if (req.url === "/ok") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(png); }
  if (req.url === "/html") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>"); }
  if (req.url === "/big") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(big); }
  if (req.url === "/redir") { res.writeHead(302, { Location: "/ok" }); return res.end(); }
  if (req.url === "/broken") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(Buffer.from("pas une image")); }
  res.writeHead(404); res.end();
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
try {
  const out = await fetchThumb(`${base}/ok`, { fallbackProxy: null });
  const m = await sharp(out).metadata();
  assert.equal(m.format, "webp"); assert.equal(m.width, 480); assert.equal(m.height, 300);
  assert.ok(out.length < 45_000, `miniature légère (${out.length} octets)`);
  await fetchThumb(`${base}/redir`, { fallbackProxy: null });                                            // redirection suivie
  await assert.rejects(fetchThumb(`${base}/html`, { fallbackProxy: null }), /pas une image/);
  await assert.rejects(fetchThumb(`${base}/big`, { fallbackProxy: null, maxBytes: 2 * 1024 * 1024 }), /trop lourde/);
  await assert.rejects(fetchThumb(`${base}/missing`, { fallbackProxy: null }), /HTTP 404/);
  await assert.rejects(fetchThumb(`${base}/broken`, { fallbackProxy: null }));
  await assert.rejects(fetchThumb("ftp://exemple.test/x.png", { fallbackProxy: null }), /protocole/);
  await fetchThumb(`${base}/hotlink`, { fallbackProxy: null });                // accepté seulement avec le site d'origine en référent
  await fetchThumb(`${base}/vague`, { fallbackProxy: null });                  // type vague (octet-stream) : décodé quand même
  console.log("OK vehicle-image : 9 contrôles");
} finally { srv.close(); }
