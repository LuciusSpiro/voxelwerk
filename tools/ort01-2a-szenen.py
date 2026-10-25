# Szenen ORT-01 Paket 2a (Rom-Außenposten). python tools/ort01-2a-szenen.py
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "scenes") + os.sep
RA = "ort/rom/aussenposten/"; RG = "ort/rom/gemein/"
GA = "ort/germanen/aussenposten/"; GG = "ort/germanen/gemein/"

LEG = {
    "g": {"h": 1, "top": {"noise": ["grass", "grass_dark", "grass_light"], "weights": [3, 2, 1]}, "fill": "soil"},
    "p": {"h": 1, "top": "#CFC4AE", "fill": "soil"},
    "s": {"h": 1, "top": "#9C9079", "fill": "soil"},
    "G": {"h": 1, "top": {"noise": ["#6F7A55", "#5E6849", "#848C6A"], "weights": [3, 2, 1]}, "fill": "#4A3F33"},
    "P": {"h": 1, "top": "#8A8A82", "fill": "#4A3F33"},
    "S": {"h": 1, "top": "#6A6A63", "fill": "#4A3F33"},
}

def terrain(W, D, fn):
    rows = ["".join(fn(x, z) for x in range(W)) for z in range(D)]
    return {"palette": "planet_mediterran", "depth": 2, "jitter": 0, "legend": LEG, "rows": rows, "heights": ["1" * W] * D}

def save(sc):
    json.dump(sc, open(OUT + sc["id"] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def cells(cx, cz):
    out = []
    for i, (dx, dz, ch) in enumerate([(-0.28, -0.5, 4), (0.28, -0.5, 4), (-0.28, 0.1, 3), (0.28, 0.1, 2)]):
        for bay in (-0.875, 0.875):
            out.append({"model": "ort/rom/gemein/energiezelle", "at": [round(cx + bay + dx, 3), round(cz + dz, 3)], "params": {"charge": ch}})
    return out

def rom_hof(ox, oz):
    p = lambda m, x, z, **k: dict({"model": m, "at": [ox + x, oz + z]}, **k)
    pl = [
        p(RA + "halle", 8, 5),
        p(RA + "sensorturm", 17.5, 2),
        p(RG + "leitung", 14.2, 5.2, rot=90, params={"n": 3}),
        p(RG + "verteiler", 14.2, 8.6),
        p(RA + "zellendepot", 5, 13),
        p(RA + "unterkunft", 19.5, 13.5),
        p(RA + "landeplatz", 12, 13.2),
        p(RA + "leitfeuer", 9.7, 10.9), p(RA + "leitfeuer", 14.3, 10.9),
        p(RA + "leitfeuer", 9.7, 15.5), p(RA + "leitfeuer", 14.3, 15.5),
        p(RA + "deckung_heizer", 9.2, 8.9),
        p(RA + "deckung_pumpe", 3.6, 9.2),
        p(RA + "deckung_kapsel", 18.2, 9.4, rot=10),
        p(RA + "deckung_kapsel", 19.3, 10.0, rot=-15),
        p("rom/standarte", 6.5, 9.2),
        p("rom/laterne", 22.2, 9.4),
    ]
    for c in cells(ox + 5, oz + 13):
        pl.append(c)
    return pl

def cam(t, d, e, a):
    return {"target": t, "dist": d, "elev": e, "az": a, "fov": 36}

# Rom-Hof allein
W, D = 24, 18
t = terrain(W, D, lambda x, z: "s" if z >= 17 else ("p" if 1 <= x <= 22 and z <= 16 else "g"))
save({"id": "ort-2a-rom-hof", "name": "ORT-01 2a Rom: Außenposten-Hof komplett", "palette": "rom", "mood": "planet_day",
      "terrain": t, "place": rom_hof(0, 0),
      "cameras": {
          "uebersicht": cam([12, 2.0, 8.5], 38, 48, 28),
          "spielnah": cam([12, 0.5, 9.5], 30, 72, 0),
          "detail": cam([8, 2.8, 6], 10, 24, 22),
          "depot": cam([5, 0.8, 13], 6.5, 40, 15),
          "halle": cam([8, 2.5, 4.5], 15, 50, 25),
          "landung": cam([12, 0.3, 13], 9, 28, 30)}})

# Vergleich Rom (links) / Germanen (rechts, Hof des Designers, versetzt um 25 m)
W2, D2 = 48, 18
def vt(x, z):
    if x < 24:
        return "s" if z >= 17 else ("p" if 1 <= x <= 22 and z <= 16 else "g")
    return "S" if z >= 17 else ("P" if 26 <= x <= 45 and z <= 16 else "G")
ox = 25
ger = [
    {"model": GA + "halle", "at": [ox + 7.5, 5]},
    {"model": GA + "sensorturm", "at": [ox + 16.5, 2]},
    {"model": GG + "verteiler", "at": [ox + 14.5, 8.6]},
    {"model": GG + "fassregal", "at": [ox + 5, 13]},
    {"model": GG + "fasszelle", "at": [ox + 3.4, 11.5], "row": {"count": 4, "step": [0.65, 0]}},
    {"model": "prop/germanen/gemein/kiste_stapel", "at": [ox + 18, 9.4], "rot": 10},
    {"model": "prop/germanen/gemein/kiste_stapel", "at": [ox + 19, 10], "rot": -25},
    {"model": "prop/germanen/gemein/feuerschale", "at": [ox + 9.2, 8.9]},
]
for g in ger:
    g["palette"] = "nord"
save({"id": "ort-2a-vergleich", "name": "ORT-01 2a: Rom-Hof (links) gegen germanischen Hof (rechts)", "palette": "rom", "mood": "planet_day",
      "terrain": terrain(W2, D2, vt), "place": rom_hof(0, 0) + ger,
      "cameras": {
          "uebersicht": cam([24, 2.0, 8.5], 70, 48, 0),
          "spielnah": cam([24, 0.5, 9.5], 62, 70, 0),
          "detail": cam([24, 2.5, 6], 26, 20, 0)}})
