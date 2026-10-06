# Hilfsfunktionen für Schiffs-Generatoren (gen-*.py): erzeugen Rezept-Bauschritte als Python-Dicts.
import json, os, random

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'models')

def glow(r='glow', e=2.0): return {"role": r, "emit": e}
def shade(c, f): return {"shade": c, "f": f}
def frame(edge, fill, axes): return {"frame": edge, "fill": fill, "axes": axes}
def stripes(cols, axis, period): return {"stripes": cols, "axis": axis, "period": period}
def box(n, at, size, color, **kw): return {"op": "box", "name": n, "at": at, "size": size, "color": color, **kw}
def cyl(n, at, r, h, color, **kw): return {"op": "cyl", "name": n, "at": at, "r": r, "h": h, "color": color, **kw}
def line(n, a, b, r, color, **kw): return {"op": "line", "name": n, "from": a, "to": b, "r": r, "color": color, **kw}
def ell(n, at, r, color, **kw): return {"op": "ellipsoid", "name": n, "at": at, "r": r, "color": color, **kw}
def wedge(n, at, size, color, **kw): return {"op": "wedge", "name": n, "at": at, "size": size, "color": color, **kw}
def loft(n, secs, color, **kw): return {"op": "loft", "name": n, "sections": secs, "color": color, **kw}
def group(n, ops, **kw): return {"op": "group", "name": n, "ops": ops, **kw}
def rep(n, step=(0, 0, 0), var=None):
    d = {"count": n, "step": list(step)}
    if var: d["var"] = var
    return d

def S(z, w, up, down, bevel=0, y=0, x=0, rnd=0):
    d = {"z": z, "w": w, "up": up, "down": down}
    if bevel: d["bevel"] = bevel
    if y: d["y"] = y
    if x: d["x"] = x
    if rnd: d["round"] = rnd
    return d

def save(model_id, name, palette, tags, footprint, ops, anchor, tier="architecture"):
    m = {"id": model_id, "name": name, "tier": tier, "palette": palette, "tags": tags, "footprint": footprint, "ops": ops, "anchor": anchor}
    path = os.path.join(ASSETS, *model_id.split('/')) + '.json'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    return path


# --- Bauteile der Kampfschiffe (aus gen-fregatten-v4) ---
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
    ops = [cyl(f"{n} Gehäuse", [x, y, z_back], r, length, case, axis="z", **({"hollow": 3} if r > 12 else {})),
           *([cyl(f"{n} Deckel", [x, y, z_back + length - 2], r - 2, 2, case, axis="z")] if r > 12 else []),
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
