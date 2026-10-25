// ORT-01 K1 (Gruppe 2b): erzeugt kit/germanen/dach.json (Stabdach, parametrisch w,d 2..14 Kacheln).
// node tools/gen-dach-stab.mjs
// Das Dach wird einmal in "kanonischer" Lage gedacht (First entlang u, Querrichtung v) und für beide Ausrichtungen
// (First entlang x bei w >= d, sonst entlang z) mit Ausdrücken auf x/z abgebildet.
import fs from 'node:fs';

let LANG = true;
const X = (u, v) => (LANG ? u : v);
const Z = (u, v) => (LANG ? v : u);
const cond = (c) => (c ? `(${c}) && ` : '') + (LANG ? 'lang' : '!lang');
const box = (name, u, y, v, lu, hy, sv, extra = {}) => ({
  name, op: 'box', at: [X(u, v), y, Z(u, v)], size: [X(lu, sv), hy, Z(lu, sv)], ...extra, if: cond(extra.if),
});
const wedge = (name, u, y, v, lu, hy, sv, extra = {}) => ({
  name, op: 'wedge', at: [X(u, v), y, Z(u, v)], size: [X(lu, sv), hy, Z(lu, sv)], gable: LANG ? 'z' : 'x', ...extra, if: cond(extra.if),
});
const hv = (p) => [`(${p[0]}) + 0.5`, `(${p[1]}) + 0.5`, `(${p[2]}) + 0.5`];   // Voxelmitten
const line = (name, from, to, extra = {}) => {
  const f = hv(from), t = hv(to);
  return {
    name, op: 'line',
    from: [X(f[0], f[2]), f[1], Z(f[0], f[2])],
    to: [X(t[0], t[2]), t[1], Z(t[0], t[2])], ...extra, if: cond(extra.if),
  };
};

// Ausdrücke (Voxel). L = Firstlänge, S = Spannweite, Anker [1,0,1] (1 Voxel Überstand nach allen Seiten)
const let_ = {
  lang: 'w >= d',
  W: 'w * 4 + 2', D: 'd * 4 + 2',
  L: '(w >= d ? w * 4 + 2 : d * 4 + 2)',
  S: '(w >= d ? d * 4 + 2 : w * 4 + 2)',
  zwei: 'S >= 18',                                // zwei Stufen: Umgangdach + Obergaden + Hauptdach
  hA: 'zwei ? 2 : min(8, max(3, round(S * 0.45)))', // Umgangdach (bzw. einziges Dach)
  yB: 12, yC: 18,
  hC: 'min(6, max(4, round((S - 4) * 0.45)))',      // Hauptdach (Steildach)
  dk: '1 - zustand * 0.06',
  em: 'zustand < 2 ? 0.6 : 0',
  top: 'zwei ? yC + hC : 12 + hA',
  mid: 'floor(S / 2)',
};

function bauOps() {
const ops = [];
// Stufe A: Umgangdach bzw. einziges Dach
ops.push(wedge('Umgangdach / Dach', 0, 12, 0, 'L', 'hA', 'S', {
    color: { stripes: [{ shade: 'metal_dark', f: 'dk' }, { shade: 'metal_dark', f: '0.82 * dk' }], axis: 'y', period: 1 },
}));
ops.push(box('Traufe Kupfer A1', 0, 12, 0, 'L', 1, 1, { mode: 'paint', color: { shade: 'copper_dark', f: 'dk' } }));
ops.push(box('Traufe Kupfer A2', 0, 12, 'S - 1', 'L', 1, 1, { mode: 'paint', color: { shade: 'copper_dark', f: 'dk' } }));
// Stufe B: Obergaden (Stabplanken)
ops.push(box('Obergaden', 3, 12, 3, 'L - 6', 6, 'S - 6', {
  if: 'zwei', color: { stripes: [{ shade: 'metal_light', f: 'dk' }, { shade: 'metal', f: 'dk' }], axis: LANG ? 'x' : 'z', period: 4 },
}));
ops.push(box('Obergaden Fuß', 3, 12, 3, 'L - 6', 1, 'S - 6', { if: 'zwei', mode: 'paint', color: { shade: 'metal_dark', f: 'dk' } }));
// Stufe C: Hauptdach
ops.push(wedge('Hauptdach', 2, 'yC', 2, 'L - 4', 'hC', 'S - 4', {
  if: 'zwei',   color: { stripes: [{ shade: 'metal', f: 'dk' }, { shade: 'metal_dark', f: 'dk' }], axis: 'y', period: 1 },
}));
ops.push(box('Traufe Kupfer C1', 2, 'yC', 2, 'L - 4', 1, 1, { if: 'zwei', mode: 'paint', color: { shade: 'copper_dark', f: 'dk' } }));
ops.push(box('Traufe Kupfer C2', 2, 'yC', 'S - 3', 'L - 4', 1, 1, { if: 'zwei', mode: 'paint', color: { shade: 'copper_dark', f: 'dk' } }));
// Kupferfirst und Glutfuge (beide Fälle)
ops.push(box('First Kupfer', 'zwei ? 2 : 0', 'top - 1', 'mid - 1', 'zwei ? L - 4 : L', 1, 2, { color: { shade: 'copper_dark', f: 'dk' } }));
ops.push(box('Glutfuge First', 'zwei ? 4 : 2', 'top', 'mid - 1', 'zwei ? L - 8 : L - 4', 1, 1, { color: '#FF8A1A', emit: 'em', if: 'zustand < 2' }));
// Giebelbretter (nur Hauptdach, gekreuzt), Runenspitzen
for (const [i, uu] of [[0, 2], [1, 'L - 3']]) {
  const c = { color: { shade: 'copper_dark', f: 'dk' }, r: 0.5, if: 'zwei' };
  ops.push(line(`Giebelbrett ${i}a`, [uu, 'yC', 2], [uu, 'top + 2', 'mid + 2'], c));
  ops.push(line(`Giebelbrett ${i}b`, [uu, 'yC', 'S - 3'], [uu, 'top + 2', 'mid - 3'], c));
  ops.push(box(`Runenspitze ${i}a`, uu, 'top + 2', 'mid + 2', 1, 1, 1, { color: { role: 'rune', emit: 'em' }, if: 'zwei && zustand < 2' }));
  ops.push(box(`Runenspitze ${i}b`, uu, 'top + 2', 'mid - 3', 1, 1, 1, { color: { role: 'rune', emit: 'em' }, if: 'zwei && zustand < 2' }));
}
return ops;
}
const out = [...(LANG = true, bauOps()), ...(LANG = false, bauOps())];
out.push({ name: 'Verfall', op: 'erode', if: 'zustand > 0', density: 'zustand == 1 ? 0.12 : 0.25', depth: 'zustand', at: [0, 12, 0], size: ['W', 'top - 12 + 1', 'D'] });


const model = {
  id: 'kit/germanen/dach',
  name: 'Germanen – Stabdach (ORT-01 K1): gestaffelte Steildächer aus Eisenlagen (Umgangdach, Obergaden aus Stabplanken, Hauptdach), Kupfertraufen und -first, Glutfuge am First, gekreuzte Giebelbretter mit Runenspitzen; deckt ein Gebäuderechteck (w×d Kacheln), nicht eine Kachel',
  tier: 'architecture',
  palette: 'nord',
  tags: ['germanen', 'kit', 'dach', 'stabbau', 'ort01'],
  notes: 'ORT-01 K1 (Gruppe 2b), erzeugt von tools/gen-dach-stab.mjs. Ersetzt das Satteldach in dach-Braun. Nur Außenposten-Hüllenkarten setzen ein Dach (kit.js HUELL_TYPEN kulisse/lagerhalle). Ab Spannweite 18 Voxel (d oder w >= 4 Kacheln) zwei Stufen, darunter ein einzelnes Dach. Ausrichtung des Firsts: entlang der längeren Seite.',
  footprint: [14, 14],
  jitter: 0,
  variants: {
    klein: { w: 3, d: 3 },
    lang: { w: 7, d: 4 },
    tief: { w: 4, d: 7 },
    groß: { w: 13, d: 9 },
    schmal: { w: 2, d: 2 },
  },
  params: {
    w: { default: 5, min: 2, max: 14, step: 1, label: 'Breite (Kacheln, Ost-West)' },
    d: { default: 4, min: 2, max: 14, step: 1, label: 'Tiefe (Kacheln, Nord-Süd)' },
    zustand: { default: 0, min: 0, max: 2, step: 1, label: '0 intakt · 1 verfallen · 2 umkämpft' },
  },
  let: let_,
  ops: out,
  anchor: [1, 0, 1],
};
fs.writeFileSync(new URL('../assets/models/kit/germanen/dach.json', import.meta.url), JSON.stringify(model, null, 2) + '\n');
console.log('dach.json:', out.length, 'Ops');
