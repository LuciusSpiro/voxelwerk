# Schiffsklassen der fünf Völker in der Formensprache der Fregatten (4. Fassung): python tools/gen-klassen.py
#   Klassen: jaeger, spaeher, korvette, frachter, kreuzer, linienschiff (Fregatte: gen-fregatten-v4.py)
#   Je Volk ein Baukasten (Rumpf, Galionsfigur, Aufbauten, Triebwerke); die Klasse bestimmt Größe und Ausstattung.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schiffbau import *

# Maße in Voxeln (Architektur-Stufe, 4 Voxel = 1 m)
CLASSES = {
    "jaeger":       dict(L=56,   W=14,  H=8,   label="Jäger"),
    "spaeher":      dict(L=112,  W=18,  H=14,  label="Späher"),
    "korvette":     dict(L=220,  W=36,  H=24,  label="Korvette"),
    "frachter":     dict(L=360,  W=52,  H=34,  label="Frachter"),
    "kreuzer":      dict(L=680,  W=84,  H=54,  label="Kreuzer"),
    "linienschiff": dict(L=1120, W=150, H=90,  label="Linienschiff"),
}
NAMES = {
    "rom":          dict(jaeger="Sagitta", spaeher="Speculatoria", korvette="Liburna", frachter="Corbita", kreuzer="Deceris", linienschiff="Tessarakonteres"),
    "aegypten":     dict(jaeger="Ba", spaeher="Ibis", korvette="Barke", frachter="Nilbarke", kreuzer="Mesektet", linienschiff="Obelisk"),
    "babylon":      dict(jaeger="Lamassu-Drohne", spaeher="Kelek", korvette="Gufa", frachter="Quffa", kreuzer="Magur", linienschiff="Zikkurat"),
    "nord":         dict(jaeger="Rabe", spaeher="Snekkja", korvette="Karvi", frachter="Knarr", kreuzer="Skeid", linienschiff="Langhalle"),
    "himmelsreich": dict(jaeger="Terrakotta-Drohne", spaeher="Zouge", korvette="Doujian", frachter="Tributdschunke", kreuzer="Mengchong", linienschiff="Himmelstor"),
}
PALETTE = {"rom": "rom_schiff", "aegypten": "aegypten", "babylon": "babylon", "nord": "nord", "himmelsreich": "himmelsreich"}
BIG = ("kreuzer", "linienschiff")

def seg_hull(name, L, W, H, bev, col, z0=0, bow=0.9, bow_w=0.75, hol=0, rnd=0, y=0):
    """Rumpf mit verjüngtem Bug (bow = Anteil der Länge bis zum Bugansatz)."""
    zb = round(L * bow)
    secs = [S(z0, W, H // 2, H // 2, bev, y=y, rnd=rnd), S(zb, W, H // 2, H // 2, bev, y=y, rnd=rnd),
            S(L, round(W * bow_w), round(H * 0.42), round(H * 0.42), bev, y=y, rnd=rnd)]
    return loft(name, secs, col, **({"hollow": hol} if hol else {}))

def ring(name, z, W, H, bev, col, t=None, rnd=0):
    t = t or max(2, W // 14)
    return loft(name, [S(z, W + 4, H // 2 + 2, H // 2 + 2, bev + 1, rnd=rnd), S(z + t, W + 4, H // 2 + 2, H // 2 + 2, bev + 1, rnd=rnd)], col)

def hollow_of(cls): return 3 if cls in BIG else 0
def tr(W): return max(3, min(8, W // 10))          # Turmradius
def er(H): return max(3, round(H * 0.32))          # Triebwerksradius

# =============================================================================================
# ROM
# =============================================================================================
def eagle(n, z, y, s):
    """Adler mit erhobenen Schwingen auf Sockel; z = Brustlage, y = Sockeloberkante, s = Maßstab (Fregatte = 1)."""
    S_ = lambda v: max(1, round(v * s))
    return [box(f"{n} Sockel", [-S_(9), y - S_(8), z - S_(10)], [2 * S_(9), S_(8), S_(18)], frame("trim", "metal_dark", "xz")),
            ell(f"{n} Leib", [0, y + S_(10), z], [S_(7), S_(12), S_(7)], shade("trim", 0.85)),
            ell(f"{n} Brust", [0, y + S_(7), z + S_(5)], [S_(5), S_(8), S_(3)], "trim"),
            ell(f"{n} Kopf", [0, y + S_(26), z + S_(5)], [S_(4.5), S_(5), S_(5.5)], "trim"),
            box(f"{n} Schnabel", [-S_(1), y + S_(22), z + S_(10)], [2 * S_(1), S_(4), S_(4)], shade("trim", 0.65)),
            group(f"{n} Schwinge", [box("Bogen", [S_(5) + k * S_(4), y + S_(10) + k * S_(3), z - S_(2) - k], [S_(4), S_(8), S_(7)], shade("trim", 0.85)) for k in range(7)]
                  + [box("Feder", [S_(9) + k * S_(4), y + S_(4) + k * S_(3), z - S_(4) - k], [S_(4), S_(7), S_(5)], stripes(["trim", shade("trim", 0.7)], "y", 2)) for k in range(6)],
                  mirror="x", mirrorAt=0)]

def temple(n, zc, y, w, d):
    cols = max(4, d // 7)
    return [box(f"{n} Podium", [-w // 2, y, zc - d // 2], [w, 5, d], "secondary"),
            box(f"{n} Freitreppe", [-w // 3, y, zc + d // 2], [2 * (w // 3), 4, 3], "stone_light"),
            box(f"{n} Cella", [-w // 2 + 7, y + 5, zc - d // 2 + 10], [w - 14, 16, d - 22], "stone"),
            cyl(f"{n} Säulen links", [-w // 2 + 2.5, y + 5, zc - d // 2 + 4], 1.6, 16, "secondary", repeat=rep(cols, (0, 0, (d - 8) / max(1, cols - 1)))),
            cyl(f"{n} Säulen rechts", [w // 2 - 2.5, y + 5, zc - d // 2 + 4], 1.6, 16, "secondary", repeat=rep(cols, (0, 0, (d - 8) / max(1, cols - 1)))),
            cyl(f"{n} Säulen Front", [-w // 2 + 4.5, y + 5, zc + d // 2 - 3], 1.6, 16, "secondary", repeat=rep(max(3, w // 6), ((w - 9) / max(1, max(3, w // 6) - 1), 0, 0))),
            box(f"{n} Gebälk", [-w // 2, y + 21, zc - d // 2], [w, 3, d], frame("trim", "primary", "xz")),
            wedge(f"{n} Giebeldach", [-w // 2, y + 24, zc - d // 2], [w, max(6, w // 3), d], stripes(["primary", shade("primary", 0.8)], "z", 2), gable="x"),
            box(f"{n} Tympanon", [-w // 2 + 2, y + 24, zc + d // 2 - 1], [w - 4, max(4, w // 4), 1], "trim"),
            box(f"{n} Firstkante", [-1, y + 24 + max(6, w // 3) - 1, zc - d // 2], [2, 1, d], "trim")]

def rom(cls, P):
    L, W, H = P["L"], P["W"], P["H"]
    hw, hh, bev, hol = W // 2, H // 2, max(2, W // 12), hollow_of(cls)
    glowE = glow("glow", 2.7)
    ops = []
    if cls == "jaeger":
        ops += [loft("Rumpf", [S(0, 10, 4, 4, 2), S(34, 10, 5, 4, 2), S(56, 2, 1, 1, 0)], "metal_dark"),
                loft("Cockpit", [S(24, 6, 8, 0, 2), S(40, 4, 6, 0, 1)], "glass"),
                box("Rotgrat", [-1, 4, 2], [2, 2, 40], "primary"),
                box("Goldspant", [-6, -4, 22], [12, 10, 2], "trim"),
                group("Adlerschwinge", [box(f"Feder {k+1}", [5 + k * 3, -1 - k // 3, 32 - k * 3], [3, 2, 20 - k * 2], stripes(["trim", "primary"], "z", 3)) for k in range(7)]
                      + [line("Flügelkanone", [24, -2, 22], [24, -2, 44], 0.8, "metal_dark")], mirror="x", mirrorAt=0),
                ell("Adlerkopf", [0, 4, 52], [2, 2, 3], "trim")]
        ops += engine("Triebwerk", 0, 0, -12, 12, 4, "trim", glowE, rings=2)
        return ops
    if cls == "spaeher":
        ops += [loft("Rumpf", [S(0, 16, 7, 7, 3), S(88, 16, 7, 7, 3), S(112, 6, 3, 3, 1)], "metal_dark"),
                ring("Goldspant", 40, 16, 14, 3, "trim"), ring("Goldspant 2", 70, 16, 14, 3, "trim"),
                box("Rotband", [-10, 2, 0], [20, 3, 112], "primary", mode="paint"),
                windows("Fenster", 8, 4, 6, 86, 5),
                ell("Sensorkuppel", [0, 8, 60], [6, 6, 8], "metal_light", half="+y"),
                line("Sensormast", [0, 13, 54], [0, 26, 54], 0.8, "metal"),
                box("Mastadler", [-2, 26, 53], [4, 2, 2], "trim"),
                line("Sensorlanze", [0, 0, 110], [0, 0, 128], 1, "metal_light")]
        ops += eagle("Galion", 100, 7, 0.3)
        for x in (-5, 5):
            ops += engine(f"Triebwerk {x}", x, 0, -16, 16, 4, "trim", glowE, rings=2)
        return ops
    # Kampf- und Großschiffe
    ops += [seg_hull("Rumpf", L, W, H, bev, "metal_dark", hol=hol),
            loft("Kielgalerie", [S(round(L * .1), round(W * .7), 0, hh + H // 6, bev), S(round(L * .85), round(W * .65), 0, hh + H // 6, bev)], "metal", **({"hollow": hol} if hol else {}))]
    for k, f in enumerate((0.28, 0.6, 0.86)):
        ops += [ring(f"Goldspant {k+1}", round(L * f), W, H, bev, "trim"),
                box(f"Rotband {k+1}", [-hw - 4, -hh - H // 6, round(L * f) - 4], [W + 8, H + H // 3, 4], "primary", mode="paint")]
    nd = max(6, L // 30)
    ops += [box(f"Diagonalstreifen Bug {i}", [-hw - 4, -hh + i * max(2, H // 12), round(L * 0.72) + i * max(3, L // 70)], [W + 8, max(2, H // 12), max(4, L // 50)], "primary", mode="paint") for i in range(nd)]
    ops += [box("Goldkante", [-hw - 4, hh - 1, 0], [W + 8, 1, L], "trim", mode="paint"),
            windows("Fensterreihe", hw + 2, hh - 4, 6, round(L * .9), 6),
            windows("Fensterreihe unten", hw + 2, -hh + 3, 10, round(L * .88), 9),
            box("Bugwappen", [-hw - 4, -hh // 2, round(L * .9)], [W + 8, hh, max(8, L // 25)], frame("trim", "primary", "yz"), mode="paint")]
    rows = {"korvette": 1, "frachter": 0, "kreuzer": 2, "linienschiff": 3}[cls]
    for r_ in range(rows):
        ops += [slats(f"Geschützdeck {r_+1}", hw, hh // 3 - r_ * (H // 4), round(L * .3), round(L * .7), 3),
                ports(f"Breitseite {r_+1}", hw, hh // 3 - r_ * (H // 4) - 3, round(L * .3), round(L * .7), 9, length=max(6, W // 8))]
    if cls != "frachter":
        ops += [loft("Rammsporn", [S(round(L * .95), max(6, W // 3), 2, max(4, H // 6), 2, y=-hh + 4), S(L + max(10, L // 16), 2, 1, 2, 0, y=-hh)], "trim")]
    # Aufbauten
    top = hh
    if cls == "korvette":
        ops += [box("Kommandoturm", [-10, top, 30], [20, 16, 34], frame("trim", "metal", "y")),
                windows("Turmfenster", 9, top + 11, 32, 64, 4),
                ell("Kuppel", [0, top + 16, 46], [5, 5, 5], "metal_light"),
                line("Mast", [0, top + 16, 40], [0, top + 34, 40], 0.9, "metal"), box("Mastadler", [-2, top + 34, 39], [4, 2, 2], "trim")]
        ops += turret("Turm 1", 0, top, 120, 5) + turret("Turm 2", 0, top, 160, 5)
        ops += eagle("Galion", L - 22, top, 0.55)
        ops += banner("Banner L", -hw + 2, top, 70, 12) + banner("Banner R", hw - 2, top, 70, 12)
        eng = [(-9, 0, 9), (9, 0, 9)]
    elif cls == "frachter":
        ops += [box("Brücke", [-14, top, 24], [28, 22, 40], frame("trim", "metal", "y")),
                windows("Brückenfenster", 13, top + 16, 26, 62, 4),
                ell("Kuppel", [-6, top + 22, 40], [5, 5, 5], "metal_light"),
                line("Mast", [4, top + 22, 36], [4, top + 44, 36], 1, "metal")]
        for i in range(6):
            for j in (-1, 1):
                ops.append(box(f"Container {i+1}{'L' if j < 0 else 'R'}", [j * 12 - (11 if j > 0 else -1) - (0 if j > 0 else 12), top, 80 + i * 40], [22, 14 if i % 2 == 0 else 10, 34],
                               frame("trim", "primary" if (i + j) % 2 else "metal", "xz")))
        ops += turret("Turm", 0, top, 330, 5) + eagle("Galion", L - 24, top, 0.6)
        eng = [(-14, 0, 12), (14, 0, 12)]
    elif cls == "kreuzer":
        a1 = round(L * .08); a2 = round(L * .78)
        ops += [loft("Aufbau 1", [S(a1, W - 20, 18, 0, 4, y=top), S(a2, W - 20, 18, 0, 4, y=top)], "metal", **({"hollow": hol} if hol else {})),
                windows("Aufbau 1 Fenster", (W - 20) // 2 - 1, top + 12, a1 + 4, a2, 5),
                loft("Aufbau 2", [S(a1 + 10, W - 40, 30, 0, 4, y=top), S(round(L * .5), W - 40, 30, 0, 4, y=top)], "metal_dark", **({"hollow": hol} if hol else {})),
                box("Aufbau 2 Rotband", [-(W - 40) // 2, top + 22, a1 + 10], [W - 40, 3, round(L * .5) - a1 - 10], "primary", mode="paint")]
        ops += temple("Tempel", round(L * .32), top + 30, W - 40, 150)
        ops += [box("Kommandoturm", [-16, top + 30, a1 + 14], [32, 34, 54], frame("trim", "metal", "y")),
                windows("Kommandoturm Fenster", 15, top + 54, a1 + 16, a1 + 66, 4),
                ell("Kuppel 1", [-8, top + 66, a1 + 30], [7, 7, 7], "metal_light"), ell("Kuppel 2", [8, top + 66, a1 + 48], [6, 6, 6], "metal_light"),
                line("Hauptmast", [0, top + 64, a1 + 40], [0, top + 104, a1 + 40], 1.2, "metal"), box("Mastadler", [-3, top + 104, a1 + 39], [6, 3, 2], "trim")]
        for k in range(6):
            ops += turret(f"Turm oben {k+1}", 0, top + (18 if k < 3 else 0), round(L * .55) + k * 42 - (0 if k < 3 else 0), 8)
        for k in range(4):
            ops += turret(f"Flankenturm L{k+1}", -hw + 12, top, round(L * .2) + k * 110, 5) + turret(f"Flankenturm R{k+1}", hw - 12, top, round(L * .2) + k * 110, 5)
        for k, z in enumerate((round(L * .32) - 75, round(L * .32) + 75)):
            ops += banner(f"Banner L{k}", -(W - 40) // 2 + 2, top + 30, z, 22) + banner(f"Banner R{k}", (W - 40) // 2 - 2, top + 30, z, 22)
        ops += eagle("Galion", L - 30, top, 1.4)
        eng = [(-22, -2, 20), (22, -2, 20), (0, 26, 11)]
    else:  # linienschiff
        a1 = round(L * .06); a2 = round(L * .8)
        ops += [loft("Aufbau 1", [S(a1, W - 30, 24, 0, 6, y=top), S(a2, W - 30, 24, 0, 6, y=top)], "metal", hollow=hol),
                windows("Aufbau 1 Fenster", (W - 30) // 2 - 1, top + 16, a1 + 4, a2, 5),
                loft("Aufbau 2", [S(a1 + 20, W - 60, 40, 0, 6, y=top), S(round(L * .62), W - 60, 40, 0, 6, y=top)], "metal_dark", hollow=hol),
                windows("Aufbau 2 Fenster", (W - 60) // 2 - 1, top + 32, a1 + 24, round(L * .62), 6)]
        ops += temple("Tempel achtern", round(L * .25), top + 40, W - 66, 190) + temple("Tempel vorn", round(L * .5), top + 40, W - 66, 150)
        # Forum: Säulengang zwischen den Tempeln
        ops += [cyl("Forum Säulen L", [-(W - 66) // 2 + 3, top + 40, round(L * .25) + 100], 1.6, 14, "secondary", repeat=rep(20, (0, 0, 7))),
                cyl("Forum Säulen R", [(W - 66) // 2 - 3, top + 40, round(L * .25) + 100], 1.6, 14, "secondary", repeat=rep(20, (0, 0, 7))),
                box("Forum Gebälk", [-(W - 66) // 2, top + 54, round(L * .25) + 98], [W - 66, 2, 140], "trim")]
        ops += [box("Kommandoturm", [-22, top + 40, a1 + 20], [44, 50, 70], frame("trim", "metal", "y")),
                windows("Kommandoturm Fenster", 21, top + 80, a1 + 22, a1 + 88, 4),
                ell("Kuppel 1", [-10, top + 94, a1 + 40], [9, 9, 9], "metal_light"), ell("Kuppel 2", [10, top + 94, a1 + 64], [8, 8, 8], "metal_light"),
                line("Hauptmast", [0, top + 90, a1 + 52], [0, top + 150, a1 + 52], 1.6, "metal"), box("Mastadler", [-4, top + 150, a1 + 51], [8, 4, 3], "trim")]
        # Hangars an den Flanken
        ops += [box("Hangartor", [-hw - 4, -hh + 6, round(L * .2) + i * 120], [W + 8, H // 3, 70], frame("trim", "dark", "yz"), mode="paint", repeat=rep(4)) for i in (0,)]
        ops += [box("Hangarlicht", [-hw - 4, -hh + 5, round(L * .2) + i * 120], [W + 8, 1, 70], glow("glow", 1.8), mode="paint", jitter=False, repeat=rep(4)) for i in (0,)]
        for k in range(8):
            ops += turret(f"Turm oben {k+1}", 0, top + (24 if k < 4 else 0), round(L * .64) + k * 44, 10)
        for k in range(6):
            ops += turret(f"Flankenturm L{k+1}", -hw + 14, top, round(L * .12) + k * 150, 6) + turret(f"Flankenturm R{k+1}", hw - 14, top, round(L * .12) + k * 150, 6)
        for k, z in enumerate((round(L * .25) - 95, round(L * .25) + 95, round(L * .5) + 75)):
            ops += banner(f"Banner L{k}", -(W - 66) // 2 + 2, top + 40, z, 26) + banner(f"Banner R{k}", (W - 66) // 2 - 2, top + 40, z, 26)
        ops += eagle("Galion", L - 40, top, 2.2)
        eng = [(-40, -6, 28), (40, -6, 28), (0, -6, 28), (-24, 36, 15), (24, 36, 15)]
    ops += [box("Antriebsjoch", [-hw + 2, -hh - 2, -10], [W - 4, H + 4, 10], frame("trim", "metal_dark", "xy"))]
    for i, (x, y, r) in enumerate(eng):
        ops += engine(f"Triebwerk {i+1}", x, y, -r * 4, r * 4, r, "trim", glowE, rings=3 if r < 15 else 5)
    return ops

# =============================================================================================
# ÄGYPTEN
# =============================================================================================
def pharao(n, zb, y, s):
    """Pharaonenmaske; zb = Hinterkante (Halsansatz), s = Maßstab (Fregatte = 1)."""
    S_ = lambda v: max(1, round(v * s))
    return [loft(f"{n} Nemes", [S(zb, S_(44), S_(26), S_(16), 0, y=y + S_(4), rnd=0.45), S(zb + S_(22), S_(40), S_(24), S_(14), 0, y=y + S_(4), rnd=0.45),
                                 S(zb + S_(36), S_(32), S_(22), S_(10), 0, y=y + S_(5), rnd=0.5)], stripes(["trim", "secondary"], "y", 3)),
            box(f"{n} Laschen", [S_(14), y - S_(18), zb + S_(24)], [S_(6), S_(22), S_(9)], stripes(["trim", "secondary"], "y", 3), mirror="x", mirrorAt=0),
            ell(f"{n} Gesicht", [0, y + S_(7), zb + S_(38)], [S_(10), S_(13), S_(7)], "trim"),
            box(f"{n} Augen", [S_(2), y + S_(9), zb + S_(44)], [S_(5), max(1, S_(2)), S_(2)], "white", mirror="x", mirrorAt=0),
            box(f"{n} Iris", [S_(4), y + S_(9), zb + S_(45)], [S_(2), max(1, S_(2)), 1], {"role": "water", "emit": 1.6}, jitter=False, mirror="x", mirrorAt=0),
            box(f"{n} Lidstrich", [S_(1), y + S_(11), zb + S_(45)], [S_(7), 1, 1], "secondary", mirror="x", mirrorAt=0),
            box(f"{n} Bart", [-S_(2), y - S_(20), zb + S_(37)], [2 * S_(2), S_(12), S_(4)], stripes(["trim", "secondary"], "y", 2)),
            box(f"{n} Uräus", [-S_(2), y + S_(20), zb + S_(38)], [2 * S_(2), S_(6), S_(3)], "trim")]

def obelisk(n, x, y, z, h):
    return [box(f"{n} Schaft", [x - 3, y, z - 3], [6, h, 6], stripes(["stone", shade("stone", 0.85)], "y", 4)),
            box(f"{n} Glyphen", [x - 4, y + 4, z - 1], [8, h - 8, 2], glow("glow", 1.2), mode="paint", jitter=False),
            box(f"{n} Spitze", [x - 2, y + h, z - 2], [4, 3, 4], "trim"), box(f"{n} Pyramidion", [x - 1, y + h + 3, z - 1], [2, 2, 2], glow("glow2", 2.2), jitter=False)]

def aegypten(cls, P):
    L, W, H = P["L"], P["W"], P["H"]
    hw, hh, hol = W // 2, H // 2, hollow_of(cls)
    blue = {"role": "water", "emit": 2.8}
    ops = []
    if cls == "jaeger":
        ops += [loft("Delta", [S(0, 36, 3, 2, 8), S(26, 22, 4, 2, 6), S(56, 2, 2, 1, 0)], "primary"),
                box("Goldkante", [-20, 1, 0], [40, 1, 3], "trim"),
                box("Türkislinien", [-18, 2, "4 + i*8"], [36, 1, 1], glow("glow", 1.4), mode="paint", jitter=False, repeat=rep(5)),
                box("Cockpit-Pyramide", [-4, 3, 22], [8, 2, 10], "trim"), box("Cockpit-Pyramide 2", [-3, 5, 23], [6, 2, 8], "glass"), box("Pyramidenspitze", [-1, 7, 26], [2, 1, 2], glow("glow2", 2.0), jitter=False),
                line("Flügelkanone", [16, 0, 6], [16, 0, 26], 0.8, "metal_dark", mirror="x", mirrorAt=0)]
        ops += engine("Triebwerk", 0, 1, -10, 10, 4, "trim", blue, case="stone", rings=2)
        return ops
    if cls == "spaeher":
        ops += [loft("Rumpf", [S(0, 16, 7, 7, 0, rnd=0.6), S(80, 16, 7, 7, 0, rnd=0.6), S(100, 8, 4, 4, 0, rnd=0.6)], "stone"),
                ring("Goldring", 30, 16, 14, 0, "trim", rnd=0.6), ring("Goldring 2", 60, 16, 14, 0, "trim", rnd=0.6),
                box("Lapisband", [-10, -2, 0], [20, 3, 100], "secondary", mode="paint"),
                box("Türkislinie", [-10, 4, 0], [20, 1, 100], glow("glow", 1.3), mode="paint", jitter=False),
                line("Ibisschnabel", [0, 0, 100], [0, -6, 134], 1.6, "trim"),
                ell("Ibiskopf", [0, 2, 102], [4, 4, 5], "secondary"),
                cyl("Sensorschüssel", [0, 10, 50], 6, 1, "metal_light"), line("Schüsselfuß", [0, 7, 50], [0, 10, 50], 1, "trim")]
        for x in (-5, 5):
            ops += engine(f"Triebwerk {x}", x, 0, -16, 16, 4, "trim", blue, case="stone", rings=2)
        return ops
    ops += [loft("Rumpf", [S(0, W, hh, hh, max(4, W // 8)), S(round(L * .12), W - 6, hh - 2, hh - 2, 0, rnd=0.55), S(round(L * .86), W - 6, hh - 2, hh - 2, 0, rnd=0.55),
                           S(round(L * .94), round(W * .7), round(hh * .8), round(hh * .8), 0, rnd=0.6)], "stone", **({"hollow": hol} if hol else {}))]
    for k, f in enumerate((0.12, 0.42, 0.72)):
        ops.append(ring(f"Goldring {k+1}", round(L * f), W - 6, H - 4, 0, "trim", rnd=0.55))
    ops += [box("Rippen", [-hw - 4, -hh - 4, round(L * .14)], [W + 8, H + 8, 2], shade("stone", 0.86), mode="paint", repeat=rep(max(1, round(L * .7) // 6), (0, 0, 6))),
            box("Hieroglyphenband", [-hw - 4, hh // 3, 0], [W + 8, 3, L], "trim", mode="paint"),
            box("Hieroglyphen", [-hw - 4, hh // 3 + 1, 4], [W + 8, 1, 2], "dark", mode="paint", repeat=rep(L // 4 - 2, (0, 0, 4))),
            box("Hieroglyphenband unten", [-hw - 4, -hh // 3 - 3, 0], [W + 8, 3, L], "trim", mode="paint"),
            box("Türkislinie", [-hw - 4, hh // 3 + 4, 0], [W + 8, 1, L], glow("glow", 1.3), mode="paint", jitter=False),
            windows("Fensterreihe", hw + 2, 2, round(L * .14), round(L * .86), 5, col=glow("glow2", 1.1), w=3),
            box("Namenstafel", [-hw - 4, -3, round(L * .74)], [W + 8, max(6, H // 6), max(20, L // 8)], frame("trim", "secondary", "yz"), mode="paint")]
    if cls in ("korvette", "kreuzer", "linienschiff"):
        ops += [ports("Breitseite", hw - 1, -hh // 2, round(L * .2), round(L * .7), 12, length=max(5, W // 9))]
    top = hh - 2
    s_mask = {"korvette": 0.45, "frachter": 0.4, "kreuzer": 0.85, "linienschiff": 1.6}[cls]
    if cls == "frachter":
        ops += [box("Uräus Leib", [-2, 0, L - 4], [4, 12, 4], "trim"), box("Uräus Haube", [-6, 8, L - 2], [12, 8, 2], stripes(["trim", "secondary"], "y", 2)),
                box("Uräus Augen", [-2, 12, L], [4, 1, 1], glow("glow", 2.0), jitter=False)]
    else:
        ops += pharao("Maske", round(L * .94), 0, s_mask)
    if cls == "korvette":
        ops += [box("Pyramidensockel", [-14, top, 90], [28, 3, 32], frame("trim", "primary", "xz"))]
        ops += stepped_pyramid("Pyramide", 0, top + 3, 106, 26, 12, "stone", glow("glow", 1.1), glow("glow", 1.0), band_every=6)
        ops += [box("Pyramidion", [-1, top + 27, 105], [2, 2, 2], glow("glow2", 2.4), jitter=False),
                box("Achterturm", [-9, top, 20], [18, 14, 26], frame("trim", "stone", "y")), windows("Turmfenster", 8, top + 9, 22, 44, 4, col=glow("glow2", 1.1)),
                cyl("Schüssel", [5, top + 16, 32], 5, 1, "metal_light"), line("Mast", [0, top + 14, 26], [0, top + 32, 26], 0.8, "metal")]
        ops += turret("Turm 1", 0, top, 150, 5, col="stone")
        eng = [(-9, -6, 8), (9, -6, 8), (-9, 8, 6), (9, 8, 6)]
    elif cls == "frachter":
        for i in range(5):
            ops += [box(f"Frachtblock {i+1}", [-hw + 6, top, 80 + i * 44], [W - 12, 14 + (i % 2) * 6, 36], frame("trim", "stone" if i % 2 else "primary", "xz")),
                    box(f"Frachtglyphen {i+1}", [-hw + 5, top + 6, 86 + i * 44], [W - 10, 2, 24], "secondary", mode="paint")]
        ops += obelisk("Obelisk", 0, top + 20, 300, 34)
        ops += [box("Brücke", [-14, top, 22], [28, 20, 40], frame("trim", "stone", "y")), windows("Brückenfenster", 13, top + 14, 24, 60, 4, col=glow("glow2", 1.1)),
                cyl("Schüssel", [6, top + 22, 40], 6, 1, "metal_light"), line("Mast", [-4, top + 20, 32], [-4, top + 42, 32], 1, "metal")]
        eng = [(-13, -6, 10), (13, -6, 10), (-13, 10, 8), (13, 10, 8)]
    elif cls == "kreuzer":
        pc = round(L * .45)
        ops += [box("Pyramidensockel", [-44, top, pc - 52], [88, 6, 104], frame("trim", "primary", "xz"))]
        ops += stepped_pyramid("Pyramide", 0, top + 6, pc, 84, 40, stripes(["stone", "stone", shade("stone", 0.85)], "y", 3), glow("glow", 1.1), glow("glow", 1.0), band_every=8)
        ops += [box("Pyramidion", [-3, top + 86, pc - 3], [6, 4, 6], glow("glow2", 2.6), jitter=False)]
        ops += obelisk("Obelisk vorn L", -24, top, pc + 80, 44) + obelisk("Obelisk vorn R", 24, top, pc + 80, 44)
        ops += [box("Achterturm", [-22, top, 40], [44, 30, 70], frame("trim", "stone", "y")), windows("Achterturm Fenster", 21, top + 22, 42, 108, 4, col=glow("glow2", 1.1)),
                box("Achterturm oben", [-14, top + 30, 56], [28, 18, 38], shade("stone", 0.85)), cyl("Schüssel", [10, top + 50, 74], 9, 1, "metal_light"),
                line("Mast", [0, top + 48, 66], [0, top + 90, 66], 1.2, "metal"), box("Mastlicht", [-1, top + 90, 65], [2, 2, 2], glow("glow", 2.0), jitter=False)]
        for k in range(4):
            ops += turret(f"Turm oben {k+1}", 0, top, round(L * .66) + k * 36, 7, col="stone")
        for k in range(3):
            ops += turret(f"Flankenturm L{k+1}", -hw + 12, top - 4, 140 + k * 140, 5, col="stone") + turret(f"Flankenturm R{k+1}", hw - 12, top - 4, 140 + k * 140, 5, col="stone")
        eng = [(-20, 14, 13), (20, 14, 13), (-20, -14, 13), (20, -14, 13)]
    else:
        pc = round(L * .42)
        ops += [box("Pyramidensockel", [-70, top, pc - 80], [140, 8, 160], frame("trim", "primary", "xz"))]
        ops += stepped_pyramid("Pyramide", 0, top + 8, pc, 132, 64, stripes(["stone", "stone", shade("stone", 0.85)], "y", 3), glow("glow", 1.1), glow("glow", 1.0), band_every=10)
        ops += [box("Pyramidion", [-4, top + 136, pc - 4], [8, 6, 8], glow("glow2", 2.8), jitter=False)]
        ops += stepped_pyramid("Nebenpyramide vorn", 0, top, round(L * .7), 56, 24, "stone", glow("glow", 1.1), glow("glow", 1.0), band_every=8)
        ops += stepped_pyramid("Nebenpyramide achtern", 0, top, round(L * .14), 56, 24, "stone", glow("glow", 1.1), glow("glow", 1.0), band_every=8)
        for k, (x, z) in enumerate([(-50, pc + 100), (50, pc + 100), (-50, pc - 100), (50, pc - 100), (-40, round(L * .82)), (40, round(L * .82))]):
            ops += obelisk(f"Obelisk {k+1}", x, top, z, 60)
        ops += [box("Hangartor", [-hw - 4, -hh + 8, round(L * .18) + i * 120], [W + 8, H // 3, 70], frame("trim", "secondary", "yz"), mode="paint", repeat=rep(5)) for i in (0,)]
        for k in range(6):
            ops += turret(f"Turm oben {k+1}", 0, top, round(L * .52) + k * 30 + (100 if k > 2 else 0), 9, col="stone")
        for k in range(5):
            ops += turret(f"Flankenturm L{k+1}", -hw + 16, top - 6, 160 + k * 170, 6, col="stone") + turret(f"Flankenturm R{k+1}", hw - 16, top - 6, 160 + k * 170, 6, col="stone")
        eng = [(-48, 20, 20), (0, 20, 20), (48, 20, 20), (-48, -22, 20), (0, -22, 20), (48, -22, 20)]
    ops += [box("Triebwerksgehäuse", [-hw + 2, -hh, -12], [W - 4, H, 14], frame("trim", "stone", "xy"))]
    for i, (x, y, r) in enumerate(eng):
        ops += engine(f"Triebwerk {i+1}", x, y, -r * 4, r * 4, r, "trim", blue, rings=3)
    return ops

# =============================================================================================
# BABYLON
# =============================================================================================
RELIEF = frame("trim", "stone", "yz")
CHECK = {"checker": ["stone_light", "stone_dark"], "period": 1}

def crenels(n, hw, y, z0, z1, step=4):
    c = max(1, (z1 - z0) // step)
    return [box(f"{n} L", [-hw, y, z0], [3, 3, 2], "stone", repeat=rep(c, (0, 0, step))),
            box(f"{n} R", [hw - 3, y, z0], [3, 3, 2], "stone", repeat=rep(c, (0, 0, step)))]

def ziggurat(n, zc, y, w, d, steps, h=8):
    ops = []
    for k in range(steps):
        ww, dd, yy = w - 8 * k, d - 14 * k, y + h * k
        if ww < 8 or dd < 8: break
        x0, z0 = -ww // 2, zc - dd // 2
        ops += [box(f"{n} Stufe {k+1}", [x0, yy, z0], [ww, h, dd], "stone"),
                box(f"{n} Glasur {k+1}", [x0 - 1, yy + h // 2 - 1, z0 - 1], [ww + 2, 2, dd + 2], "primary", mode="paint"),
                box(f"{n} Zinnen {k+1}", [x0, yy + h - 1, z0], [ww, 1, dd], frame(CHECK, "stone", "xz"), mode="paint"),
                box(f"{n} Treppe {k+1}", [-4, yy, z0 + dd - 1], [8, h, 3], stripes(["stone_light", "stone_dark"], "y", 1))]
    return ops

def lion(n, z, y, s):
    S_ = lambda v: max(1, round(v * s))
    return [box(f"{n} Sockel", [-S_(24), y, z - S_(35)], [2 * S_(24), S_(10), S_(70)], frame("trim", "stone", "y")),
            box(f"{n} Fries", [-S_(25), y + S_(2), z - S_(31)], [2 * S_(25), S_(6), S_(62)], stripes(["trim", "stone"], "z", max(2, S_(7))), mode="paint"),
            ell(f"{n} Rumpf", [0, y + S_(22), z - S_(4)], [S_(9), S_(7), S_(18)], "trim"),
            ell(f"{n} Mähne", [0, y + S_(32), z + S_(16)], [S_(10), S_(10), S_(8)], shade("trim", 0.8)),
            ell(f"{n} Kopf", [0, y + S_(33), z + S_(23)], [S_(6), S_(6), S_(5)], "trim"),
            box(f"{n} Maul", [-S_(3), y + S_(28), z + S_(27)], [2 * S_(3), S_(3), S_(2)], "dark"),
            box(f"{n} Pranken", [S_(4), y + S_(10), z + S_(12)], [S_(4), S_(8), S_(8)], "trim", mirror="x", mirrorAt=0),
            group(f"{n} Schwinge", [box("Feder", [S_(6) + k * S_(3), y + S_(28) + k * S_(3), z + S_(8) - k * S_(3)], [S_(3), S_(6), max(2, S_(12) - k * S_(1))], stripes(["trim", shade("trim", 0.75)], "y", 2)) for k in range(7)],
                  mirror="x", mirrorAt=0)]

def lamassu_relief(n, hw, ylo, z0, s):
    S_ = lambda v: max(1, round(v * s))
    return [box(f"{n} Feld", [-hw - 4, ylo, z0], [2 * hw + 8, S_(42), S_(74)], RELIEF, mode="paint"),
            box(f"{n} Leib", [-hw - 4, ylo + S_(14), z0 + S_(18)], [2 * hw + 8, S_(10), S_(32)], "trim", mode="paint"),
            box(f"{n} Beine", [-hw - 4, ylo + S_(4), z0 + S_(20)], [2 * hw + 8, S_(10), S_(4)], "trim", mode="paint", repeat=rep(4, (0, 0, S_(9)))),
            box(f"{n} Kopf", [-hw - 4, ylo + S_(26), z0 + S_(48)], [2 * hw + 8, S_(10), S_(8)], "trim", mode="paint"),
            box(f"{n} Schwinge", [-hw - 4, ylo + S_(24), z0 + S_(16)], [2 * hw + 8, S_(10), S_(32)], stripes(["trim", shade("trim", 0.8)], "z", 2), mode="paint")]

def babylon(cls, P):
    L, W, H = P["L"], P["W"], P["H"]
    hw, hh, hol = W // 2, H // 2, hollow_of(cls)
    warm = glow("glow2", 2.4)
    ops = []
    if cls == "jaeger":   # unbemannte Lamassu-Drohne
        ops += [loft("Leib", [S(0, 12, 5, 5, 2), S(44, 12, 5, 5, 2), S(56, 8, 4, 3, 2)], "stone"),
                box("Kopf", [-4, 2, 48], [8, 8, 8], "trim"), box("Krone", [-4, 10, 49], [8, 2, 6], shade("trim", 0.8)),
                box("Bart", [-3, -2, 54], [6, 5, 3], stripes(["trim", shade("trim", 0.7)], "y", 1)),
                box("Auge", [-3, 6, 56], [6, 1, 1], glow("glow", 2.4), jitter=False),
                group("Schwinge", [box(f"Feder {k+1}", [6 + k * 3, 2 + k, 34 - k * 3], [3, 2, 22 - k * 2], stripes(["trim", shade("trim", 0.75)], "z", 2)) for k in range(6)], mirror="x", mirrorAt=0),
                box("Beine", [-5, -9, "8 + i*10"], [10, 4, 3], "stone_dark", repeat=rep(4))]
        ops += engine("Triebwerk", 0, 0, -10, 10, 4, "stone_dark", warm, rings=2)
        return ops
    if cls == "spaeher":
        ops += [loft("Rumpf", [S(0, 16, 7, 7, 2), S(92, 16, 7, 7, 2), S(108, 10, 5, 5, 2)], "stone")]
        ops += crenels("Zinnen", 8, 7, 2, 104)
        ops += [box("Relief", [-12, -5, 30], [24, 10, 40], RELIEF, mode="paint"), box("Keilschrift", [-12, -2, "34 + i*4"], [24, 4, 2], "trim", mode="paint", repeat=rep(8)),
                ell("Sternwarte", [0, 7, 60], [6, 6, 8], "glass", half="+y"),
                line("Sternmast", [0, 13, 60], [0, 30, 60], 0.8, "trim"), box("Stern", [-2, 30, 58], [4, 4, 4], glow("glow2", 2.4), jitter=False)]
        ops += engine("Triebwerk oben", 0, 3, -16, 16, 4, "stone_dark", warm, rings=2) + engine("Triebwerk unten", 0, -4, -16, 16, 4, "stone_dark", warm, rings=2)
        return ops
    ops += [seg_hull("Rumpf", L, W, H, 3, "stone", bow=0.95, bow_w=0.9, hol=hol),
            box("Kiel", [-hw // 2, -hh - 8, round(L * .15)], [hw, 8, round(L * .65)], frame("stone_light", "stone_dark", "xz")),
            box("Kielstreben", [-hw // 2 - 2, -hh - 8, round(L * .15)], [hw + 4, 8, 4], "stone_dark", repeat=rep(max(1, round(L * .65) // 24), (0, 0, 24))),
            box("Kante oben", [-hw - 2, hh - 1, 0], [W + 4, 1, L], "stone_light", mode="paint")]
    ops += crenels("Zinnen", hw, hh, 2, L - 4)
    s_rel = H / 54
    ops += lamassu_relief("Lamassu", hw, -hh + 4, round(L * .6), s_rel)
    ops += [box("Achterfeld", [-hw - 4, -hh + 6, round(L * .05)], [W + 8, round(H * .55), round(L * .2)], RELIEF, mode="paint"),
            box("Achterfiguren", [-hw - 4, -hh + 9, round(L * .07)], [W + 8, round(H * .35), 4], "trim", mode="paint", repeat=rep(max(2, round(L * .18) // 10), (0, 0, 10))),
            box("Bugfeld", [-hw - 4, -hh + 4, round(L * .86)], [W + 8, H - 8, round(L * .12)], RELIEF, mode="paint"),
            box("Keilschrift", [-hw - 4, -2, round(L * .88) + 4], [W + 8, 4, 2], "trim", mode="paint", repeat=rep(max(2, round(L * .1) // 4), (0, 0, 4))),
            box("Mittelfries", [-hw - 4, -hh + 1, round(L * .27)], [W + 8, 5, round(L * .3)], frame("trim", "stone_dark", "yz"), mode="paint"),
            windows("Schießscharten", hw + 2, hh - 6, round(L * .27), round(L * .58), 8, col="dark"),
            ell("Sonnenscheibe Bug", [0, 0, L], [max(3, W // 10), max(3, W // 10), 2], "trim"),
            box("Sonnenflügel Bug", [max(3, W // 10), -1, L - 1], [max(6, W // 4), 3, 2], "trim", mirror="x", mirrorAt=0)]
    top = hh
    if cls == "korvette":
        ops += ziggurat("Zikkurat", 110, top, 30, 70, 4, h=7)
        ops += [box("Schrein", [-4, top + 28, 104], [8, 6, 12], frame("trim", "primary", "y"))]
        ops += turret("Turm 1", 0, top, 175, 5, col="stone") + turret("Turm 2", 0, top, 40, 5, col="stone")
        eng = [(0, 5, 8), (0, -7, 7)]
    elif cls == "frachter":
        for i in range(5):
            for j in (-1, 1):
                ops.append(box(f"Kiste {i+1}{j}", [(-hw + 4) if j < 0 else 2, top, 100 + i * 42], [hw - 6, 10 + (i % 2) * 6, 34], frame("trim", "stone_dark" if (i + j) % 2 else "primary", "xz")))
        ops += ziggurat("Zikkurat", 50, top, 34, 60, 3, h=8)
        ops += [box("Schrein", [-5, top + 24, 44], [10, 8, 14], frame("trim", "primary", "y"))]
        eng = [(0, 7, 10), (0, -9, 9)]
    elif cls == "kreuzer":
        ops += ziggurat("Zikkurat", round(L * .5), top, 70, 150, 7, h=10)
        ops += [box("Schrein", [-8, top + 70, round(L * .5) - 14], [16, 14, 28], frame("trim", "primary", "y")),
                box("Schreinkrone", [-9, top + 84, round(L * .5) - 15], [18, 2, 30], frame(CHECK, "stone", "xz"))]
        ops += lion("Löwe", round(L * .14), top, 1.3)
        for k in range(3):
            ops += turret(f"Turm Bug {k+1}", 0, top, round(L * .74) + k * 46, 8, col="stone")
        for k in range(4):
            ops += turret(f"Flankenturm L{k+1}", -hw + 12, top, round(L * .2) + k * 120, 5, col="stone") + turret(f"Flankenturm R{k+1}", hw - 12, top, round(L * .2) + k * 120, 5, col="stone")
        eng = [(0, 13, 17), (0, -18, 16)]
    else:
        zc = round(L * .48)
        ops += ziggurat("Zikkurat", zc, top, 130, 300, 10, h=14)
        ops += [box("Schrein", [-12, top + 140, zc - 22], [24, 20, 44], frame("trim", "primary", "y")),
                box("Schreinkrone", [-13, top + 160, zc - 23], [26, 3, 46], frame(CHECK, "stone", "xz")),
                box("Stern", [-3, top + 163, zc - 3], [6, 6, 6], glow("glow2", 2.6), jitter=False)]
        ops += lion("Löwe achtern", round(L * .12), top, 2.0) + lion("Löwe vorn", round(L * .8), top, 1.6)
        # Ischtar-Tor am Bug (blau glasierter Torbogen)
        ops += [box("Ischtar-Tor", [-36, top, L - 60], [72, 50, 16], frame("trim", "primary", "xy")),
                box("Tordurchgang", [-14, top, L - 61], [28, 34, 18], "dark", mode="paint"),
                box("Torzinnen", [-36, top + 50, L - 60], [4, 5, 16], "primary", repeat=rep(9, (9, 0, 0))),
                box("Tortiere", [-34, top + 12, L - 45], [68, 6, 1], stripes(["trim", "primary"], "x", 6))]
        ops += [box("Hangartor", [-hw - 4, -hh + 8, round(L * .2) + i * 130], [W + 8, H // 3, 80], frame("trim", "dark", "yz"), mode="paint", repeat=rep(4)) for i in (0,)]
        for k in range(6):
            ops += turret(f"Flankenturm L{k+1}", -hw + 16, top, round(L * .18) + k * 140, 6, col="stone") + turret(f"Flankenturm R{k+1}", hw - 16, top, round(L * .18) + k * 140, 6, col="stone")
        eng = [(-36, 18, 18), (36, 18, 18), (-36, -22, 18), (36, -22, 18), (0, 0, 22)]
    ops += [box("Antriebsjoch", [-hw + 4, -hh, -10], [W - 8, H, 10], frame("trim", "stone_dark", "xy"))]
    for i, (x, y, r) in enumerate(eng):
        ops += engine(f"Triebwerk {i+1}", x, y, -r * 4, r * 4, r, "stone_dark", warm, rings=3)
    return ops

# =============================================================================================
# GERMANEN (nord)
# =============================================================================================
KNOT = frame("metal_light", {"checker": ["primary", shade("primary", 1.18)], "period": 1}, "yz")

def wolf(n, zb, y, s):
    S_ = lambda v: max(1, round(v * s))
    return [loft(f"{n} Schädel", [S(zb, S_(20), S_(14), S_(6), S_(4), y=y), S(zb + S_(16), S_(18), S_(13), S_(5), S_(4), y=y + S_(1)), S(zb + S_(26), S_(13), S_(9), S_(4), S_(3), y=y + S_(1))], "metal_light"),
            loft(f"{n} Schnauze", [S(zb + S_(23), S_(12), S_(5), S_(3), S_(2), y=y - S_(1)), S(zb + S_(42), S_(8), S_(4), S_(2), S_(1), y=y - S_(2))], "metal_light"),
            loft(f"{n} Unterkiefer", [S(zb + S_(20), S_(11), S_(2), S_(4), 1, y=y - S_(8)), S(zb + S_(40), S_(7), 1, S_(3), 1, y=y - S_(10))], "metal"),
            box(f"{n} Rachen", [-S_(5), y - S_(9), zb + S_(24)], [2 * S_(5), S_(7), S_(16)], {"role": "glow2", "emit": 0.8}, jitter=False),
            box(f"{n} Fänge", [-S_(5), y - S_(6), zb + S_(27)], [1, S_(3), 1], "trim", repeat=rep(3, (0, 0, S_(4))), mirror="x", mirrorAt=0),
            box(f"{n} Augen", [S_(6), y + S_(6), zb + S_(22)], [S_(2), S_(2), S_(3)], glow("glow2", 3.0), jitter=False, mirror="x", mirrorAt=0),
            line(f"{n} Ohr", [S_(7), y + S_(12), zb + S_(10)], [S_(10), y + S_(24), zb + S_(2)], max(1.2, 2.2 * s), "metal_light", mirror="x", mirrorAt=0)] + \
           [line(f"{n} Fell {k+1}", [S_(9), y + S_(8) - k * S_(5), zb + S_(4)], [S_(16) + k, y + S_(12) - k * S_(6), zb - S_(8) - k * S_(2)], max(1, (1.8 - k * 0.2) * s), "metal_light" if k % 2 == 0 else "metal", mirror="x", mirrorAt=0) for k in range(3)]

def wings(n, root_x, root_y, z_tail, z_lead, span, thick, drop, pods=1, pod_r=8, pod_len=130, gun_len=40, cargo=False):
    """Massive, nach außen abfallende Tragfläche (Negh'Var) – rechte Seite, wird gespiegelt."""
    steps = max(4, span // 2)
    out = []
    chord_root = z_lead - z_tail
    for k in range(steps):
        t = k / steps
        x = root_x + k * 2
        y = root_y - round(t * drop)
        lead = z_lead - round(t * chord_root * 0.45)
        trail = z_tail + round(t * chord_root * 0.18)
        th = max(3, round(thick * (1 - 0.4 * t)))
        out += [box(f"Fläche {k+1}", [x, y, trail], [2, th, lead - trail], "primary"),
                box(f"Fläche {k+1} Vorderkante", [x, y, lead - 3], [2, th, 3], "metal_light"),
                box(f"Fläche {k+1} Hinterkante", [x, y, trail], [2, th, 2], "metal_dark")]
    tipx = root_x + steps * 2 + pod_r - 2
    tipy = root_y - drop - pod_r // 2
    tz = z_tail + round(chord_root * 0.1)
    out += [line("Holm", [root_x + 2, root_y + thick - 1, (z_tail + z_lead) // 2], [tipx - pod_r, tipy + pod_r // 2, tz + round(chord_root * .35)], max(1.2, thick / 5), "secondary"),
            box("Plattenfugen", [root_x, root_y - drop - thick, z_tail + 10], [steps * 2 + 2, drop + 2 * thick + 4, 1], "metal_dark", mode="paint", repeat=rep(max(1, chord_root // 24), (0, 0, 22))),
            box("Runenband", [root_x, root_y - drop - thick, z_tail + round(chord_root * .6)], [steps * 2 + 2, drop + 2 * thick + 4, 2], glow("glow2", 1.4), mode="paint", jitter=False),
            box("Rotfeld", [root_x + steps, root_y - drop - thick, z_tail + round(chord_root * .35)], [max(6, steps // 2), drop + 2 * thick + 4, max(6, chord_root // 8)], "cloth", mode="paint")]
    pl = min(pod_len, chord_root + 20)
    for p in range(pods):
        px, py = tipx - p * (steps * 2 // 2), tipy + p * (drop // 2)
        if cargo:
            out += [box(f"Frachtgondel {p+1}", [px - pod_r, py - pod_r, tz], [2 * pod_r, 2 * pod_r, pl], frame("metal_dark", "secondary", "xy")),
                    box(f"Frachtgondel {p+1} Bänder", [px - pod_r - 1, py - pod_r - 1, tz + 8], [2 * pod_r + 2, 2 * pod_r + 2, 2], "trim", mode="paint", repeat=rep(max(1, pl // 20), (0, 0, 18)))]
        else:
            out += [cyl(f"Spitzengondel {p+1}", [px, py, tz], pod_r, pl, "metal", axis="z"),
                    cyl(f"Spitzengondel {p+1} Ringe", [px, py, tz + 12], pod_r + 1, 3, "metal_dark", axis="z", repeat=rep(max(1, pl // 26), (0, 0, 22))),
                    cyl(f"Spitzengondel {p+1} Bug", [px, py, tz + pl], pod_r, max(6, pod_r * 2), "metal_dark", axis="z", r2=max(2, pod_r // 2)),
                    line(f"Disruptor {p+1}", [px, py, tz + pl + pod_r * 2], [px, py, tz + pl + pod_r * 2 + gun_len], max(1, pod_r / 3.3), "metal_dark"),
                    box(f"Mündung {p+1}", [px - 2, py - 2, tz + pl + pod_r * 2 + gun_len - 2], [4, 4, 3], glow("glow2", 2.6), jitter=False),
                    cyl(f"Gondelglut {p+1}", [px, py, tz - 1], max(2, pod_r - 3), 1, glow("glow2", 2.6), axis="z", jitter=False)]
    return group(n, out, mirror="x", mirrorAt=0)

def tower(n, z, y, s):
    S_ = lambda v: max(1, round(v * s))
    ops = [box(f"{n} Stufe 1", [-S_(18), y, z - S_(28)], [2 * S_(18), S_(18), S_(56)], frame("metal_dark", "secondary", "y")),
           box(f"{n} Stufe 2", [-S_(13), y + S_(18), z - S_(21)], [2 * S_(13), S_(18), S_(42)], frame("metal_dark", "secondary", "y")),
           box(f"{n} Stufe 3", [-S_(9), y + S_(36), z - S_(14)], [2 * S_(9), S_(14), S_(28)], frame("metal_dark", "primary", "y")),
           box(f"{n} Krone", [-S_(6), y + S_(50), z - S_(9)], [2 * S_(6), S_(8), S_(18)], "metal_dark"),
           box(f"{n} Fenster", [-S_(14), y + S_(30), z - S_(21)], [2 * S_(14), max(1, S_(2)), S_(42)], glow("glow2", 1.2), mode="paint", jitter=False),
           line(f"{n} Mast", [0, y + S_(58), z], [0, y + S_(82), z], max(0.8, 1.2 * s), "metal")]
    # Valknut
    zf = z + S_(28) + 1
    for k, (dx, dy) in enumerate([(-3, 0), (3, 0), (0, 5)]):
        dx, dy = round(dx * s), round(dy * s)
        a = [-S_(5) + dx, y + S_(22) + dy, zf]; b = [S_(5) + dx, y + S_(22) + dy, zf]; c = [dx, y + S_(31) + dy, zf]
        ops += [line(f"{n} Valknut {k}a", a, b, 0.6, glow("glow2", 2.2), jitter=False), line(f"{n} Valknut {k}b", b, c, 0.6, glow("glow2", 2.2), jitter=False),
                line(f"{n} Valknut {k}c", c, a, 0.6, glow("glow2", 2.2), jitter=False)]
    return ops

def nord(cls, P):
    L, W, H = P["L"], P["W"], P["H"]
    hw, hh, hol = W // 2, H // 2, hollow_of(cls)
    orange = glow("glow2", 2.8)
    ops = []
    if cls == "jaeger":   # Rabe: kleiner Negh'Var
        ops += [loft("Rumpf", [S(0, 10, 4, 4, 2), S(40, 10, 5, 4, 2), S(52, 6, 3, 3, 1)], "primary"),
                loft("Rabenschnabel", [S(50, 6, 3, 3, 1), S(62, 2, 1, 2, 0, y=-2)], "metal_light"),
                box("Augen", [2, 2, 50], [1, 1, 2], glow("glow2", 2.6), jitter=False, mirror="x", mirrorAt=0),
                loft("Cockpit", [S(30, 6, 6, 0, 2), S(44, 4, 5, 0, 1)], "glass"),
                box("Knotenwerk", [-6, -4, 6], [12, 8, 26], KNOT, mode="paint"),
                wings("Fläche", 4, 0, 4, 36, 14, 3, 8, pod_r=3, pod_len=30, gun_len=12)]
        ops += engine("Triebwerk", 0, 0, -12, 12, 4, "metal_light", orange, rings=2)
        return ops
    if cls == "spaeher":
        ops += [loft("Rumpf", [S(0, 16, 7, 7, 3), S(90, 16, 7, 7, 3), S(110, 10, 5, 6, 2)], "primary"),
                box("Knotenwerk", [-10, -5, 10], [20, 10, 70], KNOT, mode="paint"),
                box("Runen", [-10, 4, "10 + i*8"], [20, 1, 2], glow("glow2", 1.4), mode="paint", jitter=False, repeat=rep(10)),
                loft("Bugklinge", [S(96, 6, 3, 6, 1, y=-6), S(126, 2, 1, 2, 0, y=-12)], "metal_light"),
                line("Sensormast", [0, 7, 50], [0, 30, 50], 1, "metal"), line("Rah", [-6, 24, 50], [6, 24, 50], 0.6, "metal"),
                wings("Fläche", 7, 0, 10, 60, 18, 4, 10, pod_r=3, pod_len=40, gun_len=14)]
        ops += wolf("Wolf", 100, 4, 0.3)
        ops += engine("Triebwerk", 0, 0, -16, 16, 5, "metal_light", orange, rings=2)
        return ops
    ops += [seg_hull("Rumpf", L, W, H, max(3, W // 9), "primary", bow=0.88, bow_w=0.85, hol=hol)]
    for k, f in enumerate((0.25, 0.65)):
        ops.append(ring(f"Spant {k+1}", round(L * f), W, H, max(3, W // 9), "metal_dark"))
    ops += [box("Bugblock", [-hw + 2, -hh, round(L * .88)], [W - 4, H, round(L * .1)], "secondary", mode="paint"),
            loft("Bugklinge", [S(round(L * .9), max(6, W // 5), H // 6, H // 3, 2, y=-hh), S(L + max(8, L // 14), 2, 1, 2, 0, y=-hh - H // 3)], "metal_light"),
            box("Knotenwerk Achtern", [-hw - 4, -hh + 4, round(L * .04)], [W + 8, H - 8, round(L * .18)], KNOT, mode="paint"),
            box("Knotenwerk Vorn", [-hw - 4, -hh + 4, round(L * .68)], [W + 8, H - 8, round(L * .17)], KNOT, mode="paint"),
            box("Runenband", [-hw - 4, hh - 4, 6], [W + 8, 1, 2], glow("glow2", 1.3), mode="paint", jitter=False, repeat=rep(L // 9, (0, 0, 8))),
            box("Lichtpforten", [-hw - 4, 0, round(L * .45)], [W + 8, 3, 3], glow("glow2", 2.4), mode="paint", jitter=False, repeat=rep(5, (0, 0, 9))),
            windows("Fensterreihe", hw + 2, hh - 8, round(L * .27), round(L * .64), 6, col=glow("glow2", 1.0))]
    if cls != "frachter":
        ops += [slats("Geschützdeck", hw, -hh // 3, round(L * .3), round(L * .62), 4, col="metal_dark"),
                ports("Breitseite", hw, -hh // 3 - 6, round(L * .3), round(L * .62), 12, length=max(6, W // 8))]
    top = hh
    s_w = {"korvette": 0.4, "frachter": 0.4, "kreuzer": 0.75, "linienschiff": 1.2}[cls]
    ops += wolf("Wolf", round(L * .9), round(H * .35), s_w)
    if cls == "korvette":
        ops += tower("Turm", round(L * .42), top, 0.45)
        ops += turret("Turm 1", 0, top, round(L * .65), 5, col="secondary") + turret("Turm 2", 0, top, round(L * .18), 5, col="secondary")
        ops += [wings("Tragfläche", hw - 4, -2, round(L * .05), round(L * .55), 30, 6, 18, pod_r=5, pod_len=80, gun_len=24)]
        eng = [(0, 2, 8), (-12, -5, 5), (12, -5, 5)]
    elif cls == "frachter":
        for i in range(5):
            ops.append(box(f"Frachtgestell {i+1}", [-hw + 6, top, 90 + i * 40], [W - 12, 14, 32], frame("metal_dark", "secondary" if i % 2 else "leather", "xz")))
            ops.append(box(f"Frachtgestell {i+1} Gurte", [-hw + 5, top, 96 + i * 40], [W - 10, 15, 2], "trim"))
        ops += tower("Turm", 46, top, 0.5)
        ops += [wings("Tragfläche", hw - 4, -2, 40, 220, 34, 7, 20, pod_r=8, pod_len=110, cargo=True)]
        eng = [(0, 4, 11), (-16, -6, 7), (16, -6, 7)]
    elif cls == "kreuzer":
        ops += tower("Turm", round(L * .42), top, 1.3)
        ops += [box("Langhaus", [-24, top, round(L * .14)], [48, 22, 120], frame("metal_dark", "secondary", "y")),
                wedge("Langhausdach", [-28, top + 22, round(L * .14) - 4], [56, 26, 128], stripes(["metal", "metal_dark"], "z", 3), gable="x")]
        for k in range(6):
            ops += turret(f"Turm oben {k+1}", 0, top, round(L * .58) + k * 34, 8, col="secondary")
        for k in range(3):
            ops += turret(f"Flankenturm L{k+1}", -hw + 12, top, round(L * .3) + k * 90, 5, col="secondary") + turret(f"Flankenturm R{k+1}", hw - 12, top, round(L * .3) + k * 90, 5, col="secondary")
        ops += [wings("Tragfläche", hw - 4, -4, round(L * .04), round(L * .48), 70, 14, 46, pods=2, pod_r=10, pod_len=200, gun_len=60)]
        eng = [(0, 6, 20), (-26, -14, 12), (26, -14, 12)]
    else:
        ops += tower("Turm", round(L * .5), top, 2.0)
        ops += [box("Langhalle", [-44, top, round(L * .1)], [88, 40, 300], frame("metal_dark", "secondary", "y")),
                wedge("Langhallendach", [-52, top + 40, round(L * .1) - 8], [104, 50, 316], stripes(["metal", "metal_dark"], "z", 3), gable="x"),
                box("Hallenfenster", [-45, top + 16, round(L * .1) + 10], [90, 4, 6], glow("glow2", 1.4), mode="paint", jitter=False, repeat=rep(20, (0, 0, 14))),
                line("Firstdrache vorn", [0, top + 89, round(L * .1) + 308], [0, top + 104, round(L * .1) + 324], 2.2, "trim"),
                line("Firstdrache hinten", [0, top + 89, round(L * .1) - 8], [0, top + 104, round(L * .1) - 24], 2.2, "trim")]
        for k in range(8):
            ops += turret(f"Turm oben {k+1}", 0, top, round(L * .64) + k * 36, 10, col="secondary")
        for k in range(5):
            ops += turret(f"Flankenturm L{k+1}", -hw + 16, top, round(L * .2) + k * 150, 6, col="secondary") + turret(f"Flankenturm R{k+1}", hw - 16, top, round(L * .2) + k * 150, 6, col="secondary")
        ops += [box("Hangartor", [-hw - 4, -hh + 8, round(L * .25) + i * 140], [W + 8, H // 3, 80], frame("metal_light", "dark", "yz"), mode="paint", repeat=rep(3)) for i in (0,)]
        ops += [wings("Tragfläche", hw - 6, -6, round(L * .03), round(L * .5), 120, 22, 80, pods=3, pod_r=14, pod_len=300, gun_len=90)]
        eng = [(0, 10, 32), (-44, -22, 18), (44, -22, 18)]
    ops += [box("Antriebsjoch", [-hw + 4, -hh, -12], [W - 8, H, 12], frame("metal_light", "metal_dark", "xy"))]
    for i, (x, y, r) in enumerate(eng):
        ops += engine(f"Triebwerk {i+1}", x, y, -r * 4, r * 4, r, "metal_light", orange, rings=3)
    return ops

# =============================================================================================
# HIMMELSREICH
# =============================================================================================
WOOD = stripes(["wood", shade("wood", 0.88)], "z", 3)

def palace(n, zc, y, w, d, floors):
    ops = [box(f"{n} Terrasse", [-w // 2 - 3, y, zc - d // 2 - 3], [w + 6, 3, d + 6], frame("trim", "stone", "xz"))]
    yy = y + 3
    for f in range(floors):
        ww, dd = w - f * (w // (floors + 1)), d - f * (d // (floors + 1))
        hh_ = max(6, 14 - f * 3)
        ops += [box(f"{n} Halle {f+1}", [-ww // 2, yy, zc - dd // 2], [ww, hh_, dd], frame("trim", "wood", "y")),
                box(f"{n} Säulen {f+1}", [-ww // 2, yy, zc - dd // 2 + 2], [ww, hh_, 2], "primary", mode="paint", repeat=rep(max(1, dd // 8), (0, 0, 8))),
                box(f"{n} Fenster {f+1}", [-ww // 2 - 1, yy + hh_ // 3, zc - dd // 2 + 5], [ww + 2, max(2, hh_ // 3), 4], frame("trim", "cloth2", "xy"), mode="paint", repeat=rep(max(1, dd // 8 - 1), (0, 0, 8))),
                box(f"{n} Traufe {f+1}", [-ww // 2 - 4, yy + hh_, zc - dd // 2 - 4], [ww + 8, 3, dd + 8], frame("trim", "secondary", "xz")),
                wedge(f"{n} Dach {f+1}", [-ww // 2, yy + hh_ + 3, zc - dd // 2], [ww, max(5, ww // 5), dd], stripes(["secondary", shade("secondary", 1.4)], "z", 2), gable="x"),
                box(f"{n} Traufecke {f+1}", [-ww // 2 - 6, yy + hh_ + 2, zc - dd // 2 - 6], [3, 4, 3], "trim", mirror="xz", mirrorAt={"x": 0, "z": zc})]
        yy += hh_ + 3 + max(5, ww // 5) - 2
    ops += [box(f"{n} Firstfigur", [-1, yy, zc - 1], [2, 5, 2], "trim")]
    return ops

def pagoda(n, zc, y, base, floors):
    ops = []
    for s_ in range(floors):
        h = max(3, base - s_)
        yy = y + s_ * 9
        ops += [box(f"{n} Stock {s_+1}", [-h, yy, zc - h], [2 * h, 7, 2 * h], frame("trim", "wood", "y")),
                box(f"{n} Fenster {s_+1}", [-h - 1, yy + 3, zc - h + 2], [2 * h + 2, 2, max(2, 2 * h - 4)], {"role": "water", "emit": 1.0}, mode="paint", jitter=False),
                box(f"{n} Traufe {s_+1}", [-h - 4, yy + 7, zc - h - 4], [2 * h + 8, 2, 2 * h + 8], frame("trim", "secondary", "xz")),
                box(f"{n} Ecke {s_+1}", [-h - 5, yy + 8, zc - h - 5], [2, 3, 2], "trim", mirror="xz", mirrorAt={"x": 0, "z": zc})]
    top = y + floors * 9
    return ops + [line(f"{n} Spitze", [0, top, zc], [0, top + 16, zc], 1, "trim"), box(f"{n} Perle", [-1, top + 16, zc - 1], [2, 3, 2], glow("glow", 2.4), jitter=False)]

def dragon_relief(n, hw, zb, y, s):
    S_ = lambda v: max(1, round(v * s))
    return [ell(f"{n} Kopf", [0, y, zb], [S_(12), S_(12), S_(5)], "trim"),
            box(f"{n} Maul", [-S_(6), y - S_(8), zb + S_(3)], [2 * S_(6), S_(4), S_(3)], "dark"),
            box(f"{n} Augen", [S_(3), y + S_(4), zb + S_(4)], [S_(3), S_(2), S_(2)], {"role": "warning", "emit": 2.2}, jitter=False, mirror="x", mirrorAt=0),
            line(f"{n} Horn", [S_(6), y + S_(8), zb + S_(2)], [S_(14), y + S_(20), zb - S_(2)], max(1, 1.4 * s), "trim", mirror="x", mirrorAt=0),
            line(f"{n} Bart", [S_(6), y - S_(4), zb + S_(4)], [S_(18), y - S_(12), zb + S_(2)], max(0.7, 0.8 * s), "trim", mirror="x", mirrorAt=0)]

def himmelsreich(cls, P):
    L, W, H = P["L"], P["W"], P["H"]
    hw, hh, hol = W // 2, H // 2, hollow_of(cls)
    blue = {"role": "water", "emit": 2.8}
    ops = []
    if cls == "jaeger":   # unbemannte Lackdrohne mit Drachenkopf
        ops += [loft("Leib", [S(0, 10, 4, 4, 2), S(40, 10, 4, 4, 2), S(48, 8, 4, 4, 2)], WOOD),
                box("Goldrahmen", [-6, -5, "8 + i*12"], [12, 10, 2], "trim", repeat=rep(3)),
                loft("Drachenkopf", [S(46, 10, 5, 3, 2, y=1), S(60, 6, 3, 2, 1)], "trim"),
                box("Jadeauge", [-3, 3, 56], [6, 1, 1], glow("glow", 2.4), jitter=False),
                line("Horn", [3, 6, 50], [6, 12, 42], 0.8, "trim", mirror="x", mirrorAt=0),
                group("Flosse", [box(f"Flosse {k+1}", [5 + k * 2, 0, 20 - k * 3], [2, 1, 14 - k * 2], stripes(["cloth", "trim"], "z", 2)) for k in range(5)], mirror="x", mirrorAt=0),
                line("Kanone", [0, -5, 30], [0, -5, 54], 0.8, "metal_dark")]
        ops += engine("Triebwerk", 0, 0, -12, 12, 4, "trim", blue, case="water", rings=2)
        return ops
    if cls == "spaeher":
        ops += [loft("Glied 1", [S(0, 16, 8, 8, 3), S(50, 16, 8, 8, 3)], WOOD), loft("Glied 2", [S(54, 16, 8, 8, 3), S(104, 14, 7, 7, 3)], WOOD),
                ring("Goldrahmen", 50, 16, 16, 3, "trim"),
                box("Paneel", [-10, -6, 6], [20, 12, 40], frame("trim", "wood_dark", "yz"), mode="paint"),
                windows("Fenster", 8, 4, 8, 100, 6, col={"role": "water", "emit": 1.2}, w=3),
                line("Laternenmast", [0, 8, 30], [0, 28, 30], 0.8, "trim"), box("Laterne", [-2, 22, 29], [4, 4, 3], glow("glow2", 2.0), jitter=False)]
        ops += dragon_relief("Drache", 8, 104, 0, 0.45) + pagoda("Pagode", 14, 8, 5, 3)
        ops += engine("Triebwerk oben", 0, 4, -18, 18, 4, "trim", blue, case="water", rings=2) + engine("Triebwerk unten", 0, -4, -18, 18, 4, "trim", blue, case="water", rings=2)
        return ops
    nseg = {"korvette": 2, "frachter": 3, "kreuzer": 4, "linienschiff": 6}[cls]
    zbug = round(L * .78)
    seglen = (zbug - round(L * .1)) // nseg
    ops += [loft("Triebwerksblock", [S(0, W - 4, hh, hh, 4), S(round(L * .1), W - 4, hh, hh, 4)], WOOD, **({"hollow": hol} if hol else {}))]
    for k in range(nseg):
        z0 = round(L * .1) + k * seglen + 4
        z1 = z0 + seglen - 6
        ops += [loft(f"Glied {k+1}", [S(z0, W - 8, hh - 2, hh, 4), S(z1, W - 8, hh - 2, hh, 4)], WOOD, **({"hollow": hol} if hol else {})),
                ring(f"Goldrahmen {k+1}", z0 - 4, W - 6, H - 2, 4, "trim", t=4),
                box(f"Glied {k+1} Paneel", [-hw - 2, -hh + 4, z0 + 4], [W + 4, H - 12, z1 - z0 - 8], frame("trim", "wood_dark", "yz"), mode="paint"),
                box(f"Glied {k+1} Dach", [-(W - 20) // 2, hh - 2, z0 + 2], [W - 20, 2, z1 - z0 - 4], frame("trim", "secondary", "xz")),
                windows(f"Glied {k+1} Fenster", hw, hh - 8, z0 + 6, z1 - 6, 8, col={"role": "water", "emit": 1.2}, w=4)]
        if k % 3 == 1:
            ops += [box(f"Phönix {k+1}", [-hw - 2, -hh + 10 + i * 2, (z0 + z1) // 2 - 10 - i * 2], [W + 4, 2, 20 + i * 4], "trim", mode="paint") for i in range(5)]
        elif k % 3 == 2:
            ops += [box(f"Drachenranke {k+1}", [-hw - 2, -6 + (i % 3) * 3, z0 + 10 + i * 6], [W + 4, 2, 4], "trim", mode="paint") for i in range(max(2, (z1 - z0 - 20) // 6))]
    ops += [ring("Goldrahmen Bug", zbug - 4, W, H + 2, 4, "trim", t=5),
            loft("Bugblock", [S(zbug, W, hh + 2, hh + 2, 4), S(L - 8, W, hh + 2, hh + 2, 4), S(L, W - 8, hh - 2, hh - 4, 8)], WOOD, **({"hollow": hol} if hol else {})),
            box("Bildfeld", [-hw - 2, -hh + 6, zbug + 10], [W + 4, H - 14, round((L - zbug) * .6)], frame("trim", "cloth2", "yz"), mode="paint"),
            box("Kalligrafietafel", [-hw - 2, hh - 8, zbug + 12], [W + 4, 6, round((L - zbug) * .55)], frame("trim", "secondary", "yz"), mode="paint")]
    nfig = max(2, round((L - zbug) * .6) // 14)
    for k in range(nfig):
        z = zbug + 14 + k * 13
        ops += [box(f"Gelehrter {k+1} Gewand", [-hw - 3, -hh + 9, z], [W + 6, max(6, H // 3), 6], ("secondary", "warning", "water", "cloth")[k % 4], mode="paint"),
                box(f"Gelehrter {k+1} Kopf", [-hw - 3, -hh + 9 + max(6, H // 3), z + 1], [W + 6, 3, 4], "skin", mode="paint")]
    ops += dragon_relief("Bugdrache", hw, L + 1, 0, H / 48)
    if cls != "frachter":
        ops += [line("Bugkanone", [hw // 2, -hh + 2, L - 10], [hw // 2, -hh + 2, L + max(16, L // 10)], max(1.2, W / 35), "metal_dark", mirror="x", mirrorAt=0)]
    top = hh
    if cls == "korvette":
        ops += palace("Palast", (zbug + L) // 2, top + 2, W - 10, round((L - zbug) * .8), 1)
        ops += pagoda("Pagode", 14, top, 7, 4)
        ops += turret("Turm 1", 0, top - 2, round(L * .45), 5, col="trim")
        eng = [(0, 6, 9), (0, -8, 9)]
    elif cls == "frachter":
        for k in range(nseg):
            z0 = round(L * .1) + k * seglen + 10
            ops += [box(f"Tributkiste {k+1}", [-hw + 6, top - 2, z0], [W - 12, 12, seglen - 22], frame("trim", "primary", "xz")),
                    box(f"Laternen {k+1}", [-hw + 4, top + 10, z0 + 4], [2, 3, 2], glow("glow2", 2.0), jitter=False, repeat=rep(max(1, (seglen - 26) // 10), (0, 0, 10)), mirror="x", mirrorAt=0)]
        ops += palace("Palast", (zbug + L) // 2, top + 2, W - 12, round((L - zbug) * .7), 1)
        ops += pagoda("Pagode", 16, top, 8, 5)
        eng = [(0, 8, 12), (0, -10, 12)]
    elif cls == "kreuzer":
        ops += palace("Palast", (zbug + L) // 2, top + 2, W - 12, round((L - zbug) * .8), 3)
        ops += pagoda("Pagode", 30, top, 12, 8)
        for k in range(5):
            ops += turret(f"Turm oben {k+1}", 0, top - 2, round(L * .2) + k * 85, 8, col="trim")
        for k, z in enumerate((round(L * .15), round(L * .7))):
            ops += [line(f"Fahnenstange {k}", [-hw + 6, top, z], [-hw + 6, top + 50, z], 1, "metal_light"), box(f"Fahne {k}", [-hw + 6, top + 34, z + 1], [1, 14, 16], frame("trim", "water", "yz"))]
        eng = [(0, 13, 20), (0, -15, 20), (-hw + 4, 0, 10), (hw - 4, 0, 10)]
    else:
        # Himmelstor: Palasttor über dem Bug und zweiter Palast mittschiffs
        ops += palace("Torpalast", (zbug + L) // 2, top + 2, W - 16, round((L - zbug) * .8), 4)
        ops += [box("Torpfeiler", [-hw + 4, top, zbug - 30], [14, 90, 14], frame("trim", "primary", "y")),
                box("Torpfeiler 2", [hw - 18, top, zbug - 30], [14, 90, 14], frame("trim", "primary", "y")),
                box("Torbalken", [-hw, top + 90, zbug - 32], [W, 10, 18], frame("trim", "primary", "xz")),
                wedge("Tordach", [-hw - 6, top + 100, zbug - 36], [W + 12, 16, 26], stripes(["secondary", shade("secondary", 1.4)], "z", 2), gable="x"),
                box("Tortafel", [-20, top + 70, zbug - 16], [40, 16, 1], frame("trim", "secondary", "xy"))]
        ops += palace("Mittelpalast", round(L * .45), top - 2, W - 30, 160, 2)
        ops += pagoda("Pagode achtern", 50, top, 16, 10) + pagoda("Pagode mitte", round(L * .62), top, 12, 7)
        for k in range(8):
            ops += turret(f"Turm oben {k+1}", 0 if k % 2 == 0 else (-30 if k % 4 == 1 else 30), top - 2, round(L * .14) + k * 34 + (220 if k > 3 else 0), 9, col="trim")
        ops += [box("Hangartor", [-hw - 2, -hh + 8, round(L * .2) + i * 150], [W + 4, H // 3, 90], frame("trim", "dark", "yz"), mode="paint", repeat=rep(3)) for i in (0,)]
        eng = [(-30, 20, 26), (30, 20, 26), (-30, -24, 26), (30, -24, 26)]
    ops += [box("Antriebsjoch", [-hw, -hh - 6, -8], [W, H + 12, 8], frame("trim", "wood_dark", "xy"))]
    for i, (x, y, r) in enumerate(eng):
        ops += engine(f"Triebwerk {i+1}", x, y, -r * 4, r * 4, r, "trim", blue, case="water" if r > 9 else "metal", rings=4 if r > 9 else 2)
    return ops

BUILDERS = {"rom": rom, "aegypten": aegypten, "babylon": babylon, "nord": nord, "himmelsreich": himmelsreich}

if __name__ == "__main__":
    only = sys.argv[1:]
    for volk, fn in BUILDERS.items():
        for cls, P in CLASSES.items():
            if only and volk not in only and cls not in only: continue
            ops = fn(cls, P)
            name = f"{NAMES[volk][cls]} – {P['label']} ({volk})"
            tags = ["schiff", cls, volk, "rohmodell"] + (["drohne"] if cls == "jaeger" and volk in ("babylon", "himmelsreich") else [])
            save(f"schiff/{cls}/{volk}", name, PALETTE[volk], tags, [P["W"] / 4, P["L"] / 4], ops, [0, 0, P["L"] // 2])
    print("ok")
