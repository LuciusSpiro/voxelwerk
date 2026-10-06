# Fregatten 4. Fassung – möglichst nah an Kais Stilvorlagen (2026-10-06): python tools/gen-fregatten-v4.py
#   Rom: Kathedralen-Schlachtschiff mit Tempel, Adler-Galion, Kuppeltürmen, Bannern
#   Ägypten: dunkler Rundrumpf mit Goldringen, Pharaonenmaske als Bug, große Pyramide, vier blaue Triebwerke
#   Himmelsreich: Bugblock mit Palast, Drachenreliefs, Bildfeld, Holzlack-Glieder, Pagode achtern, blaue Triebwerke
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schiffbau import *

def turret(n, x, y, z, r=6, down=False, col="metal", barrel=5):
    s = -1 if down else 1
    yb = y if not down else y - 2
    return [cyl(f"{n} Sockel", [x, yb, z], r, 2, "metal_dark"),
            box(f"{n} Gehäuse", [x - r + 1, y + 2 if not down else y - 6, z - r + 1], [2 * r - 2, 4, 2 * r - 1], frame("trim", col, "xz")),
            box(f"{n} Blende", [x - r + 2, y + 2 if not down else y - 6, z + r - 1], [2 * r - 4, 4, 2], "metal_dark"),
            line(f"{n} Rohr L", [x - 2, y + s * 4, z + r], [x - 2, y + s * 4, z + barrel * r], 1, "metal_dark"),
            line(f"{n} Rohr R", [x + 2, y + s * 4, z + r], [x + 2, y + s * 4, z + barrel * r], 1, "metal_dark"),
            box(f"{n} Mündung", [x - 3, y + s * 4 - 1, z + barrel * r - 1], [6, 2, 2], "trim")]

def engine(n, x, y, z_back, length, r, ring, glowc, case="metal_dark", rings=4):
    ops = [cyl(f"{n} Gehäuse", [x, y, z_back], r, length, case, axis="z"),
           cyl(f"{n} Glocke", [x, y, z_back - 4], r + 2, 5, ring, axis="z", hollow=3),
           cyl(f"{n} Glut", [x, y, z_back - 2], r - 1, 2, glowc, axis="z", jitter=False),
           cyl(f"{n} Kern", [x, y, z_back - 3], max(2, r // 2), 1, {"role": "white", "emit": 3.0}, axis="z", jitter=False)]
    for k in range(rings):
        ops.append(cyl(f"{n} Ring {k+1}", [x, y, z_back + 6 + k * (length - 12) // max(1, rings - 1)], r + 1, 3, ring, axis="z"))
    return ops

def ports(n, half_w, y, z0, z1, step, length=7, size=(3, 2)):
    cnt = (z1 - z0) // step
    return group(n, [box(f"{n} Pforte", [half_w - 2, y - 1, z0 - 1], [4, size[1] + 1, size[0] + 1], "dark", mode="paint", repeat=rep(cnt, (0, 0, step))),
                     line(f"{n} Rohr", [half_w - 1, y, z0 + 0.5], [half_w + length, y, z0 + 0.5], 1, "metal_dark", repeat=rep(cnt, (0, 0, step)))],
                 mirror="x", mirrorAt=0)

def slats(n, half_w, y, z0, z1, step=4, col="dark"):
    """horizontale Lamellen-Schlitze (Geschützdecks) als Farbe auf beiden Flanken"""
    return box(n, [-half_w - 2, y, z0], [2 * half_w + 4, 1, z1 - z0], col, mode="paint", repeat=rep(3, (0, step, 0)))

def windows(n, half_w, y, z0, z1, step, col=None, w=2):
    return box(n, [-half_w - 2, y, z0], [2 * half_w + 4, 1, w], col or glow("glow2", 1.0), mode="paint", jitter=False, repeat=rep((z1 - z0) // step, (0, 0, step)))

def banner(n, x, y, z, h=16, col="cloth"):
    return [line(f"{n} Stange", [x, y, z], [x, y + h + 6, z], 0.9, "metal_light"),
            line(f"{n} Querholz", [x, y + h + 4, z - 4], [x, y + h + 4, z + 4], 0.7, "trim"),
            box(f"{n} Tuch", [x, y + 4, z - 3], [1, h, 7], frame("trim", col, "yz")),
            box(f"{n} Spitze", [x - 1, y + h + 6, z - 1], [2, 2, 2], "trim")]

def stepped_pyramid(n, cx, y0, cz, base, steps, col, edge_glow, band_glow, band_every=6):
    ops = [box(n, [f"{cx - base // 2} + i", f"{y0} + i*2", f"{cz - base // 2} + i"], [f"{base} - 2*i", 2, f"{base} - 2*i"], col, repeat=rep(steps))]
    ops.append(group(f"{n} Kanten", [box("Kantenlicht", [f"{cx - base // 2} + i", f"{y0} + i*2", f"{cz - base // 2} + i"], [2, 2, 2], edge_glow, jitter=False, repeat=rep(steps))],
                     mirror="xz", mirrorAt={"x": cx, "z": cz}))
    for k in range(band_every, steps, band_every):
        ops.append(box(f"{n} Lichtband {k}", [cx - base // 2 - 1, y0 + k * 2, cz - base // 2 - 1], [base + 2, 1, base + 2], band_glow, mode="paint", jitter=False))
    return ops

# =============================================================================================
# ROM
# =============================================================================================
ops = [
    loft("Achterschiff", [S(0, 64, 26, 26, 5), S(110, 64, 26, 26, 5)], "metal_dark"),
    loft("Spant 1", [S(110, 70, 29, 29, 6), S(117, 70, 29, 29, 6)], "trim"),
    loft("Mittschiff", [S(117, 60, 22, 26, 5), S(250, 60, 22, 26, 5)], "metal_dark"),
    loft("Spant 2", [S(250, 66, 25, 29, 6), S(257, 66, 25, 29, 6)], "trim"),
    loft("Vorschiff", [S(257, 56, 18, 24, 5), S(362, 56, 18, 24, 5)], "metal_dark"),
    loft("Spant 3", [S(362, 62, 21, 27, 6), S(368, 62, 21, 27, 6)], "trim"),
    loft("Bugblock", [S(368, 56, 18, 24, 5), S(408, 52, 16, 22, 5), S(420, 46, 12, 18, 6)], "metal"),
    loft("Kielgalerie", [S(40, 40, 0, 32, 4), S(380, 36, 0, 30, 4)], "metal"),
    box("Rote Bänder Spanten", [-40, -30, 117], [80, 60, 4], "primary", mode="paint"),
    box("Rote Bänder Spanten 2", [-40, -30, 257], [80, 60, 4], "primary", mode="paint"),
    box("Rote Bänder Spanten 3", [-40, -30, 104], [80, 60, 4], "primary", mode="paint"),
]
ops += [box(f"Diagonalstreifen Bug {i}", [-40, -22 + i * 3, 300 + i * 6], [80, 3, 8], "primary", mode="paint") for i in range(13)]
ops += [box(f"Diagonalstreifen Achtern {i}", [-40, -22 + i * 3, 10 + i * 6], [80, 3, 8], "primary", mode="paint") for i in range(10)]
ops += [
    box("Inschrifttafel IMP AUG AQUILA", [-40, 8, 150], [80, 8, 70], frame("trim", "metal_dark", "yz"), mode="paint"),
    box("Inschrift", [-40, 11, 156], [80, 2, 3], "trim", mode="paint", repeat=rep(14, (0, 0, 4))),
    box("SPQR-Tafel", [-40, -4, 40], [80, 14, 50], frame("trim", "metal_dark", "yz"), mode="paint"),
    cyl("SPQR-Kranz", [-33, 3, 32], 6, 2, "trim", axis="x", hollow=1, mirror="x", mirrorAt=0),
    box("SPQR-Schrift", [-40, 2, 48], [80, 3, 3], "trim", mode="paint", repeat=rep(4, (0, 0, 6))),
    box("AQUILA-Bugtafel", [-30, -10, 419], [60, 10, 2], frame("trim", "primary", "xy")),
    box("Bugwappen", [-40, -2, 380], [80, 12, 18], frame("trim", "primary", "yz"), mode="paint"),
    slats("Geschützdeck Mitte", 30, -6, 130, 245),
    slats("Geschützdeck Vorn", 28, -8, 270, 355),
    ports("Breitseite oben", 30, 4, 132, 246, 8, length=8),
    ports("Breitseite unten", 30, -16, 136, 246, 10, length=6),
    ports("Breitseite Vorn", 28, -2, 272, 356, 9, length=6),
    windows("Fensterreihe", 34, 16, 6, 360, 6),
    windows("Fensterreihe 2", 34, 12, 9, 360, 6, col=glow("glow", 0.9)),
    windows("Fensterreihe unten", 34, -24, 20, 360, 9),
    line("Bugkanone", [-8, -18, 400], [-8, -18, 456], 2, "metal_dark", mirror="x", mirrorAt=0),
    line("Bugkanone 2", [-16, -14, 396], [-16, -14, 444], 1.6, "metal_dark", mirror="x", mirrorAt=0),
    line("Kielkanone", [0, -30, 200], [0, -42, 230], 1.6, "metal_dark", repeat=rep(3, (0, 0, 60))),
    # Aufbau, nach achtern ansteigend
    loft("Aufbau 1", [S(50, 46, 36, 0, 4), S(300, 46, 36, 0, 4)], "metal"),
    loft("Aufbau 1 Bugstufe", [S(300, 38, 28, 0, 4), S(336, 34, 24, 0, 4)], "metal"),
    box("Aufbau 1 Goldkante", [-24, 35, 50], [48, 1, 250], "trim", mode="paint"),
    windows("Aufbau 1 Fenster", 23, 28, 54, 300, 5),
    loft("Aufbau 2", [S(56, 36, 48, 0, 4), S(236, 36, 48, 0, 4)], "metal_dark"),
    box("Aufbau 2 Rotband", [-20, 40, 56], [40, 3, 180], "primary", mode="paint"),
    windows("Aufbau 2 Fenster", 18, 44, 60, 236, 6),
    # Tempel
    box("Podium", [-18, 48, 116], [36, 5, 100], "secondary"),
    box("Freitreppe", [-12, 48, 216], [24, "5 - i", 2], "stone_light", repeat=rep(4, (0, 0, 2))),
    box("Cella", [-11, 53, 128], [22, 16, 74], "stone"),
    cyl("Säulen links", [-15.5, 53, 120], 1.6, 16, "secondary", repeat=rep(14, (0, 0, 7))),
    cyl("Säulen rechts", [15.5, 53, 120], 1.6, 16, "secondary", repeat=rep(14, (0, 0, 7))),
    cyl("Säulen Front", [-13.5, 53, 213], 1.6, 16, "secondary", repeat=rep(6, (5.4, 0, 0))),
    box("Gebälk", [-18, 69, 116], [36, 3, 100], frame("trim", "primary", "xz")),
    wedge("Giebeldach", [-18, 72, 116], [36, 11, 100], stripes(["primary", shade("primary", 0.8)], "z", 2), gable="x"),
    box("Tympanon", [-16, 72, 215], [32, 8, 1], "trim"),
    box("Firstkante", [-1, 82, 116], [2, 1, 100], "trim"),
    box("Akroterion", [-18, 72, 215], [2, 4, 2], "trim", mirror="x", mirrorAt=0),
    ell("Giebeladler", [0, 87, 212], [3, 4, 3], "trim"),
    box("Giebeladler Schwingen", [-7, 88, 211], [14, 3, 2], "trim"),
    # Kuppeltürme achtern
    box("Kommandoturm", [-14, 48, 62], [28, 26, 46], frame("trim", "metal", "y")),
    windows("Kommandoturm Fenster", 13, 66, 64, 106, 4),
    box("Turmaufsatz", [-9, 74, 70], [18, 10, 30], "metal_dark"),
    ell("Kuppel 1", [-7, 84, 78], [6, 6, 6], "metal_light"),
    ell("Kuppel 2", [7, 84, 94], [5, 5, 5], "metal_light"),
    ell("Kuppel 3", [0, 50, 30], [7, 7, 7], "metal_light"),
    line("Hauptmast", [0, 84, 86], [0, 116, 86], 1, "metal"),
    line("Rah 1", [-12, 104, 86], [12, 104, 86], 0.8, "metal"),
    line("Rah 2", [-8, 112, 86], [8, 112, 86], 0.7, "metal"),
    box("Mastadler", [-3, 116, 85], [6, 3, 2], "trim"),
    box("Wimpel", [0, 106, 87], [1, 6, 9], "primary"),
    line("Antenne", [10, 84, 70], [10, 100, 66], 0.7, "metal_light"),
]
for k, (x, z) in enumerate([(-18, 118), (18, 118), (-18, 214), (18, 214), (-24, 240), (24, 240), (-14, 60), (14, 60)]):
    ops += banner(f"Banner {k+1}", x, 48 if k < 4 else 36 if k < 6 else 74, z, 18 if k < 6 else 12)
for k, (y, z, r) in enumerate([(48, 222, 7), (36, 250, 7), (36, 280, 7), (28, 312, 7), (18, 348, 6), (18, 378, 6)]):
    ops += turret(f"Turm oben {k+1}", 0, y, z, r)
for k, z in enumerate([140, 200, 270]):
    ops += turret(f"Turm Flanke L{k+1}", -26, 22 if z < 250 else 18, z, 4) + turret(f"Turm Flanke R{k+1}", 26, 22 if z < 250 else 18, z, 4)
ops += turret("Turm unten", 0, -30, 300, 6, down=True)
# Adler-Galion auf dem Bug
ops += [
    box("Adlersockel", [-9, 16, 398], [18, 8, 18], frame("trim", "metal_dark", "xz")),
    ell("Adlerleib", [0, 34, 408], [7, 12, 7], shade("trim", 0.85)),
    ell("Adlerbrust", [0, 31, 413], [5, 8, 3], "trim"),
    ell("Adlerkopf", [0, 50, 413], [4.5, 5, 5.5], "trim"),
    box("Adlerschnabel", [-1, 46, 418], [2, 4, 4], shade("trim", 0.65)),
    box("Adlerauge", [3, 51, 415], [1, 1, 1], "dark", mirror="x", mirrorAt=0),
    group("Adlerschwinge", [
        box("Schwingenbogen", ["5 + i*4", "34 + i*3", "406 - i"], [4, 8, 7], shade("trim", 0.85), repeat=rep(7)),
        box("Schwungfeder", ["9 + i*4", "28 + i*3", "404 - i"], [4, 7, 5], stripes(["trim", shade("trim", 0.7)], "y", 2), repeat=rep(6)),
    ], mirror="x", mirrorAt=0),
    box("Fänge", [-5, 22, 404], [10, 3, 8], shade("trim", 0.6)),
    # Antrieb
    box("Antriebsjoch", [-34, -28, -16], [68, 56, 16], frame("trim", "metal_dark", "xy")),
] + engine("Triebwerk L", -17, -2, -76, 76, 17, "trim", glow("glow", 2.8), rings=5) \
  + engine("Triebwerk R", 17, -2, -76, 76, 17, "trim", glow("glow", 2.8), rings=5) \
  + engine("Triebwerk oben", 0, 26, -56, 56, 9, "trim", glow("glow", 2.6), rings=3)
save("schiff/fregatte/rom", "Quinquereme – römisches Schlachtschiff (4. Fassung)", "rom_schiff", ["schiff", "fregatte", "rom", "rohmodell"], [20, 130], ops, [0, 0, 180])

# =============================================================================================
# ÄGYPTEN
# =============================================================================================
ops = [
    loft("Achterschiff", [S(0, 64, 28, 26, 8), S(96, 64, 28, 26, 8)], "stone"),
    loft("Goldring 1", [S(96, 66, 30, 28, 9, rnd=0.4), S(102, 66, 30, 28, 9, rnd=0.4)], "trim"),
    loft("Mittschiff", [S(102, 58, 26, 24, 0, rnd=0.55), S(236, 58, 26, 24, 0, rnd=0.55)], "stone"),
    loft("Goldring 2", [S(236, 61, 28, 26, 0, rnd=0.55), S(242, 61, 28, 26, 0, rnd=0.55)], "trim"),
    loft("Vorschiff", [S(242, 54, 24, 22, 0, rnd=0.55), S(340, 54, 24, 22, 0, rnd=0.55)], "stone"),
    loft("Goldring 3", [S(340, 57, 26, 24, 0, rnd=0.55), S(346, 57, 26, 24, 0, rnd=0.55)], "trim"),
    loft("Hals", [S(346, 50, 22, 20, 0, rnd=0.6), S(372, 40, 18, 16, 0, rnd=0.6)], "stone"),
    box("Rippen", [-40, -30, 102], [80, 60, 2], shade("stone", 0.86), mode="paint", repeat=rep(40, (0, 0, 6))),
    box("Hieroglyphenband oben", [-40, 10, 0], [80, 3, 372], "trim", mode="paint"),
    box("Hieroglyphen", [-40, 11, 4], [80, 1, 2], "dark", mode="paint", repeat=rep(90, (0, 0, 4))),
    box("Hieroglyphenband unten", [-40, -12, 0], [80, 3, 372], "trim", mode="paint"),
    box("Hieroglyphen unten", [-40, -11, 6], [80, 1, 1], "dark", mode="paint", repeat=rep(90, (0, 0, 4))),
    box("Namenstafel KEMETS ZORN", [-40, -4, 262], [80, 10, 60], frame("trim", "secondary", "yz"), mode="paint"),
    box("Namensschrift", [-40, 0, 268], [80, 2, 3], "trim", mode="paint", repeat=rep(12, (0, 0, 4))),
    box("Paneele", [-40, -8, "16 + i*30"], [80, 14, 22], frame("trim", "primary", "yz"), mode="paint", repeat=rep(3)),
    windows("Fensterreihe", 34, 4, 104, 340, 5, col=glow("glow2", 1.1), w=3),
    windows("Fensterreihe 2", 34, -4, 106, 236, 7, col=glow("glow2", 1.0), w=3),
    windows("Fensterreihe achtern", 34, 6, 6, 96, 6, col=glow("glow2", 1.0), w=3),
    box("Türkislinie", [-40, 14, 0], [80, 1, 372], glow("glow", 1.3), mode="paint", jitter=False),
    ports("Breitseite", 29, -6, 110, 236, 12, length=6),
    # Pharaonenmaske als Bug (verkleinert)
    loft("Nemes-Kopftuch", [S(364, 44, 26, 16, 0, y=4, rnd=0.45), S(386, 40, 24, 14, 0, y=4, rnd=0.45), S(400, 32, 22, 10, 0, y=5, rnd=0.5)], stripes(["trim", "secondary"], "y", 3)),
    box("Kopftuch Laschen", [14, -18, 388], [6, 22, 9], stripes(["trim", "secondary"], "y", 3), mirror="x", mirrorAt=0),
    box("Stirnband", [-13, 18, 394], [26, 2, 9], "trim"),
    ell("Gesicht", [0, 7, 402], [10, 13, 7], "trim"),
    ell("Wangen", [0, 2, 404], [9, 7, 6], shade("trim", 0.9)),
    box("Augenbraue", [2, 13, 408], [6, 1, 2], "secondary", mirror="x", mirrorAt=0),
    box("Auge", [2, 9, 408], [5, 2, 2], "white", mirror="x", mirrorAt=0),
    box("Iris", [4, 9, 410], [2, 2, 1], {"role": "water", "emit": 1.6}, jitter=False, mirror="x", mirrorAt=0),
    box("Lidstrich", [1, 11, 410], [7, 1, 1], "secondary", mirror="x", mirrorAt=0),
    box("Lidschwung", [8, 10, 409], [2, 1, 1], "secondary", mirror="x", mirrorAt=0),
    box("Nase", [-1, 2, 409], [2, 6, 2], shade("trim", 0.8)),
    box("Mund", [-3, -4, 409], [6, 1, 1], shade("trim", 0.55)),
    box("Zeremonialbart", [-2, -20, 401], [4, 12, 4], stripes(["trim", "secondary"], "y", 2)),
    box("Uräus", [-2, 20, 402], [4, 6, 3], "trim"),
    box("Uräus Kopf", [-2, 25, 404], [4, 2, 3], "trim"),
    box("Uräus Augen", [-2, 26, 407], [4, 1, 1], glow("glow", 2.0), jitter=False),
    # Pyramide mittschiffs
    box("Pyramidensockel", [-38, 24, 118], [76, 6, 84], frame("trim", "primary", "xz")),
] + stepped_pyramid("Pyramide", 0, 30, 160, 70, 32, stripes(["stone", "stone", shade("stone", 0.85)], "y", 3), glow("glow", 1.1), glow("glow", 1.0), band_every=8) + [
    box("Pyramiden-Goldkappe", [-3, 94, 157], [6, 4, 6], "trim"),
    box("Pyramidion", [-2, 98, 158], [4, 3, 4], glow("glow2", 2.6), jitter=False),
    box("Pyramiden-Eingang", [-6, 30, 194], [12, 14, 2], frame("glow", "dark", "xy")),
    # Turm und Antennen achtern
    box("Achterturm", [-18, 28, 30], [36, 22, 56], frame("trim", "stone", "y")),
    windows("Achterturm Fenster", 17, 40, 32, 86, 4, col=glow("glow2", 1.1)),
    box("Achterturm oben", [-11, 50, 44], [22, 14, 30], shade("stone", 0.85)),
    ell("Kuppel", [-6, 64, 52], [5, 5, 5], "metal_light"),
    cyl("Schüssel", [8, 66, 66], 7, 1, "metal_light"),
    line("Schüsselfuß", [8, 64, 66], [8, 58, 66], 1, "metal"),
    line("Mast", [0, 64, 60], [0, 96, 60], 1, "metal"),
    line("Antenne 2", [4, 64, 58], [6, 84, 56], 0.7, "metal_light"),
    line("Antenne 3", [-4, 64, 62], [-6, 80, 64], 0.7, "metal_light"),
    box("Mastlicht", [-1, 96, 59], [2, 2, 2], glow("glow", 2.0), jitter=False),
    # Antrieb: vier blaue Rundtriebwerke in kantigen Gehäusen
    box("Triebwerksgehäuse", [-38, -30, -24], [76, 60, 26], frame("trim", "stone", "xy")),
]
for k, z in enumerate([258, 290, 322]):
    ops += turret(f"Turm oben {k+1}", 0, 24, z, 6, col="stone")
for k, z in enumerate([110, 210]):
    ops += turret(f"Turm Flanke L{k+1}", -24, 22, z, 4, col="stone") + turret(f"Turm Flanke R{k+1}", 24, 22, z, 4, col="stone")
ops += turret("Turm unten", 0, -24, 280, 5, down=True)
for k, (x, y) in enumerate([(-18, 14), (18, 14), (-18, -14), (18, -14)]):
    ops += engine(f"Triebwerk {k+1}", x, y, -60, 40, 11, "trim", {"role": "water", "emit": 2.8}, rings=3)
save("schiff/fregatte/aegypten", "Mandjet – ägyptisches Schlachtschiff (4. Fassung)", "aegypten", ["schiff", "fregatte", "aegypten", "rohmodell"], [20, 130], ops, [0, 0, 180])

# =============================================================================================
# HIMMELSREICH
# =============================================================================================
WOOD = stripes(["wood", shade("wood", 0.88)], "z", 3)
ops = [
    loft("Triebwerksblock", [S(0, 52, 24, 24, 5), S(60, 52, 24, 24, 5)], WOOD),
]
segs = [(66, 150), (156, 240), (246, 320)]
for k, (z0, z1) in enumerate(segs):
    ops += [loft(f"Glied {k+1}", [S(z0, 48, 20, 22, 4), S(z1, 48, 20, 22, 4)], WOOD),
            loft(f"Goldrahmen {k+1}", [S(z0 - 6, 52, 22, 24, 5), S(z0, 52, 22, 24, 5)], "trim"),
            box(f"Glied {k+1} Paneel", [-30, -14, z0 + 6], [60, 26, z1 - z0 - 12], frame("trim", "wood_dark", "yz"), mode="paint"),
            box(f"Glied {k+1} Dachleiste", [-20, 20, z0 + 2], [40, 2, z1 - z0 - 4], frame("trim", "secondary", "xz")),
            windows(f"Glied {k+1} Fenster", 26, 14, z0 + 6, z1 - 6, 8, col={"role": "water", "emit": 1.2}, w=4)]
ops += [
    # Drachenranken (Gold) auf Glied 2, Ladeluke auf Glied 1, Phönix auf Glied 3
    box("Drachenranke", [-30, "-6 + (i % 3)*3", "166 + i*6"], [60, 2, 4], "trim", mode="paint", repeat=rep(12)),
    box("Drachenranke 2", [-30, "4 - (i % 3)*3", "169 + i*6"], [60, 2, 3], "trim", mode="paint", repeat=rep(12)),
    box("Ladeluke", [-30, -10, 80], [60, 18, 40], frame("trim", "dark", "yz"), mode="paint"),
    box("Ladeluke Streben", [-30, -10, 86], [60, 18, 2], "metal_dark", mode="paint", repeat=rep(5, (0, 0, 7))),
    box("Phönix Leib", [-30, -6, 278], [60, 10, 8], "trim", mode="paint"),
    box("Phönix Schwinge", [-30, "-4 + i*2", "268 - i*2"], [60, 2, "6 + i"], "trim", mode="paint", repeat=rep(6)),
    box("Phönix Schwinge vorn", [-30, "-4 + i*2", "286 + i*2"], [60, 2, "6 + i"], "trim", mode="paint", repeat=rep(6)),
    box("Phönix Schweif", [-30, "-8 - i", "272 - i*3"], [60, 1, 4], "trim", mode="paint", repeat=rep(5)),
    # Bugblock mit Palast
    loft("Bugblock", [S(320, 58, 26, 26, 4), S(400, 58, 26, 26, 4), S(418, 52, 22, 18, 8)], WOOD),
    loft("Goldrahmen Bug", [S(314, 62, 28, 28, 5), S(320, 62, 28, 28, 5)], "trim"),
    box("Bildfeld", [-32, -14, 340], [64, 26, 62], frame("trim", "cloth2", "yz"), mode="paint"),
    box("Kalligrafietafel", [-32, 14, 344], [64, 9, 54], frame("trim", "secondary", "yz"), mode="paint"),
    box("Schriftzeichen", [-32, 16, "350 + i*12"], [64, 5, 6], "trim", mode="paint", repeat=rep(4)),
    box("Unterschrifttafel", [-32, -24, 352], [64, 7, 40], frame("trim", "secondary", "yz"), mode="paint"),
    box("Rote Siegel", [-32, -11, 395], [64, 4, 4], "warning", mode="paint"),
    box("Drachenrelief Bugecke", [-32, -12, 404], [64, 28, 12], frame("trim", "wood_dark", "yz"), mode="paint"),
    box("Drachenrelief Windung", [-32, "-8 + (i % 2)*8", "406 + i*2"], [64, 6, 2], "trim", mode="paint", repeat=rep(4)),
]
# Gelehrte im Bildfeld (beide Seiten gleich)
for k, (colr, colb) in enumerate([("secondary", "cloth"), ("warning", "secondary"), ("water", "cloth2"), ("secondary", "cloth")]):
    z = 348 + k * 13
    ops += [box(f"Gelehrter {k+1} Gewand", [-33, -10, z], [66, 14, 6], colr, mode="paint"),
            box(f"Gelehrter {k+1} Ärmel", [-33, -2, z - 1], [66, 3, 8], colb, mode="paint"),
            box(f"Gelehrter {k+1} Kopf", [-33, 5, z + 1], [66, 3, 4], "skin", mode="paint"),
            box(f"Gelehrter {k+1} Hut", [-33, 8, z + 1], [66, 2, 4], "secondary", mode="paint")]
ops += [
    ell("Drachenkopf Relief", [0, 2, 418], [12, 12, 5], "trim"),
    box("Drachenkopf Maul", [-6, -6, 421], [12, 4, 3], "dark"),
    box("Drachenkopf Zähne", [-5, -6, 423], [1, 2, 1], "white", repeat=rep(5, (2, 0, 0))),
    box("Drachenkopf Augen", [3, 6, 422], [3, 2, 2], {"role": "warning", "emit": 2.2}, jitter=False, mirror="x", mirrorAt=0),
    line("Drachenkopf Horn", [6, 10, 420], [14, 22, 416], 1.4, "trim", mirror="x", mirrorAt=0),
    line("Drachenkopf Bart", [6, -2, 422], [18, -10, 420], 0.8, "trim", mirror="x", mirrorAt=0),
    ell("Eckdrache", [28, 10, 412], [4, 6, 6], "trim", mirror="x", mirrorAt=0),
    box("Eckdrache Auge", [31, 12, 416], [1, 1, 1], {"role": "warning", "emit": 2.0}, jitter=False, mirror="x", mirrorAt=0),
    line("Bugkanone", [12, -24, 400], [12, -24, 452], 1.6, "metal_dark", mirror="x", mirrorAt=0),
    line("Bugkanone 2", [22, -20, 396], [22, -20, 440], 1.4, "metal_dark", mirror="x", mirrorAt=0),
    # Palast: drei Stockwerke mit geschwungenen Traufen
    box("Palastterrasse", [-26, 26, 328], [52, 3, 84], frame("trim", "stone", "xz")),
    box("Halle 1", [-20, 29, 338], [40, 14, 62], frame("trim", "wood", "y")),
    box("Halle 1 Säulen", [-20, 29, "340 + i*8"], [40, 14, 2], "primary", mode="paint", repeat=rep(8)),
    box("Halle 1 Fenster", [-21, 34, "343 + i*8"], [42, 5, 4], frame("trim", "cloth2", "xy"), mode="paint", repeat=rep(7)),
    box("Traufe 1", [-28, 43, 330], [56, 3, 78], frame("trim", "secondary", "xz")),
    wedge("Dach 1", [-24, 46, 334], [48, 8, 70], stripes(["secondary", shade("secondary", 1.4)], "z", 2), gable="x"),
    box("Traufecke 1", [-30, 45, 328], [3, 4, 3], "trim", mirror="xz", mirrorAt={"x": 0, "z": 369}),
    box("Halle 2", [-13, 53, 350], [26, 10, 38], frame("trim", "wood", "y")),
    box("Halle 2 Fenster", [-14, 56, "353 + i*8"], [28, 4, 4], frame("trim", "cloth2", "xy"), mode="paint", repeat=rep(4)),
    box("Traufe 2", [-20, 63, 343], [40, 3, 52], frame("trim", "secondary", "xz")),
    wedge("Dach 2", [-16, 66, 347], [32, 7, 44], stripes(["secondary", shade("secondary", 1.4)], "z", 2), gable="x"),
    box("Traufecke 2", [-22, 65, 341], [3, 4, 3], "trim", mirror="xz", mirrorAt={"x": 0, "z": 369}),
    box("Halle 3", [-8, 72, 358], [16, 8, 22], frame("trim", "wood", "y")),
    box("Traufe 3", [-13, 80, 353], [26, 2, 32], frame("trim", "secondary", "xz")),
    wedge("Dach 3", [-10, 82, 356], [20, 7, 26], stripes(["secondary", shade("secondary", 1.4)], "z", 2), gable="x"),
    box("Traufecke 3", [-15, 81, 351], [3, 4, 3], "trim", mirror="xz", mirrorAt={"x": 0, "z": 369}),
    box("Firstdrachen", [-1, 88, 356], [2, 3, 26], "trim"),
    box("Firstfigur", [-1, 88, 355], [2, 5, 2], "trim", mirror="z", mirrorAt=369),
    # Pagode achtern (schlank, sieben Stockwerke)
]
for s_ in range(7):
    h = 10 - s_
    y = 24 + s_ * 9
    ops += [box(f"Pagode Stock {s_+1}", [-h, y, 40 - h], [2 * h, 7, 2 * h], frame("trim", "wood", "y")),
            box(f"Pagode Fenster {s_+1}", [-h - 1, y + 3, 40 - h + 2], [2 * h + 2, 2, 2 * h - 4], {"role": "water", "emit": 1.0}, mode="paint", jitter=False),
            box(f"Pagode Traufe {s_+1}", [-h - 4, y + 7, 36 - h], [2 * h + 8, 2, 2 * h + 8], frame("trim", "secondary", "xz")),
            box(f"Pagode Ecke {s_+1}", [-h - 5, y + 8, 35 - h], [2, 3, 2], "trim", mirror="xz", mirrorAt={"x": 0, "z": 40})]
ops += [line("Pagodenspitze", [0, 87, 40], [0, 104, 40], 1, "trim"),
        box("Pagodenringe", [-2, "90 + i*4", 39], [4, 1, 2], "trim", repeat=rep(3)),
        box("Pagodenperle", [-1, 104, 39], [2, 3, 2], glow("glow", 2.4), jitter=False)]
for k, (x, z) in enumerate([(-16, 80), (16, 80)]):
    ops += [line(f"Fahnenstange {k+1}", [x, 24, z], [x, 62, z], 0.9, "metal_light"),
            box(f"Fahne {k+1}", [x, 50, z + 1], [1, 10, 12], frame("trim", "water", "yz")),
            box(f"Fahne {k+1} Zipfel", [x, 52, z + 13], [1, 6, 4], "trim")]
for k, z in enumerate([110, 190, 220, 280, 305]):
    ops += turret(f"Turm oben {k+1}", 0 if k % 2 == 0 else (-12 if k == 1 else 12), 20, z, 6 if k % 2 == 0 else 5, col="trim")
ops += turret("Turm unten 1", 0, -22, 200, 5, down=True, col="trim")
ops += [line("Kielantenne", [0, -24, 40], [0, -40, 38], 1, "trim"), box("Kielantenne Licht", [-1, -42, 37], [2, 2, 2], {"role": "water", "emit": 2.0}, jitter=False)]
# Antrieb: zwei große blaue Rundtriebwerke übereinander + Seitendüsen
ops += [box("Antriebsjoch", [-26, -34, -8], [52, 68, 10], frame("trim", "wood_dark", "xy"))]
ops += engine("Triebwerk oben", 0, 15, -70, 66, 16, "trim", {"role": "water", "emit": 2.8}, case="water", rings=4) \
     + engine("Triebwerk unten", 0, -17, -70, 66, 16, "trim", {"role": "water", "emit": 2.8}, case="water", rings=4) \
     + engine("Seitendüse L", -30, 0, -40, 40, 7, "trim", {"role": "water", "emit": 2.6}, case="metal", rings=2) \
     + engine("Seitendüse R", 30, 0, -40, 40, 7, "trim", {"role": "water", "emit": 2.6}, case="metal", rings=2)
save("schiff/fregatte/himmelsreich", "Louchuan – Palastschiff des Himmelsreichs (4. Fassung)", "himmelsreich", ["schiff", "fregatte", "himmelsreich", "rohmodell"], [20, 125], ops, [0, 0, 180])
# =============================================================================================
# GERMANEN – Wolfskopf am Bug, Knotenwerk und Runen, gestufter Kommandoturm, Sichelklingen achtern
# =============================================================================================
KNOT = frame("metal_light", {"checker": ["primary", shade("primary", 1.18)], "period": 1}, "yz")
ops = [
    loft("Achterschiff", [S(0, 56, 24, 22, 6), S(92, 56, 24, 22, 6)], "primary"),
    loft("Spant 1", [S(92, 60, 26, 24, 7), S(98, 60, 26, 24, 7)], "metal_dark"),
    loft("Mittschiff", [S(98, 52, 22, 22, 6), S(262, 52, 22, 22, 6)], "primary"),
    loft("Spant 2", [S(262, 56, 24, 24, 7), S(268, 56, 24, 24, 7)], "metal_dark"),
    loft("Vorschiff", [S(268, 48, 20, 22, 6), S(334, 46, 20, 24, 6)], "primary"),
    loft("Bugblock", [S(334, 44, 22, 26, 6), S(364, 40, 22, 28, 6)], "secondary"),
    loft("Bugklinge", [S(340, 10, 6, 10, 2, y=-22), S(372, 6, 4, 8, 1, y=-34), S(404, 2, 1, 3, 0, y=-46)], "metal_light"),
    loft("Kielklinge", [S(120, 6, 0, 16, 1, y=-20), S(300, 6, 0, 12, 1, y=-20)], "metal"),
    box("Knotenwerk Achtern", [-36, -14, 14], [72, 26, 66], KNOT, mode="paint"),
    box("Knotenwerk Mitte", [-36, -16, 112], [72, 14, 66], KNOT, mode="paint"),
    box("Knotenwerk Vorn", [-36, -14, 276], [72, 26, 52], KNOT, mode="paint"),
    box("Knotenwerk Bug", [-36, -20, 338], [72, 34, 22], KNOT, mode="paint"),
    box("Runen Bug", [-36, "-12 + i*8", 341], [72, 2, 2], glow("glow2", 1.6), mode="paint", jitter=False, repeat=rep(3)),
    box("Runen Bug 2", [-36, "-10 + i*8", 346], [72, 2, 1], glow("glow2", 1.6), mode="paint", jitter=False, repeat=rep(3)),
    box("Runen Bug 3", [-36, "-12 + i*8", 351], [72, 3, 1], glow("glow2", 1.6), mode="paint", jitter=False, repeat=rep(3)),
    box("Flottentafel", [-36, 4, 284], [72, 8, 40], frame("trim", "metal_dark", "yz"), mode="paint"),
    box("Flottenschrift", [-36, 6, 288], [72, 3, 2], glow("glow2", 1.4), mode="paint", jitter=False, repeat=rep(8, (0, 0, 4))),
    box("Runenband", [-36, 14, 6], [72, 1, 2], glow("glow2", 1.3), mode="paint", jitter=False, repeat=rep(40, (0, 0, 8))),
    box("Lichtpforten", [-36, 2, 196], [72, 3, 3], glow("glow2", 2.4), mode="paint", jitter=False, repeat=rep(5, (0, 0, 9))),
    slats("Geschützdeck", 26, -6, 120, 250, 4, col="metal_dark"),
    ports("Breitseite", 26, -12, 124, 250, 12, length=8),
    windows("Fensterreihe", 30, 10, 100, 260, 6, col=glow("glow2", 1.0)),
    line("Bugkanone", [-14, -12, 360], [-14, -12, 400], 1.6, "metal_dark", mirror="x", mirrorAt=0),
    # Wolfskopf (klein, sitzt vorn auf dem Bugblock)
    loft("Wolfsschädel", [S(354, 20, 14, 6, 4, y=18), S(370, 18, 13, 5, 4, y=19), S(380, 13, 9, 4, 3, y=19)], "metal_light"),
    loft("Schnauze", [S(377, 12, 5, 3, 2, y=17), S(396, 8, 4, 2, 1, y=16)], "metal_light"),
    loft("Unterkiefer", [S(374, 11, 2, 4, 1, y=10), S(394, 7, 1, 3, 1, y=8)], "metal"),
    box("Rachen", [-5, 9, 378], [10, 7, 16], {"role": "glow2", "emit": 0.8}, jitter=False),
    box("Fänge oben", [-5, 12, "381 + i*4"], [1, 3, 1], "trim", repeat=rep(3), mirror="x", mirrorAt=0),
    box("Fänge unten", [-4, 9, "380 + i*4"], [1, 3, 1], "trim", repeat=rep(3), mirror="x", mirrorAt=0),
    box("Nase", [-2, 20, 394], [4, 2, 2], "metal_dark"),
    box("Augen", [6, 24, 376], [2, 2, 3], glow("glow2", 3.0), jitter=False, mirror="x", mirrorAt=0),
    box("Brauenwulst", [4, 26, 373], [6, 2, 6], "metal", mirror="x", mirrorAt=0),
    line("Ohr", [7, 30, 364], [10, 42, 356], 2.2, "metal_light", mirror="x", mirrorAt=0),
] + [line(f"Nackenfell {k+1}", [9, 26 - k * 5, 358], [16 + k, 30 - k * 6, 346 - k * 2], 1.8 - k * 0.2, "metal_light" if k % 2 == 0 else "metal", mirror="x", mirrorAt=0) for k in range(3)] + [
    # Kommandoturm, gestuft
    box("Turmstufe 1", [-18, 22, 146], [36, 18, 56], frame("metal_dark", "secondary", "y")),
    box("Turmstufe 2", [-13, 40, 152], [26, 18, 42], frame("metal_dark", "secondary", "y")),
    box("Turmstufe 3", [-9, 58, 158], [18, 14, 28], frame("metal_dark", "primary", "y")),
    box("Turmkrone", [-6, 72, 162], [12, 8, 18], "metal_dark"),
    box("Turmfenster", [-14, 52, 152], [28, 2, 42], glow("glow2", 1.2), mode="paint", jitter=False),
    box("Turmtafel", [-19, 30, 160], [38, 6, 30], frame("trim", "metal_dark", "yz"), mode="paint"),
    box("Turmtafelschrift", [-19, 32, 164], [38, 2, 2], glow("glow2", 1.4), mode="paint", jitter=False, repeat=rep(6, (0, 0, 4))),
    line("Mast", [0, 80, 170], [0, 104, 170], 1.2, "metal"),
    line("Antenne", [5, 80, 164], [6, 94, 160], 0.7, "metal_light"),
]
# Valknut an der Turmfront: drei verschränkte Dreiecke
for k, (dx, dy) in enumerate([(-3, 0), (3, 0), (0, 5)]):
    ax, ay, bx, by, cx_, cy_ = -5 + dx, 44 + dy, 5 + dx, 44 + dy, 0 + dx, 53 + dy
    ops += [line(f"Valknut {k+1} a", [ax, ay, 195], [bx, by, 195], 0.6, glow("glow2", 2.2), jitter=False),
            line(f"Valknut {k+1} b", [bx, by, 195], [cx_, cy_, 195], 0.6, glow("glow2", 2.2), jitter=False),
            line(f"Valknut {k+1} c", [cx_, cy_, 195], [ax, ay, 195], 0.6, glow("glow2", 2.2), jitter=False)]
for k, (y, z, r) in enumerate([(40, 206, 6), (22, 222, 6), (22, 250, 6), (20, 290, 6), (20, 318, 5), (22, 120, 6), (22, 96, 5)]):
    ops += turret(f"Turm {k+1}", 0, y, z, r, col="secondary")
for k, z in enumerate([130, 230]):
    ops += turret(f"Turm Flanke L{k+1}", -20, 22, z, 4, col="secondary") + turret(f"Turm Flanke R{k+1}", 20, 22, z, 4, col="secondary")
# Tragflächen (massiv, nach außen abfallend, Waffen an Spitze und Unterseite) – Vorbild Negh'Var
wing = []
for k in range(40):
    x = 24 + k * 2
    y = -2 - round(k * 0.9)
    lead = 200 - k * 2          # Vorderkante gepfeilt
    trail = 20 + k              # Hinterkante
    thick = 10 - k // 8
    wing += [box(f"Fläche {k+1}", [x, y, trail], [2, thick, lead - trail], "primary"),
             box(f"Fläche {k+1} Vorderkante", [x, y, lead - 4], [2, thick, 4], "metal_light"),
             box(f"Fläche {k+1} Hinterkante", [x, y, trail], [2, thick, 3], "metal_dark")]
wing += [line("Holm", [26, 9, 120], [100, -26, 90], 2.2, "secondary"),
         line("Holm 2", [26, 7, 170], [100, -28, 120], 1.6, "secondary"),
         box("Plattenfugen", [24, -50, "50 + i*22"], [82, 60, 1], "metal_dark", mode="paint", repeat=rep(7))]
wing += [
        box("Runenband Fläche", [24, -50, 160], [80, 60, 2], glow("glow2", 1.4), mode="paint", jitter=False),
    box("Fläche Rotfeld", [70, -50, 96], [22, 60, 20], "cloth", mode="paint"),
    # Waffengondel an der Spitze
    cyl("Spitzengondel", [106, -32, 30], 8, 130, "metal", axis="z"),
    cyl("Spitzengondel Ringe", [106, -32, 50], 9, 3, "metal_dark", axis="z", repeat=rep(5, (0, 0, 22))),
    cyl("Spitzengondel Bug", [106, -32, 160], 8, 14, "metal_dark", axis="z", r2=4),
    line("Disruptor", [106, -32, 172], [106, -32, 210], 2.4, "metal_dark"),
    box("Disruptor Mündung", [103, -35, 208], [6, 6, 4], glow("glow2", 2.6), jitter=False),
    cyl("Spitzengondel Glut", [106, -32, 29], 5, 1, glow("glow2", 2.6), axis="z", jitter=False),
    # Unterflügel-Geschütze
    box("Pylon", [62, -26, 120], [6, 8, 30], "metal_dark"),
    cyl("Unterflügelkanone", [65, -30, 100], 4, 60, "metal", axis="z"),
    line("Unterflügelrohr", [65, -30, 160], [65, -30, 190], 1.6, "metal_dark"),
    box("Pylon 2", [86, -36, 90], [6, 8, 26], "metal_dark"),
    line("Torpedorohr", [89, -40, 80], [89, -40, 150], 2.5, "metal"),
]
ops += [group("Tragfläche", wing, mirror="x", mirrorAt=0)]
ops += [box("Antriebsjoch", [-30, -24, -12], [60, 48, 12], frame("metal_light", "metal_dark", "xy"))]
ops += engine("Haupttriebwerk", 0, 4, -56, 56, 13, "metal_light", glow("glow2", 2.8), rings=4) \
     + engine("Triebwerk L", -20, -10, -44, 44, 8, "metal_light", glow("glow2", 2.6), rings=3) \
     + engine("Triebwerk R", 20, -10, -44, 44, 8, "metal_light", glow("glow2", 2.6), rings=3)
save("schiff/fregatte/nord", "Wolfsschiff der Germanen (4. Fassung)", "nord", ["schiff", "fregatte", "nord", "rohmodell"], [45, 125], ops, [0, 0, 180])

# =============================================================================================
# BABYLON – Steinblock mit Bronzereliefs, Zinnen, Zikkurat, geflügelter Löwe achtern
# =============================================================================================
def crenels(n, x0, x1, y, z0, z1, step=4):
    return [box(f"{n} links", [x0, y, z0], [3, 3, 2], "stone", repeat=rep((z1 - z0) // step, (0, 0, step))),
            box(f"{n} rechts", [x1 - 3, y, z0], [3, 3, 2], "stone", repeat=rep((z1 - z0) // step, (0, 0, step)))]
RELIEF = frame("trim", "stone", "yz")
ops = [
    loft("Heckblock", [S(0, 58, 24, 26, 3), S(110, 58, 24, 26, 3)], "stone_dark"),
    loft("Mittelblock", [S(110, 56, 24, 26, 3), S(300, 56, 24, 26, 3)], "stone"),
    loft("Bugblock", [S(300, 62, 30, 30, 3), S(372, 62, 30, 30, 3), S(380, 56, 26, 26, 4)], "stone"),
    box("Bugfuß", [18, -46, 330], [12, 16, 46], "stone_dark", mirror="x", mirrorAt=0),
    box("Bugfuß Stufe", [16, -50, 336], [16, 4, 44], "stone_dark", mirror="x", mirrorAt=0),
    box("Kiel", [-16, -36, 60], [32, 10, 240], frame("stone_light", "stone_dark", "xz")),
    box("Kielstreben", [-18, -36, "70 + i*24"], [36, 10, 4], "stone_dark", repeat=rep(10)),
    box("Kante oben", [-34, 23, 0], [68, 1, 400], "stone_light", mode="paint"),
] + crenels("Zinnen Mitte", -28, 28, 24, 110, 300) + crenels("Zinnen Bug", -31, 31, 30, 302, 372) + crenels("Zinnen Heck", -29, 29, 24, 2, 108) + [
    # Bugblock: Reliefs, Sonnenscheibe, Tafel
    box("Bug-Relieffeld", [-36, -22, 304], [72, 48, 64], RELIEF, mode="paint"),
    box("Figurenrelief", [-36, -2, "310 + i*7"], [72, 20, 4], "trim", mode="paint", repeat=rep(3)),
    box("Figurenköpfe", [-36, 18, "310 + i*7"], [72, 3, 3], "trim", mode="paint", repeat=rep(3)),
    box("Namenstafel", [-36, -6, 334], [72, 14, 30], frame("trim", "stone_dark", "yz"), mode="paint"),
    box("Keilschrift", [-36, -2, "338 + i*4"], [72, 4, 2], "trim", mode="paint", repeat=rep(6)),
    box("Sonnenscheibe Flanke", [-36, 14, 344], [72, 5, 6], "trim", mode="paint"),
    box("Sonnenflügel Flanke", [-36, 15, 334], [72, 2, 26], "trim", mode="paint"),
    box("Unterfries", [-36, -28, 300], [72, 6, 76], frame("trim", "stone_dark", "yz"), mode="paint"),
    box("Frieszeichen", [-36, -27, "304 + i*6"], [72, 4, 2], "trim", mode="paint", repeat=rep(12)),
    ell("Sonnenscheibe Bug", [0, 12, 380], [6, 6, 2], "trim"),
    box("Sonnenflügel Bug", [6, "10 + i*2", 380], ["16 - i*3", 2, 2], "trim", repeat=rep(4), mirror="x", mirrorAt=0),
    box("Bugtafel", [-18, -14, 380], [36, 14, 2], frame("trim", "stone_dark", "xy")),
    box("Bugtafel Schrift", [-14, "-11 + i*4", 382], [28, 2, 1], "trim", repeat=rep(3)),
    # Lamassu-Relief an der Flanke
    box("Lamassu-Feld", [-36, -18, 222], [72, 42, 74], RELIEF, mode="paint"),
    box("Lamassu Leib", [-36, -4, 240], [72, 10, 32], "trim", mode="paint"),
    box("Lamassu Beine", [-36, -14, "242 + i*9"], [72, 10, 4], "trim", mode="paint", repeat=rep(4)),
    box("Lamassu Brust", [-36, -2, 268], [72, 14, 8], "trim", mode="paint"),
    box("Lamassu Kopf", [-36, 10, 270], [72, 8, 8], "trim", mode="paint"),
    box("Lamassu Krone", [-36, 17, 271], [72, 3, 6], shade("trim", 0.8), mode="paint"),
    box("Lamassu Bart", [-36, 4, 276], [72, 6, 3], shade("trim", 0.75), mode="paint"),
    box("Lamassu Schwinge", [-36, "6 + i*2", "262 - i*5"], [72, 2, "8 + i*3"], stripes(["trim", shade("trim", 0.8)], "z", 2), mode="paint", repeat=rep(7)),
    box("Lamassu Schweif", [-36, -2, 234], [72, 6, 4], "trim", mode="paint"),
    # Achterfeld mit Figuren
    box("Achter-Relieffeld", [-36, -16, 14], [72, 30, 86], RELIEF, mode="paint"),
    box("Achterfiguren", [-36, -10, "20 + i*10"], [72, 18, 4], "trim", mode="paint", repeat=rep(8)),
    box("Mittelfries", [-36, -24, 112], [72, 6, 108], frame("trim", "stone_dark", "yz"), mode="paint"),
    box("Mittelfries Zeichen", [-36, -23, "116 + i*6"], [72, 4, 2], "trim", mode="paint", repeat=rep(17)),
    windows("Schießscharten", 30, 16, 112, 296, 8, col="dark", w=2),
]
# Zikkurat
for k in range(6):
    w, d, y = 50 - 8 * k, 104 - 14 * k, 24 + 8 * k
    x0, z0 = -w // 2, 170 - d // 2
    ops += [box(f"Zikkurat Stufe {k+1}", [x0, y, z0], [w, 8, d], "stone"),
            box(f"Zikkurat Glasur {k+1}", [x0 - 1, y + 3, z0 - 1], [w + 2, 2, d + 2], "primary", mode="paint"),
            box(f"Zikkurat Zinnenkranz {k+1}", [x0, y + 7, z0], [w, 1, d], frame({"checker": ["stone_light", "stone_dark"], "period": 1}, "stone", "xz"), mode="paint"),
            box(f"Zikkurat Treppe {k+1}", [-4, y, z0 + d - 1], [8, 8, 3], stripes(["stone_light", "stone_dark"], "y", 1)),
            box(f"Zikkurat Tor {k+1}", [-3, y + 2, z0 + d], [6, 5, 1], "dark")]
ops += [box("Schrein", [-6, 72, 158], [12, 10, 20], frame("trim", "primary", "y")),
        box("Schreinkrone", [-7, 82, 157], [14, 2, 22], frame({"checker": ["stone_light", "stone_dark"], "period": 1}, "stone", "xz")),
        box("Löwenkopf-Relief", [-3, 74, 178], [6, 6, 1], "trim"),
        box("Seitentreppe", ["-25 + i*4", "24 + i*8", 160], [4, 8, 20], stripes(["stone_light", "stone_dark"], "y", 1), repeat=rep(5)),
        box("Seitentreppe rechts", ["21 - i*4", "24 + i*8", 160], [4, 8, 20], stripes(["stone_light", "stone_dark"], "y", 1), repeat=rep(5))]
# Sockel und geflügelter Löwe achtern
ops += [
    box("Löwensockel", [-24, 24, 22], [48, 10, 70], frame("trim", "stone", "y")),
    box("Löwensockel Stufe", [-20, 34, 28], [40, 5, 58], frame({"checker": ["stone_light", "stone_dark"], "period": 1}, "stone", "xz")),
    box("Löwenfries", [-25, 26, "26 + i*14"], [50, 6, 8], "trim", mode="paint", repeat=rep(5)),
    ell("Löwe Rumpf", [0, 46, 52], [9, 7, 18], "trim"),
    ell("Löwe Brust", [0, 48, 68], [9, 9, 7], "trim"),
    ell("Löwe Mähne", [0, 56, 72], [10, 10, 8], shade("trim", 0.8)),
    ell("Löwe Kopf", [0, 57, 79], [6, 6, 5], "trim"),
    box("Löwe Maul", [-3, 52, 83], [6, 3, 2], "dark"),
    box("Löwe Augen", [2, 59, 83], [2, 1, 1], "dark", mirror="x", mirrorAt=0),
    box("Löwe Vorderbeine", [4, 39, 64], [4, 8, 6], "trim", mirror="x", mirrorAt=0),
    box("Löwe Pranken", [4, 39, 69], [4, 2, 4], shade("trim", 0.8), mirror="x", mirrorAt=0),
    group("Löwe Schwinge", [box("Feder", ["6 + i*3", "52 + i*3", "60 - i*3"], [3, 6, "12 - i"], stripes(["trim", shade("trim", 0.75)], "y", 2), repeat=rep(7))], mirror="x", mirrorAt=0),
    line("Löwe Schweif", [0, 46, 34], [0, 54, 24], 1.2, "trim"),
]
for k, z in enumerate([316, 350]):
    ops += turret(f"Turm Bug {k+1}", 0, 30, z, 6, col="stone")
for k, z in enumerate([120, 230, 270]):
    ops += turret(f"Turm Flanke L{k+1}", -22, 24, z, 4, col="stone") + turret(f"Turm Flanke R{k+1}", 22, 24, z, 4, col="stone")
ops += [box("Antriebsjoch", [-26, -22, -10], [52, 44, 10], frame("trim", "stone_dark", "xy"))]
ops += engine("Triebwerk oben", 0, 10, -44, 44, 12, "stone_dark", glow("glow2", 2.2), case="metal_dark", rings=3) \
     + engine("Triebwerk unten", 0, -14, -44, 44, 12, "stone_dark", glow("glow2", 2.2), case="metal_dark", rings=3)
save("schiff/fregatte/babylon", "Tafelschiff – babylonisches Steinschiff (4. Fassung)", "babylon", ["schiff", "fregatte", "babylon", "rohmodell"], [20, 105], ops, [0, 0, 180])
print("ok")
