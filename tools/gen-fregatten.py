# Erzeugt die Fregatten-Rohmodelle (Raumschiff-Fassung): python tools/gen-fregatten.py  → assets/models/schiff/fregatte/*.json
import json, random, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'models', 'schiff', 'fregatte')

def G(c, e=None):
    return {"role": c, "emit": e} if e is not None else c
def glow(r='glow', e=2.0): return {"role": r, "emit": e}
def shade(c, f): return {"shade": c, "f": f}
def box(n, at, size, color, **kw): return {"op": "box", "name": n, "at": at, "size": size, "color": color, **kw}
def cyl(n, at, r, h, color, **kw): return {"op": "cyl", "name": n, "at": at, "r": r, "h": h, "color": color, **kw}
def line(n, a, b, r, color, **kw): return {"op": "line", "name": n, "from": a, "to": b, "r": r, "color": color, **kw}
def ell(n, at, r, color, **kw): return {"op": "ellipsoid", "name": n, "at": at, "r": r, "color": color, **kw}
def wedge(n, at, size, color, **kw): return {"op": "wedge", "name": n, "at": at, "size": size, "color": color, **kw}
def loft(n, secs, color, **kw): return {"op": "loft", "name": n, "sections": secs, "color": color, **kw}
def group(n, ops, **kw): return {"op": "group", "name": n, "ops": ops, **kw}
def S(z, w, up, down, bevel=0, y=0, x=0, rnd=0):
    d = {"z": z, "w": w, "up": up, "down": down}
    if bevel: d["bevel"] = bevel
    if y: d["y"] = y
    if x: d["x"] = x
    if rnd: d["round"] = rnd
    return d

def top_at(secs, x, z):
    """Oberkante eines Lofts an (x, z), grob wie shapeLoft."""
    secs = sorted(secs, key=lambda s: s["z"])
    if z < secs[0]["z"] or z > secs[-1]["z"]: return None
    for A, B in zip(secs, secs[1:]):
        if A["z"] <= z <= B["z"]:
            t = (z - A["z"]) / ((B["z"] - A["z"]) or 1)
            L = lambda k, d=0: A.get(k, d) + (B.get(k, d) - A.get(k, d)) * t
            w, up, dn, bev, y = L("w"), L("up"), L("down"), L("bevel"), L("y")
            hw = w / 2; dx = abs(x + 0.5)
            if dx > hw - 1: return None
            top = y + up
            cut = bev - (hw - dx)
            if cut > 0: top -= cut
            return int(top)
    return None

def greebles(secs, x_rng, z_rng, n, seed, colors=("metal", "metal_light", "metal_dark"), avoid=None):
    rnd = random.Random(seed); ops = []
    tries = 0
    while len(ops) < n and tries < n * 20:
        tries += 1
        x = rnd.randint(*x_rng); z = rnd.randint(*z_rng)
        if avoid and avoid(x, z): continue
        t = top_at(secs, x, z)
        if t is None: continue
        w, d, h = rnd.choice([(2, 3, 1), (3, 2, 1), (2, 2, 2), (4, 2, 1), (2, 5, 1), (3, 3, 1)])
        ops.append(box(f"Kleinteil {len(ops)+1}", [x, t, z], [w, h, d], rnd.choice(colors)))
    return ops

def window_rows(n, x_half, y, z0, z1, step, color=None, size=(1, 1, 2)):
    return box(n, [-x_half - 2, y, z0], [2 * x_half + 4, size[1], size[2]], color or glow('glow2', 1.4),
               mode="paint", jitter=False, repeat={"count": (z1 - z0) // step, "step": [0, 0, step]})

def engines(n, positions, z, r, glowcol, depth=6):
    ops = []
    for i, (x, y) in enumerate(positions):
        ops += [cyl(f"{n} {i+1} Düse", [x, y, z - depth], r + 1, depth, "metal_dark", axis="z"),
                cyl(f"{n} {i+1} Ring", [x, y, z - 2], r + 2, 2, "metal_light", axis="z"),
                cyl(f"{n} {i+1} Glut", [x, y, z - depth - 1], r - 1, 1, glowcol, axis="z", jitter=False)]
    return ops

def save(id_, name, palette, tags, footprint, ops, anchor):
    m = {"id": f"schiff/fregatte/{id_}", "name": name, "tier": "architecture", "palette": palette,
         "tags": ["schiff", "fregatte", "rohmodell"] + tags, "footprint": footprint, "ops": ops, "anchor": anchor}
    with open(os.path.join(OUT, id_ + ".json"), "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)

# =============================================================================================
# ROM – Quinquereme: Panzerkeil, Lorica-Rücken, Adlerschwingen-Kühler, Galea-Brücke, Rammklinge
# =============================================================================================
hull = [S(0, 60, 16, 14, 9), S(50, 70, 18, 16, 11), S(200, 62, 17, 14, 10), S(300, 32, 11, 8, 6), S(350, 6, 4, 3, 2)]
spine = [S(30, 26, 27, 0, 9), S(240, 20, 24, 0, 8), S(290, 8, 14, 0, 4)]
ops = [
    loft("Rumpf", hull, "secondary"),
    box("Unterseite Gunmetal", [-40, -16, -10], [80, 9, 380], "metal", mode="paint"),
    box("Rotes Panzerband", [-40, 6, -10], [80, 4, 380], "primary", mode="paint"),
    box("Goldkante", [-40, 10, -10], [80, 1, 380], "trim", mode="paint"),
    box("Plattenfugen", [-40, -16, 40], [80, 40, 1], shade("secondary", 0.75), mode="paint", repeat={"count": 9, "step": [0, 0, 30]}),
    loft("Lorica-Rücken", spine, {"stripes": ["primary", "primary", shade("primary", 0.8), "trim"], "axis": "z", "period": 3}),
    loft("Rammklinge", [S(330, 14, 2, 6, 2, y=-4), S(392, 2, 1, 1, 0, y=-6)], "trim"),
    loft("Rammklinge Grat", [S(330, 4, 4, 0, 0, y=-2), S(380, 1, 1, 0, 0, y=-5)], shade("trim", 0.7)),
    # Galea-Brücke mit Helmkamm
    loft("Brücke (Galea)", [S(196, 10, 22, 0, 4, y=20, rnd=0.6), S(212, 22, 30, 0, 6, y=14, rnd=0.6), S(250, 18, 26, 0, 6, y=14, rnd=0.6), S(262, 8, 18, 0, 3, y=14)], "secondary"),
    box("Sehschlitz", [-12, 38, 238], [24, 2, 30], "glass", mode="paint"),
    box("Helmkamm", [-1, 44, 200], [2, 5, 52], {"stripes": ["primary", "cloth"], "axis": "z", "period": 2}),
    # Adlerschwingen als Kühlflächen
    group("Adlerschwinge", [
        box("Schwungfeder", [33, "2 + i", "150 - i*7"], [7, 3, "64 - i*5"], {"frame": "trim", "fill": "primary", "axes": "xz"}, repeat={"count": 7, "step": [7, 0, 0]}),
        box("Kühlrippen", [33, "4 + i", "152 - i*7"], [7, 1, "60 - i*5"], {"stripes": [shade("primary", 0.7), "primary"], "axis": "z", "period": 2}, mode="paint", repeat={"count": 7, "step": [7, 0, 0]}),
        box("Schwingenleuchte", [80, 10, 109], [3, 2, 3], glow("glow", 2.2), jitter=False),
    ], mirror="x", mirrorAt=0),
    # Batterietürme auf den Flanken
    group("Batterie", [
        cyl("Turm", [24, 12, "70 + i*36"], 4, 3, "metal", repeat={"count": 5, "step": [0, 0, 0]}),
        line("Rohr", [26, 14, "70 + i*36"], [36, 14, "76 + i*36"], 1, "metal_dark", repeat={"count": 5, "step": [0, 0, 0]}),
    ], mirror="x", mirrorAt=0),
    # Antrieb
    box("Antriebsblock", [-32, -14, -28], [64, 30, 30], {"frame": "trim", "fill": "metal", "axes": "xy"}),
    box("Antriebsfugen", [-32, -14, -20], [64, 30, 1], "metal_dark", mode="paint", repeat={"count": 3, "step": [0, 0, 7]}),
] + engines("Triebwerk", [(-18, -4), (0, -4), (18, -4), (-9, 8), (9, 8)], -28, 7, glow("glow", 2.6)) + [
    window_rows("Fensterreihe", 36, -2, 30, 290, 6),
    window_rows("Fensterreihe unten", 36, -8, 50, 270, 8),
    box("Hangarluke", [-14, -17, 120], [28, 1, 40], {"frame": "trim", "fill": "dark", "axes": "xz"}),
    line("Antenne", [-6, 33, 60], [-6, 46, 58], 0.6, "metal_light"),
    box("Antennenlicht", [-7, 46, 57], [1, 1, 1], glow("glow", 2.4), jitter=False),
    box("Adler-Bugzier", [-6, 6, 318], [12, 6, 6], "trim"),
    box("Adler-Bugzier Flügel", [6, 8, 314], [10, 2, 6], "trim", mirror="x", mirrorAt=0),
] + greebles(hull, (-28, 27), (20, 290), 70, 1, avoid=lambda x, z: abs(x) < 14)
save("rom_v2", "(2. Fassung) Quinquereme – römische Fregatte (Rohmodell)", "rom", ["rom"], [40, 100], ops, [0, 0, 180])

# =============================================================================================
# ÄGYPTEN – Mandjet: Delta-Rumpf mit Pyramidenflanken, Sonnenring-Reaktor mit Schwingen, Uräus-Bug
# =============================================================================================
hull = [S(0, 140, 26, 10, 26), S(60, 130, 26, 10, 26), S(320, 10, 6, 3, 4), S(345, 2, 2, 1, 0)]
ops = [
    loft("Delta-Rumpf", hull, "primary"),
    box("Lapis-Unterseite", [-80, -10, -10], [160, 7, 380], "secondary", mode="paint"),
    box("Goldgrat", [-2, -10, -10], [4, 40, 380], "trim", mode="paint"),
    box("Flankenkanten Gold", [-80, 10, -10], [160, 1, 380], "trim", mode="paint"),
    box("Hieroglyphenband", [-80, 4, 20], [160, 2, 3], glow("glow", 1.5), mode="paint", jitter=False, repeat={"count": 32, "step": [0, 0, 9]}),
    box("Plattenfugen", [-80, -10, 30], [160, 40, 1], shade("primary", 0.8), mode="paint", repeat={"count": 10, "step": [0, 0, 28]}),
    # Pyramidion-Brücke (gestuft, goldene Spitze)
    box("Pyramidion", ["-20 + i*2", "24 + i*3", "70 + i*2"], ["40 - i*4", 3, "40 - i*4"], {"frame": "trim", "fill": "primary", "axes": "xz"}, repeat={"count": 9, "step": [0, 0, 0]}),
    box("Pyramidion Spitze", [-2, 51, 88], [4, 4, 4], glow("glow2", 2.4), jitter=False),
    box("Brückenfenster", [-20, 27, 106], [40, 1, 4], glow("glow", 1.2), mode="paint", jitter=False),
    # Sensor-Obelisken
    group("Sensorspitze", [
        box("Schaft", ["30 - floor(i/3)", "14 + i*4", "150 - floor(i/3)"], ["4 - floor(i/3)*1", 4, "4 - floor(i/3)*1"], "trim", repeat={"count": 7, "step": [0, 0, 0]}),
        box("Spitzenlicht", [29, 42, 148], [2, 2, 2], glow("glow", 2.4), jitter=False),
    ], mirror="x", mirrorAt=0),
    # Sonnenring am Heck, senkrecht, mit Schwingen
    cyl("Sonnenring", [0, 14, -10], 34, 6, "trim", axis="z", hollow=5),
    cyl("Sonnenfeld", [0, 14, -8], 29, 2, glow("glow2", 1.1), axis="z", hollow=2, jitter=False),
    cyl("Sonnenkern", [0, 14, -9], 10, 3, glow("glow2", 2.6), axis="z", jitter=False),
    line("Ringstrebe", [0, 26, 2], [0, 44, -8], 3, "trim"),
    group("Sonnenschwinge", [
        box("Feder", ["34 + i*7", "20 - i", -14], [7, 3, "16 - floor(i/2)*2"], {"stripes": ["cloth", "secondary", "trim"], "axis": "z", "period": 3}, repeat={"count": 9, "step": [0, 0, 0]}),
        box("Federkante", ["34 + i*7", "22 - i", -14], [7, 1, 3], "trim", repeat={"count": 9, "step": [0, 0, 0]}),
    ], mirror="x", mirrorAt=0),
] + engines("Sonnenantrieb", [(-40, 0), (40, 0), (-20, -2), (20, -2)], 0, 6, glow("glow2", 2.4)) + [
    # Uräus-Strahler am Bug
    loft("Uräus Leib", [S(300, 8, 10, 0, 2, y=4), S(330, 6, 18, 0, 2, y=4)], "trim"),
    loft("Uräus Haube", [S(326, 26, 26, 0, 8, y=6, rnd=0.7), S(334, 18, 22, 0, 6, y=8, rnd=0.7)], {"stripes": ["trim", "secondary"], "axis": "y", "period": 2}),
    cyl("Uräus Strahler", [0, 26, 334], 3, 10, glow("glow2", 2.6), axis="z", r2=1.5, jitter=False),
    box("Flankenstrahler", ["-62 + i*12", 8, "50 + i*40"], [4, 4, 10], glow("glow", 1.8), jitter=False, repeat={"count": 5, "step": [0, 0, 0]}),
    box("Flankenstrahler rechts", ["58 - i*12", 8, "50 + i*40"], [4, 4, 10], glow("glow", 1.8), jitter=False, repeat={"count": 5, "step": [0, 0, 0]}),
    window_rows("Fensterreihe", 70, -4, 30, 280, 7),
] + greebles(hull, (-60, 59), (20, 260), 60, 2, colors=("trim", "secondary", "metal_light"), avoid=lambda x, z: abs(x) < 24 and z < 120)
save("aegypten_v2", "(2. Fassung) Mandjet – ägyptische Fregatte (Rohmodell)", "aegypten", ["aegypten"], [60, 90], ops, [0, 0, 170])

# =============================================================================================
# BABYLON – Tafelschiff: Doppelzikkurat (oben + unten), Lamassu-Kühlschwingen, Netzhörner am Bug
# =============================================================================================
hull = [S(0, 76, 12, 12, 8), S(40, 90, 14, 14, 10), S(260, 84, 14, 14, 10), S(310, 50, 10, 10, 8), S(330, 30, 7, 7, 5)]
ops = [loft("Grundrumpf", hull, "primary"),
       box("Kachelband", [-50, -4, -10], [100, 8, 360], {"checker": ["primary", shade("primary", 1.3)], "period": 1}, mode="paint"),
       box("Tierfries", [-50, -1, 20], [100, 2, 4], "trim", mode="paint", repeat={"count": 24, "step": [0, 0, 12]}),
       box("Ockerkante", [-50, 11, -10], [100, 2, 360], "secondary", mode="paint"),
       box("Ockerkante unten", [-50, -13, -10], [100, 2, 360], "secondary", mode="paint")]
terr = [(70, 6, 220, 30), (54, 6, 180, 50), (38, 6, 140, 70), (24, 7, 90, 95)]
y = 13
for k, (w, h, L, z0) in enumerate(terr):
    col = "secondary" if k % 2 == 0 else "primary"
    ops += [loft(f"Terrasse {k+1} oben", [S(z0, w, h, 0, 3, y=y), S(z0 + L, w, h, 0, 3, y=y)], col),
            loft(f"Terrasse {k+1} unten", [S(z0, w, 0, h, 3, y=-y), S(z0 + L, w, 0, h, 3, y=-y)], col),
            box(f"Lichtfuge {k+1}", [-w // 2 - 1, y, z0], [w + 2, 1, L], glow("glow", 1.3), mode="paint", jitter=False),
            box(f"Lichtfuge {k+1} unten", [-w // 2 - 1, -y - 1, z0], [w + 2, 1, L], glow("glow", 1.3), mode="paint", jitter=False)]
    y += h
ops += [
    loft("Sternwarte", [S(120, 14, 8, 0, 3, y=y, rnd=0.5), S(160, 14, 8, 0, 3, y=y, rnd=0.5)], "trim"),
    ell("Sternenkuppel", [0, y + 7, 140], [7, 6, 10], "glass", half="+y"),
    box("Achtstrahliger Stern", [-2, y + 13, 138], [4, 4, 4], glow("glow2", 2.4), jitter=False),
    group("Lamassu-Schwinge", [
        box("Federreihe", ["44 + i*7", "-2 + i*3", "200 - i*12"], [7, 3, "100 - i*8"], {"frame": "trim", "fill": "primary", "axes": "xz"}, repeat={"count": 6, "step": [0, 0, 0]}),
        box("Schwingenleuchte", [86, 14, 125], [3, 2, 3], glow("glow", 2.2), jitter=False),
        box("Drohnenbucht", [41, -6, "90 + i*30"], [4, 6, 14], {"frame": "trim", "fill": "dark", "axes": "yz"}, repeat={"count": 4, "step": [0, 0, 0]}),
    ], mirror="x", mirrorAt=0),
    group("Netzhorn", [
        loft("Horn", [S(300, 10, 6, 6, 3, x=26), S(350, 7, 4, 4, 2, x=30), S(380, 4, 3, 3, 1, x=24)], "trim"),
        box("Hornspitze", [22, -2, 380], [4, 4, 4], glow("glow", 2.4), jitter=False),
    ], mirror="x", mirrorAt=0),
    box("Marduks Netz", [-24, -6, 370], [48, 12, 1], {"checker": [glow("glow", 1.3), "dark"], "period": 2}, jitter=False),
    box("Schicksalstafel", [-8, -6, 330], [16, 12, 3], {"frame": "trim", "fill": "stone", "axes": "xy"}),
    box("Tafelschrift", [-6, "-3 + i*3", 333], [12, 1, 1], glow("glow", 1.8), jitter=False, repeat={"count": 3, "step": [0, 0, 0]}),
    box("Heckstufen", ["-34 + i*4", "-10 + i*2", "-6 - i*3"], ["68 - i*8", "20 - i*4", 4], "primary", repeat={"count": 4, "step": [0, 0, 0]}),
] + engines("Triebwerk", [(-27, 0), (-9, 0), (9, 0), (27, 0)], -12, 6, glow("glow2", 2.4)) + [
    window_rows("Fensterreihe", 46, 6, 30, 290, 6),
] + greebles(hull, (-42, 41), (30, 290), 50, 3, colors=("trim", "secondary", "metal_light"), avoid=lambda x, z: abs(x) < 36)
save("babylon_v2", "(2. Fassung) Tafelschiff – babylonische Fregatte (Rohmodell)", "babylon", ["babylon"], [50, 100], ops, [0, 0, 170])

# =============================================================================================
# NORD – Drakkar: Raubvogel-Drache. Gepanzerter Leib, Greifkopf mit Hakenschnabel, Klingenschwingen, Schwanzfächer
# =============================================================================================
body = [S(0, 26, 12, 12, 0, rnd=1), S(40, 34, 16, 14, 0, rnd=0.9), S(200, 30, 15, 12, 0, rnd=0.9), S(290, 20, 12, 9, 0, rnd=0.9), S(320, 14, 10, 7, 0, rnd=0.9)]
ops = [
    loft("Leib", body, "primary"),
    box("Schuppenplatten", [-20, -14, 0], [40, 32, 330], {"stripes": ["primary", "secondary"], "axis": "z", "period": 4}, mode="paint"),
    box("Bauch", [-20, -14, 0], [40, 8, 330], "metal_dark", mode="paint"),
    loft("Rückenkamm", [S(30, 6, 22, 0, 2), S(280, 4, 16, 0, 1)], "secondary"),
    line("Rückendorn", [0, 20, "40 + i*20"], [0, 30, "30 + i*20"], 1.2, "trim", repeat={"count": 12, "step": [0, 0, 0]}),
    box("Runenleitung", [-1, 21, 34], [2, 1, 240], glow("glow", 1.6), mode="paint", jitter=False),
    # Greifkopf
    loft("Hals", [S(310, 16, 12, 8, 0, y=2, rnd=0.8), S(340, 14, 10, 6, 0, y=8, rnd=0.8)], "primary"),
    loft("Schädel", [S(336, 18, 10, 6, 3, y=10), S(360, 16, 9, 5, 3, y=11), S(372, 10, 6, 3, 2, y=11)], "secondary"),
    loft("Hakenschnabel", [S(366, 10, 6, 3, 2, y=12), S(386, 6, 4, 4, 1, y=8), S(394, 3, 2, 6, 0, y=2)], "trim"),
    loft("Unterkiefer", [S(350, 12, 2, 4, 1, y=4), S(378, 6, 2, 3, 1, y=3)], "metal_dark"),
    box("Reißzähne", [-5, 3, "356 + i*4"], [1, 4, 1], "trim", repeat={"count": 5, "step": [0, 0, 0]}, mirror="x", mirrorAt=0),
    box("Augen", [7, 16, 360], [2, 2, 5], glow("glow2", 2.8), jitter=False, mirror="x", mirrorAt=0),
    box("Kriegsbemalung", [-12, 8, 354], [24, 10, 3], "cloth", mode="paint"),
    line("Horn", [7, 20, 348], [16, 30, 322], 2, "trim", mirror="x", mirrorAt=0),
    line("Hornspitze", [16, 30, 322], [18, 36, 310], 1.2, "cloth", mirror="x", mirrorAt=0),
    line("Kammfeder", [0, 21, 350], [0, 38, 324], 1.5, "cloth"),
    # Enterklauen
    group("Enterklaue", [
        line("Klauenarm", [8, -12, "290 + i*10"], [14, -24, "300 + i*10"], 1.6, "metal", repeat={"count": 3, "step": [0, 0, 0]}),
        line("Kralle", [14, -24, "300 + i*10"], [11, -28, "308 + i*10"], 1.2, "trim", repeat={"count": 3, "step": [0, 0, 0]}),
    ], mirror="x", mirrorAt=0),
    # Klingenschwingen (Raubvogel)
    group("Schwinge", [
        loft("Schwingenwurzel", [S(150, 10, 8, 4, 2, x=18), S(230, 10, 8, 4, 2, x=18)], "secondary"),
        line("Armknochen", [18, 8, 220], [56, 16, 212], 3, "secondary"),
        line("Handknochen", [56, 16, 212], [104, 22, 198], 2.5, "secondary"),
        line("Dorn am Bug der Schwinge", [56, 16, 212], [60, 20, 226], 1.5, "trim"),
        line("Dorn am Bug der Schwinge 2", [100, 22, 199], [106, 25, 214], 1.5, "trim"),
    ] + [line(f"Klingenfeder {k+1}", [104 - k * 7, 22 - k, 198 + k * 1.5], [118 - k * 10, 18 - k * 1.2, 170 - k * 7], 2.2,
              "cloth" if k < 3 else ("primary" if k % 2 else "secondary")) for k in range(10)]
      + [line(f"Federglut {k+1}", [118 - k * 10, 18 - k * 1.2, 170 - k * 7], [116 - k * 10, 18 - k * 1.2, 176 - k * 7], 1, glow("glow", 1.8), jitter=False) for k in range(0, 10, 3)],
      mirror="x", mirrorAt=0),
    # Schwanzfächer
    group("Schwanzfächer", [
        line(f"Steuerfeder {k}", [0, 4, 10], [k * 9, 6 + abs(k), -40 + abs(k) * 4], 2, "cloth" if abs(k) == 3 else "secondary") for k in range(-3, 4)
    ]),
] + engines("Frosttriebwerk", [(-8, 0), (8, 0), (0, -8)], 4, 5, glow("glow", 2.6)) + [
    window_rows("Fensterreihe", 18, 2, 60, 280, 8, color=glow("glow", 1.2)),
] + greebles(body, (-12, 11), (40, 280), 30, 4, colors=("metal_light", "trim", "metal"), avoid=lambda x, z: abs(x) < 4)
save("nord_v2", "(2. Fassung) Drakkar – nordische Fregatte (Rohmodell)", "nord", ["nord"], [60, 110], ops, [0, 0, 180])

# =============================================================================================
# HIMMELSREICH – Louchuan: geschuppter Drachenleib in Segmenten, Pagoden-Türme mit Traufpanzer, Drachenkopf mit Perle
# =============================================================================================
segs = [(0, 70, -2), (72, 140, 2), (142, 210, -1), (212, 280, 2)]
ops = []
for k, (z0, z1, yo) in enumerate(segs):
    w = 40 - k * 2
    sec = [S(z0, w - 6, 13, 11, 6, y=yo), S(z0 + 8, w, 14, 12, 7, y=yo), S(z1 - 8, w, 14, 12, 7, y=yo), S(z1, w - 6, 13, 11, 6, y=yo)]
    ops += [loft(f"Leibsegment {k+1}", sec, {"checker": ["primary", shade("primary", 0.78)], "period": 2}),
            box(f"Goldring {k+1}", [-30, -16, z1 - 1], [60, 34, 2], "trim", mode="paint"),
            box(f"Schwarzlack {k+1}", [-30, -16, z0], [60, 8, z1 - z0], "secondary", mode="paint")]
ops += [loft("Halsglied", [S(280, 30, 12, 10, 5, y=2), S(310, 22, 10, 8, 4, y=6)], {"checker": ["primary", shade("primary", 0.78)], "period": 2})]
ops += [loft("Wirbelsäule", [S(0, 6, 18, 0, 2), S(300, 6, 18, 0, 2)], "trim"),
        box("Rückenflosse", [-1, 16, "6 + i*12"], [2, 6, 6], "cloth", repeat={"count": 24, "step": [0, 0, 0]})]

def pagoda(name, zc, h, n, base):
    rep = {"count": n, "step": [0, 0, 0], "var": "s"}
    top = base + 8 * n
    return group(name, [
        box("Stockwerk", [f"{-h} + 2*s", f"{base} + 8*s", f"{zc - h} + 2*s"], [f"{2 * h} - 4*s", 6, f"{2 * h} - 4*s"], {"frame": "trim", "fill": "secondary", "axes": "y"}, repeat=rep),
        box("Fensterband", [f"{-h} + 2*s", f"{base + 3} + 8*s", f"{zc - h} + 2*s"], [f"{2 * h} - 4*s", 1, f"{2 * h} - 4*s"], glow("glow", 1.2), mode="paint", jitter=False, repeat=rep),
        box("Traufpanzer", [f"{-h - 4} + 2*s", f"{base + 6} + 8*s", f"{zc - h - 4} + 2*s"], [f"{2 * h + 8} - 4*s", 2, f"{2 * h + 8} - 4*s"], {"frame": "trim", "fill": "primary", "axes": "xz"}, repeat=rep),
        box("Aufgebogene Ecke", [f"{-h - 5} + 2*s", f"{base + 7} + 8*s", f"{zc - h - 5} + 2*s"], [2, 3, 2], "trim", repeat=rep, mirror="xz", mirrorAt={"x": 0, "z": zc}),
        box("Laterne", [f"{-h - 4} + 2*s", f"{base + 4} + 8*s", zc - 1], [1, 2, 2], glow("glow2", 2.0), jitter=False, repeat=rep, mirror="x", mirrorAt=0),
        cyl("Geschützkuppel", [0, top, zc], 4, 3, "trim"),
        line("Geschützrohr", [0, top + 2, zc], [0, top + 2, zc + 14], 1.2, "metal_dark"),
    ])
ops += [pagoda("Pagodenturm achtern", 70, 11, 2, 15), pagoda("Pagodenturm Mitte", 160, 14, 3, 16), pagoda("Pagodenturm vorn", 240, 10, 2, 16)]
ops += [
    # Drachenkopf
    loft("Drachenschädel", [S(306, 24, 12, 6, 4, y=8), S(330, 22, 11, 5, 4, y=9), S(356, 14, 8, 3, 3, y=8)], "primary"),
    loft("Oberkiefer", [S(340, 16, 4, 2, 2, y=6), S(368, 10, 3, 2, 1, y=5)], "primary"),
    loft("Unterkiefer", [S(330, 14, 2, 4, 1, y=-2), S(362, 8, 2, 3, 1, y=-4)], "secondary"),
    box("Zähne", [-5, -1, "340 + i*4"], [1, 3, 1], "cloth2", repeat={"count": 6, "step": [0, 0, 0]}, mirror="x", mirrorAt=0),
    box("Drachenperle", [-3, -1, 362], [6, 6, 6], glow("glow", 2.6), jitter=False),
    box("Augen", [9, 14, 334], [2, 2, 4], glow("glow", 2.4), jitter=False, mirror="x", mirrorAt=0),
    line("Horn", [6, 18, 326], [10, 32, 296], 1.8, "trim", mirror="x", mirrorAt=0),
    line("Bartfaden", [6, 4, 362], [30, -6, 330], 0.7, "trim", mirror="x", mirrorAt=0),
    line("Bartfaden 2", [30, -6, 330], [40, -2, 300], 0.6, "trim", mirror="x", mirrorAt=0),
    box("Mähne", [-6, 18, "300 + i*-6"], [12, "6 - i", 4], "cloth", repeat={"count": 5, "step": [0, 0, 0]}),
    # Schwanz
    loft("Schwanz", [S(-50, 4, 2, 2, 0, y=10, rnd=1), S(0, 22, 10, 9, 4, y=-1)], {"checker": ["primary", shade("primary", 0.78)], "period": 2}),
    line("Schwanzflosse", [0, 10, -46], [0, 26, -64], 1.5, "cloth"),
    line("Schwanzflosse seitlich", [0, 10, -46], [14, 16, -64], 1.2, "cloth", mirror="x", mirrorAt=0),
    # Donnertrommeln
    group("Donnertrommel", [
        cyl("Trommel", [20, 6, 196], 6, 6, "trim", axis="x"),
        cyl("Blitzspule", [26, 6, 196], 6.5, 1, glow("glow", 2.0), axis="x", jitter=False),
    ], mirror="x", mirrorAt=0),
    group("Flossen-Triebwerk", [
        loft("Gondel", [S(80, 8, 4, 4, 0, x=26, y=-6, rnd=1), S(150, 10, 5, 5, 0, x=26, y=-6, rnd=1)], "secondary"),
        cyl("Gondelglut", [26, -6, 79], 3, 1, glow("glow", 2.4), axis="z", jitter=False),
    ], mirror="x", mirrorAt=0),
    window_rows("Fensterreihe", 22, 4, 10, 280, 5, color=glow("glow2", 1.3)),
] + engines("Jadeantrieb", [(-8, -4), (8, -4)], -30, 4, glow("glow", 2.4), depth=4)
save("himmelsreich_v2", "(2. Fassung) Louchuan – Turmschiff des Himmelsreichs (Rohmodell)", "himmelsreich", ["himmelsreich"], [30, 110], ops, [0, 0, 160])
print("ok")
