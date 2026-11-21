#!/usr/bin/env python3
"""
Montage « duel BLACKLIST » : habille un clip (MP4) avec l'identité visuelle du site.

  python3 tools/montage/montage.py --config duel.json --clip mon-clip.mp4 --out duel.mp4
  python3 tools/montage/montage.py --config duel.json --demo --out apercu.mp4     # fond de démonstration (sans clip)
  python3 tools/montage/montage.py --config duel.json --demo --stills apercu/     # images fixes seulement

Chronologie : intro (3 s) → clip avec bandeau d'information → résultat (4 dernières secondes) → carte de fin (3 s).
Le clip n'est jamais modifié dans son contenu : on ajoute un étalonnage sombre, un grain, des bandeaux et des cartes.
Prérequis : ffmpeg, Python 3 avec Pillow.
"""
import argparse, json, math, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RED, RED_D, BONE, METAL, INK, INK2 = (198, 40, 40), (120, 24, 24), (244, 244, 244), (139, 144, 152), (9, 10, 12), (18, 20, 24)
INTRO, OUTRO, RESULT = 3.0, 3.2, 4.0
FPS = 30


def font(name, size):
    return ImageFont.truetype(os.path.join(HERE, "fonts", f"{name}.ttf"), int(size))


def ease(t):  # sortie en douceur
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def clamp01(x):
    return max(0.0, min(1.0, x))


class Scene:
    """Dessine toutes les images (RGBA 1280×720, mises à l'échelle à la fin si besoin)."""

    def __init__(self, cfg, clip_dur):
        self.c, self.W, self.H = cfg, 1280, 720
        self.clip_dur = clip_dur
        self.total = INTRO + clip_dur + OUTRO
        self.A = lambda s: font("anton-latin-400-normal", s)
        self.B = lambda s: font("barlow-condensed-latin-700-normal", s)
        self.B6 = lambda s: font("barlow-condensed-latin-600-normal", s)
        self.M = lambda s: font("permanent-marker-latin-400-normal", s)
        rnd = random.Random(7)
        self.grain = [self._grain(rnd) for _ in range(6)]
        ch, df = cfg["challenger"], cfg["defender"]
        self.win = ch if cfg.get("winner", "challenger") == "challenger" else df
        self.lose = df if self.win is ch else ch

    # ---------- briques ----------
    def _grain(self, rnd, a=9):
        g = Image.effect_noise((self.W // 2, self.H // 2), 90).resize((self.W, self.H))
        return Image.merge("RGBA", (g, g, g, g.point(lambda v: a if v > 128 else 0)))

    def plate(self, d, x, y, w, h, fill, cut=14, outline=None, ow=2):
        pts = [(x + cut, y), (x + w, y), (x + w - cut, y + h), (x, y + h)]
        d.polygon(pts, fill=fill)
        if outline:
            d.line(pts + [pts[0]], fill=outline, width=ow)

    def text(self, d, xy, s, f, fill, anchor="la", spacing=0):
        if spacing:
            x, y = xy
            total = sum(d.textlength(ch, font=f) + spacing for ch in s) - spacing
            if anchor[0] == "m": x -= total / 2
            elif anchor[0] == "r": x -= total
            for ch in s:
                d.text((x, y), ch, font=f, fill=fill, anchor="l" + anchor[1]); x += d.textlength(ch, font=f) + spacing
        else:
            d.text(xy, s, font=f, fill=fill, anchor=anchor)

    def slash(self, d, x, y, w, h, fill=RED):
        d.polygon([(x + h * 0.55, y), (x + w + h * 0.55, y), (x + w, y + h), (x, y + h)], fill=fill)

    def logo(self, d, x, y, size=34, alpha=255):
        a, b = self.A(size), self.B(size * 0.38)
        w1 = d.textlength("BLACK", font=a)
        d.text((x, y), "BLACK", font=a, fill=(*BONE, alpha)); d.text((x + w1, y), "LIST", font=a, fill=(*RED, alpha))
        self.text(d, (x + w1 + d.textlength("LIST", font=a) + 14, y + size * 0.55), "BOOBOO CREW", b, (*METAL, alpha), spacing=3)

    def vignette(self, im, strength=150):
        v = Image.radial_gradient("L").resize((self.W, self.H)).point(lambda p: int(min(255, p * strength / 255 * 1.0)))
        black = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0)); black.putalpha(v)
        im.alpha_composite(black)

    # ---------- INTRO (opaque) ----------
    def intro(self, t):
        im = Image.new("RGBA", (self.W, self.H), (*INK, 255)); d = ImageDraw.Draw(im, "RGBA")
        for gx in range(0, self.W, 40): d.line([(gx, 0), (gx, self.H)], fill=(255, 255, 255, 6))
        for gy in range(0, self.H, 40): d.line([(0, gy), (self.W, gy)], fill=(255, 255, 255, 6))
        # halo rouge qui pulse
        halo = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0)); hd = ImageDraw.Draw(halo)
        r = 260 + 30 * math.sin(t * 3)
        hd.ellipse([self.W / 2 - r, self.H / 2 - r * 0.6, self.W / 2 + r, self.H / 2 + r * 0.6], fill=(*RED, 70))
        im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(70)))
        d = ImageDraw.Draw(im, "RGBA")
        d.text((self.W // 2, 120), "", font=self.B(10))
        # kicker
        k = ease((t - 0.1) / 0.5)
        self.text(d, (self.W / 2, 150), f"{self.c.get('kicker', 'DUEL OFFICIEL')}", self.B(26), (*BONE, int(200 * k)), "mm", spacing=10)
        # BLACKLIST lettre par lettre
        word = "BLACKLIST"; fA = self.A(150); widths = [d.textlength(ch, font=fA) for ch in word]
        tot = sum(widths) + 6 * (len(word) - 1); x = self.W / 2 - tot / 2
        for i, ch in enumerate(word):
            p = ease((t - 0.25 - i * 0.045) / 0.35)
            col = RED if i >= 5 else BONE
            d.text((x, 210 + (1 - p) * 60), ch, font=fA, fill=(*col, int(255 * p)))
            x += widths[i] + 6
        # trait rouge incliné
        wbar = ease((t - 1.0) / 0.5) * 520
        if wbar > 4: self.slash(d, self.W / 2 - 260, 392, wbar, 10)
        # face-à-face
        p = ease((t - 1.35) / 0.55)
        ch, df = self.c["challenger"], self.c["defender"]
        xo = (1 - p) * 220
        self.plate(d, 250 - xo, 470, 330, 96, (*INK2, int(255 * p)), outline=(*RED, int(255 * p)))
        self.text(d, (270 - xo, 478), f"#{ch['rank']}", self.A(34), (*RED, int(255 * p)))
        self.text(d, (270 - xo, 520), ch["name"], self.B(40), (*BONE, int(255 * p)))
        self.plate(d, 700 + xo, 470, 330, 96, (*INK2, int(255 * p)), outline=(*METAL, int(255 * p)))
        self.text(d, (1015 + xo, 478), f"#{df['rank']}", self.A(34), (*METAL, int(255 * p)), "ra")
        self.text(d, (1015 + xo, 520), df["name"], self.B(40), (*BONE, int(255 * p)), "ra")
        vs = ease((t - 1.8) / 0.35)
        if vs > 0:
            self.plate(d, 585, 464, 110, 108, (*RED, int(255 * vs)), cut=18)
            self.text(d, (640, 520), "VS", self.M(52), (*BONE, int(255 * vs)), "mm")
        self.text(d, (self.W / 2, 625), f"{self.c.get('circuit', '')}  ·  {self.c.get('distance', '')}  ·  {self.c.get('format', '1 COURSE')}".strip(" ·"), self.B6(24), (*METAL, int(255 * ease((t - 2.1) / 0.5))), "mm", spacing=4)
        # flash blanc au début + fondu de sortie
        if t < 0.12: d.rectangle([0, 0, self.W, self.H], fill=(255, 255, 255, int(255 * (1 - t / 0.12))))
        out = clamp01((t - (INTRO - 0.35)) / 0.35)
        if out: im.putalpha(Image.eval(im.getchannel("A"), lambda v: v).point(lambda v: int(v * (1 - out))))
        self.vignette(im, 190)
        return im

    # ---------- HUD pendant la course (transparent) ----------
    def hud(self, t, T):
        im = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
        a_in = ease(t / 0.6)
        ch, df = self.c["challenger"], self.c["defender"]
        # haut : bandeau dégradé + logo + étiquette duel + chrono
        grad = Image.linear_gradient("L").rotate(180).resize((self.W, 120)).point(lambda v: int(v * 0.72 * a_in))
        top = Image.new("RGBA", (self.W, 120), (0, 0, 0, 0)); top.putalpha(grad); im.alpha_composite(top, (0, 0))
        d = ImageDraw.Draw(im, "RGBA")
        self.logo(d, 34 - (1 - a_in) * 40, 24, 36, int(255 * a_in))
        tag = f"DUEL  #{ch['rank']}  >  #{df['rank']}"
        tw = d.textlength(tag, font=self.B(24)) + 40 + 18 * (len(tag) - 1) * 0.0
        self.plate(d, self.W - 250 - tw, 26, tw, 40, (*RED, int(240 * a_in)), cut=10)
        self.text(d, (self.W - 250 - tw / 2 + 5, 46), tag, self.B(24), (*BONE, int(255 * a_in)), "mm", spacing=2)
        mm, ss = divmod(max(0.0, T), 60)
        self.plate(d, self.W - 220, 26, 190, 40, (*INK, int(225 * a_in)), outline=(255, 255, 255, int(40 * a_in)), cut=10)
        self.text(d, (self.W - 125, 47), f"{int(mm):02d}:{ss:04.1f}", self.A(30), (*BONE, int(255 * a_in)), "mm")
        # bas : pilotes
        by = self.H - 118; xo = (1 - a_in) * 120
        for side, p, col, x0 in (("l", ch, RED, 34), ("r", df, METAL, self.W - 34 - 360)):
            xx = x0 - xo if side == "l" else x0 + xo
            self.plate(d, xx, by, 360, 74, (*INK, int(228 * a_in)), outline=(*col, int(255 * a_in)))
            d.rectangle([xx + (0 if side == "l" else 354), by + 6, xx + (6 if side == "l" else 360), by + 68], fill=(*col, int(255 * a_in)))
            ax = xx + 26 if side == "l" else xx + 334
            anc = "l" if side == "l" else "r"
            self.text(d, (ax, by + 8), f"#{p['rank']}", self.A(26), (*col, int(255 * a_in)), "l" + "a" if anc == "l" else "ra")
            self.text(d, (ax + (64 if side == "l" else -64), by + 8), p["name"], self.B(32), (*BONE, int(255 * a_in)), "la" if anc == "l" else "ra")
            if p.get("car"): self.text(d, (ax + (64 if side == "l" else -64), by + 44), p["car"], self.B6(19), (*METAL, int(255 * a_in)), "la" if anc == "l" else "ra", spacing=2)
        cx = self.W // 2
        self.plate(d, cx - 46, by + 4, 92, 66, (*RED, int(255 * a_in)), cut=14)
        self.text(d, (cx, by + 37), "VS", self.M(34), (*BONE, int(255 * a_in)), "mm")
        # circuit
        if self.c.get("circuit"):
            self.text(d, (cx, by - 22), f"{self.c['circuit']}  ·  {self.c.get('distance', '')}".strip(" ·"), self.B6(20), (*BONE, int(190 * a_in)), "mm", spacing=4)
        # progression
        prog = clamp01(T / max(self.clip_dur, 0.1))
        d.rectangle([0, self.H - 7, self.W, self.H], fill=(0, 0, 0, int(120 * a_in)))
        d.rectangle([0, self.H - 7, int(self.W * prog), self.H], fill=(*RED, 255))
        return im

    # ---------- RÉSULTAT (transparent, 4 dernières secondes du clip) ----------
    def result(self, t):
        im = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
        p = ease(t / 0.45)
        veil = Image.new("RGBA", (self.W, self.H), (0, 0, 0, int(150 * p))); im.alpha_composite(veil); d = ImageDraw.Draw(im, "RGBA")
        wchal = self.win is self.c["challenger"]
        self.text(d, (self.W / 2, 190), "VICTOIRE", self.A(170), (*RED, int(255 * p)), "mm")
        self.text(d, (self.W / 2 + 4, 194), "", self.A(10), (0, 0, 0, 0), "mm")
        wbar = ease((t - 0.25) / 0.5) * 420
        if wbar > 4: self.slash(d, self.W / 2 - 210, 285, wbar, 9)
        sc = ease((t - 0.4) / 0.4)
        self.text(d, (self.W / 2, 350), self.win["name"], self.A(76), (*BONE, int(255 * sc)), "mm")
        chg = f"#{self.c['challenger']['rank']}  >  #{self.c['defender']['rank']}" if wchal else f"#{self.c['defender']['rank']}  CONSERVE SA PLACE"
        self.text(d, (self.W / 2, 430), ("PLACE PRISE   " if wchal else "TITRE CONSERVÉ   ") + (chg if wchal else ""), self.B(34), (*BONE, int(230 * sc)), "mm", spacing=5)
        if wchal and self.c.get("prize"):
            pz = ease((t - 0.8) / 0.4)
            self.plate(d, self.W / 2 - 180, 480, 360, 64, (*RED, int(255 * pz)), cut=14)
            self.text(d, (self.W / 2, 512), f"CASH PRIZE  {self.c['prize']}", self.B(32), (*BONE, int(255 * pz)), "mm", spacing=3)
        return im

    # ---------- OUTRO (opaque) ----------
    def outro(self, t):
        im = Image.new("RGBA", (self.W, self.H), (*INK, 255)); d = ImageDraw.Draw(im, "RGBA")
        halo = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0)); ImageDraw.Draw(halo).ellipse([340, 160, 940, 520], fill=(*RED, 60))
        im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(80))); d = ImageDraw.Draw(im, "RGBA")
        p = ease(t / 0.6)
        self.text(d, (self.W / 2, 250 - (1 - p) * 30), "BLACK", self.A(120), (*BONE, int(255 * p)), "rm")
        self.text(d, (self.W / 2, 250 - (1 - p) * 30), "LIST", self.A(120), (*RED, int(255 * p)), "lm")
        s = ease((t - 0.5) / 0.5)
        self.text(d, (self.W / 2, 350), "THERE IS NO SECOND PLACE.", self.M(36), (*BONE, int(255 * s)), "mm")
        wbar = ease((t - 0.7) / 0.5) * 360
        if wbar > 4: self.slash(d, self.W / 2 - 180, 395, wbar, 8)
        e = ease((t - 1.1) / 0.5)
        self.text(d, (self.W / 2, 470), "A BOOBOO CREW PRODUCTION.", self.B(30), (*METAL, int(255 * e)), "mm", spacing=9)
        if t > OUTRO - 0.5: d.rectangle([0, 0, self.W, self.H], fill=(0, 0, 0, int(255 * (t - (OUTRO - 0.5)) / 0.5)))
        self.vignette(im, 200)
        return im

    def frame(self, n):
        T = n / FPS
        if T < INTRO: im = self.intro(T)
        elif T >= INTRO + self.clip_dur: im = self.outro(T - INTRO - self.clip_dur)
        else:
            tc = T - INTRO; im = self.hud(tc, tc)
            rs = tc - (self.clip_dur - RESULT)
            if rs > 0: im.alpha_composite(self.result(rs))
            # flash de transition à l'entrée dans la course
            if tc < 0.15: ImageDraw.Draw(im, "RGBA").rectangle([0, 0, self.W, self.H], fill=(255, 255, 255, int(200 * (1 - tc / 0.15))))
        im.alpha_composite(self.grain[n % len(self.grain)])
        return im


def probe_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True); ap.add_argument("--clip"); ap.add_argument("--out", default="duel.mp4")
    ap.add_argument("--demo", action="store_true", help="fond de démonstration (aucun clip)"); ap.add_argument("--demo-seconds", type=float, default=12)
    ap.add_argument("--stills", help="dossier : ne produit que des images fixes (intro, course, résultat, fin)")
    ap.add_argument("--size", default="1280x720"); ap.add_argument("--crf", default="23"); ap.add_argument("--maxrate", default="5M", help="débit maximum (5M ≈ 3 Mo par 5 s ; baisse-le pour une vidéo plus légère)")
    a = ap.parse_args()
    cfg = json.load(open(a.config, encoding="utf-8"))
    if not a.clip and not a.demo: sys.exit("Donne --clip mon-clip.mp4 (ou --demo pour un aperçu).")
    clip_dur = a.demo_seconds if a.demo else min(probe_duration(a.clip), 90)
    sc = Scene(cfg, clip_dur)
    W, H = [int(x) for x in a.size.split("x")]

    if a.stills:
        os.makedirs(a.stills, exist_ok=True)
        base = Image.new("RGBA", (1280, 720), (14, 16, 21, 255))
        for name, T in (("1-intro", 2.4), ("2-course", INTRO + 5.0), ("3-resultat", INTRO + clip_dur - 1.6), ("4-fin", INTRO + clip_dur + 2.0)):
            f = sc.frame(int(T * FPS)); bg = base.copy(); bg.alpha_composite(f); bg.convert("RGB").save(os.path.join(a.stills, f"{name}.png"))
        print("images fixes dans", a.stills); return

    nframes = int(math.ceil(sc.total * FPS))
    grade = "eq=contrast=1.12:saturation=0.82:brightness=-0.03,colorbalance=rs=.05:gs=-.02:bs=-.04:rm=.06:bm=-.05,vignette=PI/5"
    if a.demo:
        base_in = ["-f", "lavfi", "-i", f"gradients=s=1280x720:c0=#0d0f14:c1=#2a1114:speed=0.03:d={clip_dur + 1}"]
        aud_in = ["-f", "lavfi", "-t", str(clip_dur), "-i", "anullsrc=r=48000:cl=stereo"]
    else:
        base_in = ["-i", a.clip]; aud_in = ["-i", a.clip]
    fc = (f"[0:v]fps={FPS},scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,{grade},trim=duration={clip_dur},setpts=PTS-STARTPTS,"
          f"tpad=start_duration={INTRO}:stop_duration={OUTRO}:color=black[b];"
          f"[b][1:v]overlay=0:0:format=auto,scale={W}:{H},format=yuv420p[v];"
          f"[2:a]atrim=duration={clip_dur},asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st={max(clip_dur - 1.0, 0):.2f}:d=1.0,adelay={int(INTRO * 1000)}:all=1,apad=whole_dur={sc.total:.2f}[a]")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *base_in, "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1280x720", "-r", str(FPS), "-i", "-", *aud_in,
           "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", f"{sc.total:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", a.crf, "-maxrate", a.maxrate, "-bufsize", "10M", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(nframes):
        p.stdin.write(sc.frame(n).tobytes())
        if n % 90 == 0: print(f"\r{n}/{nframes} images", end="", flush=True)
    p.stdin.close(); p.wait(); print(f"\n→ {a.out}  ({sc.total:.1f} s, {os.path.getsize(a.out) / 1e6:.1f} Mo)")


if __name__ == "__main__":
    main()
