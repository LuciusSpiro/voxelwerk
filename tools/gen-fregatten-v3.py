# Fregatten 3. Fassung nach Kais Stilvorlagen (2026-10-06): python tools/gen-fregatten-v3.py
#   Rom: schwerer Schlachtschiff-Block mit Tempel und Adler · Germanen: rauer Rumpf, Langhaus, Raubvogel-Drachensteven,
#   gepfeilte Heckschwingen · Ägypten: Scheibe mit Pharaonenmaske und Pyramide · Himmelsreich: Gliederkette mit Drachenkopf
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schiffbau import *

def turret(n, x, y, z, r=5, down=False, col="metal"):
    s = -1 if down else 1
    ops = [cyl(f"{n} Sockel", [x, y if not down else y - 2, z], r, 2, "metal_dark"),
           box(f"{n} Gehäuse", [x - r + 1, y + 2 if not down else y - 5, z - r + 1], [2 * r - 2, 3, 2 * r - 1], frame("trim", col, "xz")),
           line(f"{n} Rohr L", [x - 1.5, y + s * 3.5, z + r - 1], [x - 1.5, y + s * 3.5, z + 4 * r], 0.8, "metal_dark"),
           line(f"{n} Rohr R", [x + 1.5, y + s * 3.5, z + r - 1], [x + 1.5, y + s * 3.5, z + 4 * r], 0.8, "metal_dark")]
    return ops

def engine(n, x, y, z_back, length, r, ring, glowc, case="metal_dark", rings=4):
    ops = [cyl(f"{n} Gehäuse", [x, y, z_back], r, length, case, axis="z"),
           cyl(f"{n} Glocke", [x, y, z_back - 3], r + 2, 4, ring, axis="z", hollow=3),
           cyl(f"{n} Glut", [x, y, z_back - 1], r - 2, 2, glowc, axis="z", jitter=False),
           cyl(f"{n} Kern", [x, y, z_back - 2], max(2, r // 3), 1, {"role": "white", "emit": 3.0}, axis="z", jitter=False)]
    for k in range(rings):
        ops.append(cyl(f"{n} Ring {k+1}", [x, y, z_back + 6 + k * (length - 10) // max(1, rings - 1)], r + 1, 2, ring, axis="z"))
    return ops

def gun_rows(n, half_w, ys, z0, z1, step, length=8):
    """Breitseiten-Geschützpforten mit Rohren auf beiden Seiten (Gruppe mit Spiegelung)."""
    ops = []
    cnt = (z1 - z0) // step
    for k, y in enumerate(ys):
        ops += [box(f"{n} Pforte {k+1}", [half_w - 2, y - 1, z0 - 1], [4, 3, 4], "dark", mode="paint", repeat=rep(cnt, (0, 0, step))),
                line(f"{n} Rohr {k+1}", [half_w - 1, y, z0 + 1], [half_w + length, y, z0 + 1], 0.9, "metal_dark", repeat=rep(cnt, (0, 0, step)))]
    return [group(n, ops, mirror="x", mirrorAt=0)]

def windows(n, half_w, y, z0, z1, step, col=None):
    return box(n, [-half_w - 2, y, z0], [2 * half_w + 4, 1, 2], col or glow("glow2", 0.9), mode="paint", jitter=False, repeat=rep((z1 - z0) // step, (0, 0, step)))

# =============================================================================================
# ROM – schwerer Block, Tempel, Adler, Türme
# =============================================================================================
ops = [
    loft("Heckblock", [S(0, 64, 22, 24, 6), S(80, 64, 22, 24, 6)], "metal_dark"),
    loft("Spant 1", [S(80, 70, 25, 27, 7), S(87, 70, 25, 27, 7)], "trim"),
    loft("Mittelblock", [S(87, 58, 20, 26, 6), S(260, 58, 20, 26, 6)], "metal_dark"),
    loft("Spant 2", [S(260, 64, 23, 28, 7), S(267, 64, 23, 28, 7)], "trim"),
    loft("Vorschiff", [S(267, 54, 18, 26, 6), S(336, 50, 16, 26, 6)], "metal_dark"),
    loft("Spant 3", [S(336, 56, 19, 28, 7), S(342, 56, 19, 28, 7)], "trim"),
    loft("Bugpanzer", [S(342, 50, 16, 26, 6), S(372, 42, 14, 26, 5), S(388, 32, 12, 22, 4)], "metal"),
    loft("Rammsporn", [S(372, 18, 2, 8, 2, y=-18), S(414, 2, 1, 2, 0, y=-22)], "trim"),
    box("Rote Felder", [-40, -18, 96], [80, 28, 72], frame("trim", "primary", "yz"), mode="paint"),
    box("Rote Felder 2", [-40, -18, 178], [80, 28, 76], frame("trim", "primary", "yz"), mode="paint"),
    box("Rote Felder 3", [-40, -18, 274], [80, 26, 56], frame("trim", "primary", "yz"), mode="paint"),
    box("Bugschild", [-40, -16, 346], [80, 24, 24], frame("trim", "primary", "yz"), mode="paint"),
    box("Goldband oben", [-40, 15, 0], [80, 1, 400], "trim", mode="paint"),
    windows("Fensterreihe", 34, 12, 10, 330, 5),
    windows("Fensterreihe unten", 34, -22, 20, 330, 7),
] + gun_rows("Breitseite", 29, [2, -9], 100, 256, 9) + [
    loft("Oberdeck", [S(36, 40, 30, 0, 5), S(300, 40, 30, 0, 5), S(318, 28, 22, 0, 4)], "metal"),
    box("Oberdeck Fenster", [-22, 24, 40], [44, 1, 2], glow("glow2", 0.9), mode="paint", jitter=False, repeat=rep(26, (0, 0, 10))),
    box("Oberdeck Goldkante", [-22, 29, 30], [44, 1, 290], "trim", mode="paint"),
    # Tempel
    box("Podium", [-20, 30, 66], [40, 5, 110], "secondary"),
    box("Stufen", [-14, 30, 176], [28, "5 - i", 2], "stone_light", repeat=rep(4, (0, 0, 2))),
    box("Cella", [-13, 35, 80], [26, 16, 74], "stone"),
    cyl("Säulen Seite", [-17, 35, 72], 1.5, 16, "secondary", repeat=rep(15, (0, 0, 7))),
    cyl("Säulen Seite rechts", [17, 35, 72], 1.5, 16, "secondary", repeat=rep(15, (0, 0, 7))),
    cyl("Säulen Front", [-15, 35, 172], 1.5, 16, "secondary", repeat=rep(6, (6, 0, 0))),
    box("Gebälk", [-20, 51, 66], [40, 3, 110], frame("trim", "primary", "xz")),
    wedge("Giebeldach", [-20, 54, 66], [40, 11, 110], "primary", gable="x"),
    box("Giebelfeld", [-18, 54, 175], [36, 8, 1], "trim"),
    box("Dachfirst gold", [-1, 64, 66], [2, 1, 110], "trim"),
    ell("Adler auf dem Giebel", [0, 68, 172], [3, 4, 3], "trim"),
    box("Adlerschwingen Giebel", [-8, 69, 171], [16, 2, 2], "trim"),
    # Kommandoturm achtern
    box("Kommandoturm", [-12, 30, 30], [24, 30, 32], frame("trim", "metal", "y")),
    box("Turmfenster", [-13, 50, 30], [26, 2, 32], glow("glow2", 1.3), mode="paint", jitter=False),
    ell("Sensorkuppel L", [-7, 60, 40], [5, 5, 5], "metal_light"),
    ell("Sensorkuppel R", [7, 60, 52], [4, 4, 4], "metal_light"),
    line("Mast", [0, 60, 46], [0, 86, 46], 1, "metal"),
    line("Rah", [-10, 80, 46], [10, 80, 46], 0.6, "metal"),
    box("Aquila", [-3, 86, 45], [6, 3, 2], "trim"),
]
# Banner
for k, (x, z) in enumerate([(-20, 66), (19, 66), (-20, 174), (19, 174)]):
    ops += [line(f"Bannerstange {k+1}", [x, 54, z], [x, 76, z], 0.9, "metal_light"),
            box(f"Banner {k+1}", [x, 63, z + 1], [1, 12, 6], stripes(["cloth", "cloth", "trim"], "y", 4)),
            box(f"Bannerspitze {k+1}", [x - 1, 76, z - 1], [2, 2, 2], "trim")]
for k, z in enumerate([200, 235, 270]):
    ops += turret(f"Turm oben {k+1}", 0, 30, z, 6)
for k, z in enumerate([110, 160, 210, 300]):
    ops += turret(f"Turm Flanke L{k+1}", -24, 20, z, 4) + turret(f"Turm Flanke R{k+1}", 24, 20, z, 4)
for k, z in enumerate([150, 250]):
    ops += turret(f"Turm unten {k+1}", 0, -26, z, 5, down=True)
# Adler am Bug
ops += [
    box("Adlersockel", [-10, 12, 364], [20, 6, 18], frame("trim", "metal_dark", "xz")),
    box("Inschrifttafel", [-9, 6, 381], [18, 6, 1], frame("trim", "primary", "xy")),
    ell("Adlerleib", [0, 27, 375], [6, 10, 6], "trim"),
    ell("Adlerkopf", [0, 39, 379], [3.5, 4, 4.5], "trim"),
    box("Adlerschnabel", [-1, 36, 383], [2, 3, 3], shade("trim", 0.7)),
    group("Adlerschwinge", [box("Feder", ["5 + i*4", "22 + i*3", "372 - i*2"], [4, "11 - i", 5], stripes(["trim", shade("trim", 0.75)], "y", 2), repeat=rep(6))], mirror="x", mirrorAt=0),
    box("Adlerfänge", [-4, 17, 373], [8, 2, 6], shade("trim", 0.7)),
    # Antrieb
    box("Antriebsgehäuse", [-32, -24, -14], [64, 46, 14], frame("trim", "metal", "xy")),
] + engine("Haupttriebwerk", 0, -1, -56, 56, 16, "trim", glow("glow", 2.6)) \
  + engine("Triebwerk L", -26, -12, -44, 44, 10, "trim", glow("glow", 2.4)) \
  + engine("Triebwerk R", 26, -12, -44, 44, 10, "trim", glow("glow", 2.4))
save("schiff/fregatte/rom_v3", "Quinquereme – römische Fregatte (3. Fassung)", "rom", ["schiff", "fregatte", "rom", "rohmodell"], [20, 120], ops, [0, 0, 170])

# =============================================================================================
# GERMANEN – rauer Rumpf mit Runenplatten, Langhaus, Wachturm, Raubvogel-Drachensteven, gepfeilte Heckschwingen
# =============================================================================================
hull = [S(0, 44, 16, 20, 5), S(60, 48, 18, 22, 6), S(250, 46, 18, 22, 6), S(310, 36, 16, 20, 5), S(340, 24, 14, 16, 4)]
ops = [
    loft("Rumpf", hull, "metal"),
    box("Plattengänge", [-30, -22, 0], [60, 40, 350], stripes(["metal", shade("metal", 0.82)], "y", 4), mode="paint"),
    box("Runenplatten", [-30, -14, 70], [60, 22, 60], frame("metal_dark", "stone_dark", "yz"), mode="paint", repeat=rep(3, (0, 0, 72))),
    box("Runen", [-30, -6, 76], [60, 1, 2], glow("glow", 1.6), mode="paint", jitter=False, repeat=rep(26, (0, 0, 8))),
    box("Runen 2", [-30, -10, 80], [60, 1, 1], glow("glow", 1.6), mode="paint", jitter=False, repeat=rep(26, (0, 0, 8))),
    box("Kriegsbemalung", [-30, 4, 280], [60, 6, 3], "cloth", mode="paint", repeat=rep(3, (0, 0, 8))),
    windows("Fensterreihe", 26, 10, 20, 300, 7, col=glow("glow", 1.3)),
] + gun_rows("Breitseite", 23, [0], 90, 300, 14, length=7) + [
    # Drachensteven
    loft("Steven", [S(330, 22, 14, 16, 4), S(356, 16, 12, 10, 3, y=14), S(376, 14, 10, 8, 3, y=30)], "metal"),
    box("Stevenschuppen", [-14, 0, 330], [28, 46, 48], stripes(["metal", "secondary"], "y", 3), mode="paint"),
    loft("Schädel", [S(372, 20, 10, 8, 3, y=36), S(396, 18, 9, 6, 3, y=37), S(410, 12, 6, 3, 2, y=36)], "secondary"),
    box("Stirnpanzer", [-9, 42, 376], [18, 4, 22], "metal_dark"),
    loft("Hakenschnabel", [S(404, 12, 6, 3, 2, y=37), S(424, 7, 4, 5, 1, y=32), S(434, 3, 2, 9, 0, y=24)], "metal_light"),
    loft("Unterkiefer", [S(388, 14, 2, 5, 2, y=28), S(418, 7, 2, 4, 1, y=26)], "metal_dark"),
    box("Reißzähne", [-6, 25, "394 + i*4"], [1, 5, 1], "trim", repeat=rep(6), mirror="x", mirrorAt=0),
    box("Augen", [8, 40, 396], [2, 3, 6], glow("glow2", 3.0), jitter=False, mirror="x", mirrorAt=0),
    box("Blutstreifen", [-11, 34, 394], [22, 4, 2], "cloth", mode="paint"),
    line("Horn", [7, 45, 384], [20, 58, 352], 2.2, "trim", mirror="x", mirrorAt=0),
    line("Hornspitze", [20, 58, 352], [22, 66, 338], 1.3, "cloth", mirror="x", mirrorAt=0),
    line("Nackenstachel", [0, 44, "380 - i*9"], [0, "58 - i*2", "366 - i*9"], 1.3, "trim", repeat=rep(5)),
    # Langhaus
    box("Langhaus", [-14, 18, 140], [28, 14, 80], frame("metal_dark", "stone_dark", "y")),
    wedge("Langhausdach", [-18, 32, 136], [36, 18, 88], stripes(["metal", "metal_dark"], "z", 3), gable="x"),
    line("Firstdrachen vorn", [0, 49, 222], [0, 56, 230], 1.2, "trim"),
    line("Firstdrachen hinten", [0, 49, 136], [0, 56, 128], 1.2, "trim"),
    group("Valknut", [line("Dreieck a", [-15, 21, 168], [-15, 21, 192], 0.6, glow("glow", 2.0), jitter=False),
                      line("Dreieck b", [-15, 21, 192], [-15, 30, 180], 0.6, glow("glow", 2.0), jitter=False),
                      line("Dreieck c", [-15, 30, 180], [-15, 21, 168], 0.6, glow("glow", 2.0), jitter=False)], mirror="x", mirrorAt=0),
    box("Hallenfenster", [-15, 24, 146], [30, 2, 2], glow("glow2", 1.4), mode="paint", jitter=False, repeat=rep(8, (0, 0, 8))),
    # Wachtürme
    box("Wachturm", [-8, 18, 64], [16, 42, 16], frame("metal_dark", "stone_dark", "y")),
    box("Wachturm Plattform", [-11, 60, 61], [22, 3, 22], "metal_dark"),
    box("Zinnen", [-11, 63, 61], [2, 3, 22], "metal_dark", repeat=rep(6, (4, 0, 0))),
    cyl("Turmhelm", [0, 63, 72], 7, 18, "metal", r2=1),
    line("Turmmast", [0, 81, 72], [0, 96, 72], 0.7, "metal_light"),
    cyl("Spitzturm", [12, 18, 112], 4, 34, frame("metal_dark", "stone_dark", "y")),
    cyl("Spitzturm Helm", [12, 52, 112], 5, 14, "metal", r2=1),
    box("Turmfenster", [-9, 50, 64], [18, 2, 18], glow("glow2", 1.4), mode="paint", jitter=False),
]
for k, z in enumerate([240, 272]):
    ops += turret(f"Turm oben {k+1}", 0, 18, z, 5)
for k, z in enumerate([110, 300]):
    ops += turret(f"Turm Flanke L{k+1}", -18, 17, z, 4) + turret(f"Turm Flanke R{k+1}", 18, 17, z, 4)
ops += turret("Turm unten", 0, -22, 200, 5, down=True)
# Heckschwingen mit Waffengondeln
wing = [box("Schwingenplatte", ["22 + i*6", "-2 - i", "20 - i*6"], [6, 3, "92 - i*6"], frame("metal_dark", "metal", "xz"), repeat=rep(9)),
        box("Schwingenrunen", ["22 + i*6", "1 - i", "40 - i*6"], [6, 1, 2], glow("glow", 1.5), mode="paint", jitter=False, repeat=rep(9)),
        box("Blutspitzen", [62, -14, -40], [20, 14, 30], "cloth", mode="paint"),
        cyl("Gondel", [76, -10, -38], 7, 56, "metal_dark", axis="z"),
        cyl("Gondelringe", [76, -10, -30], 8, 2, "trim", axis="z", repeat=rep(4, (0, 0, 14))),
        cyl("Gondelglut", [76, -10, -39], 5, 1, glow("glow", 2.6), axis="z", jitter=False),
        line("Gondelkanone", [76, -10, 18], [76, -10, 46], 1.6, "metal_dark"),
        line("Schwingendorn", [80, -10, 46], [84, -8, 56], 1, "trim")]
ops += [group("Heckschwinge", wing, mirror="x", mirrorAt=0)]
ops += engine("Haupttriebwerk L", -11, 0, -40, 42, 10, "trim", glow("glow", 2.6)) + engine("Haupttriebwerk R", 11, 0, -40, 42, 10, "trim", glow("glow", 2.6))
save("schiff/fregatte/nord_v3", "Drakkar – Fregatte der Germanen (3. Fassung)", "nord", ["schiff", "fregatte", "nord", "rohmodell"], [45, 120], ops, [0, 0, 170])

# =============================================================================================
# ÄGYPTEN – Scheibe mit Rumpfrücken, Pharaonenmaske, Pyramide, Leiterbahnen
# =============================================================================================
R = 160
ops = [
    cyl("Scheibe", [0, -6, 0], R, 6, "primary"),
    ell("Unterschale", [0, -6, 0], [R - 20, 12, R - 20], "metal", half="-y"),
    box("Unterschale Ring", [-R, -14, -R], [2 * R, 1, 2 * R], "trim", mode="paint"),
    cyl("Rand", [0, 0, 0], R, 5, "primary", r2=R - 8, hollow=26),
    cyl("Randkante gold", [0, 4, 0], R - 8, 1, "trim", hollow=3),
    cyl("Innenkante Licht", [0, 0, 0], R - 27, 1, glow("glow", 1.6), hollow=1, jitter=False),
    cyl("Feld", [0, -1, 0], R - 27, 1, shade("primary", 0.8)),
    cyl("Randband Lapis", [0, -6, 0], R, 3, "secondary", hollow=1, mode="paint"),
]
# Randlichter
for k in range(28):
    a = 2 * math.pi * k / 28
    ops.append(box(f"Randlicht {k+1}", [round((R - 0.5) * math.cos(a)) - 1, -5, round((R - 0.5) * math.sin(a)) - 1], [2, 2, 2], glow("glow", 2.2), jitter=False))
# Leiterbahnen im Feld
rnd = random.Random(7)
traces = 0
while traces < 46:
    x, z = rnd.randint(-120, 120), rnd.randint(-120, 120)
    if abs(x) < 26 or x * x + z * z > 118 ** 2: continue
    pts = [(x, z)]
    for seg in range(rnd.randint(2, 4)):
        L = rnd.randint(8, 26) * rnd.choice([-1, 1])
        if seg % 2 == 0: x2, z2 = x + L, z
        else: x2, z2 = x, z + L
        if abs(x2) < 24 or x2 * x2 + z2 * z2 > 124 ** 2: break
        pts.append((x2, z2)); x, z = x2, z2
    if len(pts) < 2: continue
    traces += 1
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        ops.append(box(f"Leiterbahn {traces}", [min(ax, bx), -1, min(az, bz)], [abs(bx - ax) + 1, 1, abs(bz - az) + 1], glow("glow", 1.4), mode="paint", jitter=False))
    ex, ez = pts[-1]
    ops.append(cyl(f"Knoten {traces}", [ex + 0.5, 0, ez + 0.5], 1.6, 1, glow("glow", 2.0), jitter=False))
ops += [
    loft("Rumpfrücken", [S(-150, 30, 16, 4, 6), S(-60, 46, 20, 4, 8), S(120, 42, 18, 4, 8), S(168, 36, 16, 4, 6)], "stone"),
    box("Rückenrippen", [-24, 8, -100], [48, 13, 2], shade("stone", 0.75), mode="paint", repeat=rep(18, (0, 0, 12))),
    box("Lufteinlass", [-24, 2, "-40 + i*40"], [48, 8, 12], frame("trim", "dark", "yz"), mode="paint", repeat=rep(4)),
    box("Rückenlicht", [-1, 20, -60], [2, 1, 220], glow("glow", 1.4), mode="paint", jitter=False),
    # Pyramide achtern
    box("Pyramide", ["-28 + i", "18 + i*2", "-148 + i"], ["56 - 2*i", 2, "56 - 2*i"], "stone", repeat=rep(27)),
    box("Pyramidenkante", ["-28 + i", "19 + i*2", "-148 + i"], ["56 - 2*i", 1, "56 - 2*i"], frame("trim", "stone", "xz"), mode="paint", repeat=rep(27)),
    box("Pyramidenglyphen", [-30, 20, -121], [60, 54, 2], glow("glow", 1.5), mode="paint", jitter=False),
    box("Pyramidenband", [-30, 44, -150], [60, 1, 60], glow("glow", 1.5), mode="paint", jitter=False),
    box("Pyramidion", [-2, 72, -122], [4, 4, 4], glow("glow2", 2.6), jitter=False),
    # Pharaonenmaske
    loft("Nemes-Kopftuch", [S(156, 42, 30, 12, 9, y=10), S(180, 36, 28, 10, 8, y=10), S(192, 26, 24, 6, 6, y=10)], stripes(["trim", "secondary"], "y", 3)),
    box("Kopftuch Laschen", [13, -14, 178], [7, 24, 8], stripes(["trim", "secondary"], "y", 3), mirror="x", mirrorAt=0),
    ell("Gesicht", [0, 16, 196], [11, 14, 8], "trim"),
    box("Augen", [3, 20, 202], [5, 2, 2], "dark", mirror="x", mirrorAt=0),
    box("Lidstrich", [2, 22, 203], [7, 1, 1], "secondary", mirror="x", mirrorAt=0),
    box("Augenglanz", [5, 20, 204], [1, 1, 1], glow("glow", 2.4), jitter=False, mirror="x", mirrorAt=0),
    box("Nase", [-1, 13, 203], [2, 5, 2], shade("trim", 0.85)),
    box("Mund", [-3, 7, 203], [6, 1, 1], shade("trim", 0.6)),
    box("Zeremonialbart", [-2, -5, 196], [4, 9, 3], stripes(["trim", "secondary"], "y", 2)),
    box("Uräus", [-1, 30, 197], [2, 6, 2], "trim"),
    box("Uräus Kopf", [-2, 35, 198], [4, 2, 3], glow("glow", 2.0), jitter=False),
    line("Bugkanone", [6, -6, 176], [6, -6, 232], 1.6, "metal_dark", mirror="x", mirrorAt=0),
    line("Bugkanone unten", [13, -12, 172], [13, -12, 222], 1.4, "metal_dark", mirror="x", mirrorAt=0),
]
ops += engine("Sonnenantrieb", 0, 6, -160, 14, 12, "trim", glow("glow2", 2.6), case="stone", rings=2)
ops += turret("Turm Rücken", 0, 20, 60, 6, col="stone") + turret("Turm unten", 0, -18, 60, 5, down=True, col="stone")
save("schiff/fregatte/aegypten_v3", "Mandjet – ägyptische Scheibe (3. Fassung)", "aegypten", ["schiff", "fregatte", "aegypten", "rohmodell"], [80, 95], ops, [0, 0, 0])

# =============================================================================================
# HIMMELSREICH – Gliederkette aus lackierten Segmenten, goldener Drachenkopf, Pagode, blaue Rundtriebwerke
# =============================================================================================
ops = []
for k in range(5):
    z0 = k * 64
    ops += [loft(f"Glied {k+1}", [S(z0, 40, 18, 18, 9), S(z0 + 56, 40, 18, 18, 9)], "primary"),
            box(f"Glied {k+1} Goldrahmen", [-22, -14, z0 + 4], [44, 28, 48], frame("trim", "primary", "yz"), mode="paint"),
            box(f"Glied {k+1} Bildfeld", [-22, -6, z0 + 14], [44, 12, 28], frame("trim", "cloth2", "yz"), mode="paint"),
            box(f"Glied {k+1} Dach", [-14, 18, z0 + 2], [28, 1, 52], frame("trim", "secondary", "xz")),
            box(f"Glied {k+1} Fenster", [-22, 10, z0 + 6], [44, 1, 2], glow("glow", 1.4), mode="paint", jitter=False, repeat=rep(9, (0, 0, 5)))]
    if k < 4:
        ops += [cyl(f"Gelenk {k+1}", [0, 0, z0 + 56], 14, 8, "secondary", axis="z"),
                cyl(f"Gelenkring {k+1}", [0, 0, z0 + 59], 15, 2, "trim", axis="z")]
ops += [box("Bildfeld-Figuren", [-23, -4, "18 + i*6"], [46, 7, 2], shade("cloth2", 0.7), mode="paint", repeat=rep(48, (0, 0, 6)))]
# Pagode achtern auf Glied 1
for s in range(5):
    h = 12 - s * 2
    y = 19 + s * 9
    ops += [box(f"Pagode Stock {s+1}", [-h, y, 28 - h], [2 * h, 6, 2 * h], frame("trim", "primary", "y")),
            box(f"Pagode Fensterband {s+1}", [-h, y + 3, 28 - h], [2 * h, 1, 2 * h], glow("glow", 1.2), mode="paint", jitter=False),
            box(f"Pagode Traufe {s+1}", [-h - 4, y + 6, 24 - h], [2 * h + 8, 2, 2 * h + 8], frame("trim", "secondary", "xz")),
            box(f"Pagode Ecke {s+1}", [-h - 5, y + 7, 23 - h], [2, 3, 2], "trim", mirror="xz", mirrorAt={"x": 0, "z": 28})]
ops += [line("Pagodenspitze", [0, 64, 28], [0, 82, 28], 1, "trim"), box("Pagodenperle", [-1, 82, 27], [2, 2, 2], glow("glow", 2.4), jitter=False)]
for k, (x, z) in enumerate([(-14, 70), (14, 70), (-14, 200), (14, 200)]):
    ops += [line(f"Fahnenstange {k+1}", [x, 18, z], [x, 44, z], 0.9, "metal_light"),
            box(f"Fahne {k+1}", [x, 34, z + 1], [1, 9, 9], frame("trim", "primary", "yz"))]
for k, z in enumerate([110, 160, 240]):
    ops += turret(f"Turm oben {k+1}", 0, 19, z, 5, col="primary")
for k, z in enumerate([130, 250]):
    ops += turret(f"Turm unten {k+1}", 0, -18, z, 5, down=True, col="primary")
# Drachenkopf (Gold)
ops += [
    loft("Drachenschädel", [S(318, 42, 22, 16, 9), S(346, 40, 24, 14, 9, y=2), S(372, 28, 16, 8, 6)], "trim"),
    loft("Schnauze", [S(362, 26, 8, 4, 4, y=6), S(398, 18, 6, 3, 3, y=4)], "trim"),
    loft("Unterkiefer", [S(346, 32, 2, 8, 3, y=-10), S(392, 16, 2, 4, 2, y=-16)], shade("trim", 0.8)),
    box("Zähne oben", [-9, -1, "364 + i*5"], [2, 4, 2], "white", repeat=rep(6), mirror="x", mirrorAt=0),
    box("Zähne unten", [-7, -14, "356 + i*6"], [2, 4, 2], "white", repeat=rep(6), mirror="x", mirrorAt=0),
    box("Zunge", [-4, -12, 350], [8, 2, 26], "cloth"),
    box("Augen", [12, 16, 352], [3, 4, 6], {"role": "warning", "emit": 2.6}, jitter=False, mirror="x", mirrorAt=0),
    box("Augenbrauen", [8, 22, 348], [12, 3, 12], shade("trim", 0.75), mirror="x", mirrorAt=0),
    box("Nüstern", [5, 10, 396], [3, 2, 2], "dark", mirror="x", mirrorAt=0),
    line("Horn", [10, 24, 340], [22, 52, 304], 2.4, "trim", mirror="x", mirrorAt=0),
    line("Horn 2", [6, 26, 336], [12, 48, 300], 1.8, shade("trim", 0.85), mirror="x", mirrorAt=0),
    line("Bartfaden", [10, 6, 390], [36, -6, 360], 0.8, "trim", mirror="x", mirrorAt=0),
    line("Bartfaden Ende", [36, -6, 360], [44, 2, 334], 0.7, "trim", mirror="x", mirrorAt=0),
    group("Mähne", [line(f"Mähnenflamme {k+1}", [20, 10 - k * 6, 330], [30, 14 - k * 6, 312 - k * 2], 1.6, shade("trim", 0.9 + 0.05 * k)) for k in range(4)], mirror="x", mirrorAt=0),
    line("Bugkanone", [10, -14, 330], [10, -14, 384], 1.4, "metal_dark", mirror="x", mirrorAt=0),
    box("Inschrifttafel", [-21, 0, 324], [42, 8, 14], frame("trim", "secondary", "yz"), mode="paint"),
    # Antrieb: zwei blaue Rundtriebwerke übereinander
    box("Antriebsjoch", [-18, -24, -8], [36, 48, 10], frame("trim", "primary", "xy")),
]
ops += engine("Triebwerk oben", 0, 12, -56, 50, 13, "trim", {"role": "water", "emit": 2.6}, case="water") \
     + engine("Triebwerk unten", 0, -14, -56, 50, 13, "trim", {"role": "water", "emit": 2.6}, case="water")
save("schiff/fregatte/himmelsreich_v3", "Louchuan – Drachenschiff des Himmelsreichs (3. Fassung)", "himmelsreich", ["schiff", "fregatte", "himmelsreich", "rohmodell"], [20, 115], ops, [0, 0, 170])
print("ok")
