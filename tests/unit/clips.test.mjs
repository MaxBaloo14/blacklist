// Tests unitaires : reconnaissance des liens de clips (aucune adresse inconnue n'est jamais intégrée).
import assert from "node:assert/strict";
import { parseClip, embedUrl } from "../../lib/clips.ts";

let n = 0; const ok = (name, fn) => { fn(); n++; console.log("PASS ", name); };
ok("YouTube watch", () => assert.equal(parseClip("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.id, "dQw4w9WgXcQ"));
ok("YouTube court", () => assert.equal(parseClip("https://youtu.be/dQw4w9WgXcQ?t=5")?.provider, "youtube"));
ok("YouTube shorts", () => assert.equal(parseClip("https://youtube.com/shorts/dQw4w9WgXcQ")?.id, "dQw4w9WgXcQ"));
ok("Twitch clip (clips.twitch.tv)", () => assert.equal(parseClip("https://clips.twitch.tv/FunnyBraveCatPJSalt-abc123")?.provider, "twitch"));
ok("Twitch clip (chaîne)", () => assert.equal(parseClip("https://www.twitch.tv/coby/clip/BoldSpeedyClip-xyz789")?.provider, "twitch"));
ok("Twitch VOD", () => assert.equal(parseClip("https://www.twitch.tv/videos/123456789")?.provider, "twitch-vod"));
ok("Streamable", () => assert.equal(parseClip("https://streamable.com/abc12")?.provider, "streamable"));
ok("Vimeo", () => assert.equal(parseClip("https://vimeo.com/123456789")?.provider, "vimeo"));
ok("Fichier mp4", () => assert.equal(parseClip("https://exemple.fr/videos/duel.mp4")?.provider, "file"));
ok("http (non sécurisé) refusé", () => assert.equal(parseClip("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null));
ok("javascript: refusé", () => assert.equal(parseClip("javascript:alert(1)"), null));
ok("data: refusé", () => assert.equal(parseClip("data:text/html,<script>alert(1)</script>"), null));
ok("faux domaine refusé", () => assert.equal(parseClip("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"), null));
ok("sous-domaine piège refusé", () => assert.equal(parseClip("https://evil.example/https://youtube.com/watch?v=dQw4w9WgXcQ"), null));
ok("identifiant YouTube trop long refusé", () => assert.equal(parseClip("https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload%3Dalert(1)"), null));
ok("adresse avec identifiants refusée (mp4)", () => assert.equal(parseClip("https://user:pw@exemple.fr/a.mp4"), null));
ok("vide / n'importe quoi", () => { assert.equal(parseClip(""), null); assert.equal(parseClip("pas un lien"), null); assert.equal(parseClip(null), null); });
ok("intégration YouTube sans cookies", () => assert.match(embedUrl(parseClip("https://youtu.be/dQw4w9WgXcQ"), "x.fr"), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/));
ok("intégration Twitch avec le domaine parent", () => assert.match(embedUrl(parseClip("https://clips.twitch.tv/FunnyBraveCatPJSalt-abc123"), "blacklist-snowy.vercel.app"), /parent=blacklist-snowy\.vercel\.app/));
ok("le domaine parent est encodé", () => assert.ok(!embedUrl(parseClip("https://clips.twitch.tv/FunnyBraveCatPJSalt-abc123"), "a&b=c").includes("&b=c")));
console.log(`\n${n} tests unitaires OK`);
