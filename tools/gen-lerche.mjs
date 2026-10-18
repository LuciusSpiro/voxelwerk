// Erzeugt das Rezept assets/models/schiff/lerche/rom.json (KRS Lerche, Aussenmodell mit drei Decks, Ausbaustufen 0-3).
//   node tools/gen-lerche.mjs           schreibt die Datei
//   node tools/gen-lerche.mjs --check   vergleicht nur (Exit 1 bei Abweichung)
// Quelle der Wahrheit ist dieses Skript (Muster: gen-fregatten-v4.py); das JSON nicht von Hand aendern.
//
// Koordinaten: Voxel, Stufe architecture (4 Voxel/m). Bug +z, oben +y, Backbord = +x, Stb = -x. Spiegelebene x = 0.
// Decks (je 12 Voxel = 3 m): Unterdeck y 0-11 (Ausbaudeck), Mitteldeck y 12-23 (Bruecke, Systeme), Oberdeck y 24-35 (privat).
// Plaetze (Numpad): Bug 8 (Lanze) und 5 (Bugturm), Backbord 7/4/1 von vorn nach hinten, Steuerbord 9/6/3, Heck 2.
// Stufe 0: 8 4 6 | 1: + 7 9 | 2: + 5 2 | 3: + 1 3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets', 'models', 'schiff', 'lerche', 'rom.json');
const ANCHOR = [0, 0, 100];

const ops = [];
const add = (o) => { ops.push(o); return o; };
const mir = (name, inner, extra = {}) => add({ op: 'group', name, mirror: 'x', mirrorAt: 0, ops: inner, ...extra });
const box = (name, at, size, color, extra = {}) => ({ op: 'box', name, at, size, color, ...extra });
const paint = (name, at, size, color, extra = {}) => box(name, at, size, color, { mode: 'paint', ...extra });
const lamp = (role, emit) => ({ role, emit });
const frame = (f, fill, axes, width) => ({ frame: f, fill, axes, ...(width ? { width } : {}) });
const sec = (z, w, y, extra = {}) => ({ z, w, y, up: 6, down: 6, bevel: 3, ...extra });

// ---------------------------------------------------------------------------------------------
// Rumpf: Unterdeck, Mitteldeck, Kiel
// ---------------------------------------------------------------------------------------------
add({ op: 'loft', name: 'Unterdeck', color: 'metal_dark', sections: [sec(46, 34, 6), sec(58, 44, 6), sec(176, 44, 6), sec(188, 28, 6, { bevel: 2 })] });
add({ op: 'loft', name: 'Mitteldeck', color: 'metal', sections: [sec(0, 44, 18), sec(14, 52, 18), sec(176, 52, 18), sec(192, 36, 18), sec(206, 14, 18, { bevel: 2 })] });
add(box('Kiel', [-6, -3, 60], [12, 3, 118], 'metal_dark'));
add(box('Kielleiste', [-1, -3, 60], [2, 1, 118], 'trim', { mode: 'paint' }));
// Lafettenwulst (Unterdeck, Lafettenbereich): bleibt in allen Stufen gleich, der Rumpf ist fest
mir('Lafettenwulst', [box('Wulst', [22, 2, 64], [12, 10, 74], 'metal_dark'), box('Wulst Schraege', [26, 0, 66], [8, 2, 70], 'metal_dark', { mode: 'under' })]);
// Lorica-Streifen und Goldkante auf dem Mitteldeck, Ruderreihen der Batterien
mir('Deck Mitteldeck', [
  paint('Goldkante', [24, 23, 14], [2, 1, 168], 'trim'),
  paint('Ruderleiste', [20, 23, 22], [4, 1, 140], { stripes: ['metal_dark', 'metal'], axis: 'z', period: 3 }),
]);
add(paint('Goldspant 1', [-26, 23, 22], [52, 1, 2], 'trim'));
add(paint('Goldspant 2', [-26, 23, 153], [52, 1, 2], 'trim'));
add(paint('Goldspant 3', [-17, 23, 180], [34, 1, 2], 'trim'));
add(paint('Terrakottaband Bug', [-14, 23, 184], [28, 1, 3], 'cloth'));
// Fensterreihen Seitenwaende
mir('Fenster Mitteldeck', [paint('Fensterreihe Mitteldeck', [24, 19, 20], [2, 2, 3], lamp('glow2', 1.0), { jitter: false, repeat: { count: 28, step: [0, 0, 5] } })]);
mir('Bandstreifen', [paint('Terrakottaband Flanke', [24, 14, 14], [2, 2, 160], 'cloth'), paint('Goldband Flanke', [24, 17, 14], [2, 1, 160], 'trim')]);

// ---------------------------------------------------------------------------------------------
// Oberdeck: Podium mit drei Giebelbauten (Quartier, Meetingraum, Quartier) und Messe
// ---------------------------------------------------------------------------------------------
add(box('Oberdeck Podium', [-20, 24, 32], [40, 2, 120], 'secondary'));
add(paint('Podium Goldkante', [-20, 25, 32], [40, 1, 120], 'trim', { mode: 'paint' }));
add(box('Podium Innen', [-19, 25, 33], [38, 1, 118], 'metal', { mode: 'add' }));
const wohnblock = (zz, nm) => {
  add(box(`${nm} Wand`, [-16, 26, zz], [32, 9, 30], 'secondary'));
  mir(`${nm} Traufe`, [paint(`${nm} Dachtraufe`, [15, 35, zz - 1], [2, 1, 32], 'cloth')]);
  add({ op: 'wedge', name: `${nm} Dach`, at: [-17, 35, zz - 1], size: [34, 6, 32], gable: 'x', color: 'primary' });
  add(box(`${nm} Dachfirst`, [-1, 40, zz - 1], [2, 1, 32], 'trim'));
  mir(`${nm} Fenster`, [paint(`${nm} Fensterband`, [14, 29, zz + 3], [2, 3, 5], lamp('glow2', 1.2), { jitter: false, repeat: { count: 4, step: [0, 0, 7] } })]);
};
wohnblock(34, 'Quartier Heck');
// Meetingraum: hoeher, grosse Fenster, Planungstisch-Oberlicht
add(box('Meetingraum Wand', [-18, 26, 68], [36, 12, 30], 'secondary'));
add({ op: 'wedge', name: 'Meetingraum Dach', at: [-19, 38, 67], size: [38, 8, 32], gable: 'x', color: 'primary' });
add(box('Meetingraum Dachfirst', [-1, 45, 67], [2, 1, 32], 'trim'));
add(box('Meetingraum Oberlicht', [-3, 44, 76], [6, 1, 14], { role: 'glass', emit: 0.6 }, { jitter: false }));
mir('Meetingraum Fenster', [paint('Meetingraum Fensterband', [16, 29, 71], [2, 5, 24], lamp('glow2', 1.2), { jitter: false })]);
mir('Meetingraum Saeulen', [paint('Saeule', [16, 26, 70], [2, 12, 1], 'trim', { repeat: { count: 5, step: [0, 0, 6] } })]);
wohnblock(102, 'Quartier Bug');
// Messe am Bug
add(box('Messe Wand', [-14, 26, 139], [28, 6, 11], 'secondary'));
add(box('Messe Dach', [-15, 32, 138], [30, 1, 13], 'primary'));
add(paint('Messe Dachkante', [-15, 32, 138], [30, 1, 1], 'trim'));
add(box('Messe Oberlicht', [-5, 33, 141], [10, 1, 7], lamp('glow', 0.8), { jitter: false }));
mir('Messe Fenster', [paint('Messe Fensterband', [12, 28, 141], [2, 3, 7], lamp('glow2', 1.2), { jitter: false })]);

// ---------------------------------------------------------------------------------------------
// Bruecke (Mitteldeck, vorn oben): Turm mit Helmkamm
// ---------------------------------------------------------------------------------------------
add(box('Bruecke Turm', [-12, 24, 154], [24, 20, 22], frame('trim', 'metal', 'y')));
add({ op: 'wedge', name: 'Bruecke Nase', at: [-12, 24, 176], size: [24, 20, 6], slope: '+z', color: 'metal' });
add(box('Bruecke Dach', [-10, 44, 156], [20, 1, 20], 'primary'));
add(box('Helmkamm', [-1, 45, 154], [2, 6, 26], 'cloth'));
add(box('Helmkamm Gold', [-1, 51, 154], [2, 1, 26], 'trim'));
add(box('Adler', [-3, 45, 178], [6, 5, 2], 'trim'));
add(paint('Bruecke Fenster', [-13, 38, 160], [26, 4, 16], lamp('glow2', 1.3), { jitter: false }));
add(paint('Bruecke Fensterstreben', [-13, 38, 160], [26, 4, 1], 'metal_dark', { repeat: { count: 6, step: [0, 0, 3] } }));
add(paint('Bruecke Gesims', [-13, 35, 154], [26, 1, 28], 'trim'));

// Stufenzeichen: vier Messingleuchten auf dem Achterdeck, so viele leuchten wie die Ausbaustufe + 1 (Lesbarkeit im Spielmassstab)
for (let i = 0; i < 4; i++) {
  add(box(`Stufenzeichen ${i} Sockel`, [-15 + i * 8, 24, 21], [6, 1, 7], 'metal_dark'));
  add(box(`Stufenzeichen ${i} Messing`, [-15 + i * 8, 25, 21], [6, 1, 7], { shade: 'trim', f: 1.3 }, { jitter: false, if: `stufe >= ${i}` }));
}
// Banner (Andockpunkt banner_bb/banner_stb)
mir('Banner', [
  { op: 'line', name: 'Banner Stange', from: [23, 24, 44], to: [23, 46, 44], r: 0.9, color: 'metal_light' },
  { op: 'line', name: 'Banner Querholz', from: [23, 44, 40], to: [23, 44, 48], r: 0.7, color: 'trim' },
  box('Banner Tuch', [23, 31, 41], [1, 12, 7], frame('trim', 'cloth', 'yz')),
  box('Banner Spitze', [22, 46, 43], [2, 2, 2], 'trim'),
]);

// ---------------------------------------------------------------------------------------------
// Antrieb: zwei Rundtriebwerke, dazwischen Heckluke (Waffe 2)
// ---------------------------------------------------------------------------------------------
mir('Antriebsjoch', [box('Antriebsjoch', [5, 8, -8], [14, 22, 10], frame('trim', 'metal_dark', 'xy'))]);
add(box('Heckplatte', [-5, 9, -8], [10, 18, 2], 'metal_dark'));
const motor = (x) => [
  { op: 'cyl', name: 'Triebwerk Gehaeuse', axis: 'z', at: [x, 18, -36], r: 10, h: 36, color: 'metal_dark' },
  { op: 'cyl', name: 'Triebwerk Glocke', axis: 'z', at: [x, 18, -40], r: 12, h: 5, hollow: 3, color: 'trim' },
  { op: 'cyl', name: 'Triebwerk Glut', axis: 'z', at: [x, 18, -38], r: 9, h: 2, color: lamp('glow', 2.7), jitter: false },
  { op: 'cyl', name: 'Triebwerk Kern', axis: 'z', at: [x, 18, -39], r: 5, h: 1, color: lamp('white', 3.0), jitter: false },
  { op: 'cyl', name: 'Triebwerk Ring', axis: 'z', at: [x, 18, -30], r: 11, h: 3, color: 'trim', repeat: { count: 3, step: [0, 0, 12] } },
];
mir('Triebwerke', motor(15));

// ---------------------------------------------------------------------------------------------
// Waffenplaetze. Parameter stufe 0-3, Pro Platz offen (Lafette) oder verschlossen (Deckel)
// ---------------------------------------------------------------------------------------------
const Z = { s1: 74, s4: 101, s7: 128 };
// Seitenplaetze unten (7/9, 1/3): Wulstoberkante y = 12, Drehkranz bei x = 30
// Offener Platz = heller Messingdeckel + dickes Rohr + Ausleger (breitere Silhouette); verschlossen = dunkler flacher Deckel.
const KAPPE = { shade: 'trim', f: 1.25 };
const untenOffen = (zz) => [
  box('Lafette Ausleger', [34, 4, zz - 6], [8, 10, 12], frame('trim', 'metal_dark', 'xz')),
  box('Lafette Gehaeuse', [26, 12, zz - 6], [10, 5, 12], frame('trim', 'metal_dark', 'xz')),
  box('Lafette Kappe', [28, 17, zz - 5], [9, 2, 10], KAPPE, { jitter: false }),
  { op: 'line', name: 'Lafette Rohr', from: [36, 15, zz], to: [60, 15, zz], r: 2.6, color: 'metal_light' },
  box('Lafette Muendung', [57, 12, zz - 3.5], [5, 7, 7], KAPPE, { jitter: false }),
];
const untenZu = (zz) => [
  box('Deckel', [26, 12, zz - 8], [8, 1, 16], frame('metal_dark', 'dark', 'xz')),
  paint('Deckel Naht quer', [27, 12, zz - 1], [6, 1, 2], 'dark'),
  paint('Deckel Naht laengs', [30, 12, zz - 7], [2, 1, 14], 'dark'),
];
mir('Lafetten 7 und 9 offen', untenOffen(Z.s7), { if: 'p79' });
mir('Lafetten 7 und 9 zu', untenZu(Z.s7), { if: '1 - p79' });
mir('Lafetten 1 und 3 offen', untenOffen(Z.s1), { if: 'p13' });
mir('Lafetten 1 und 3 zu', untenZu(Z.s1), { if: '1 - p13' });
// Batterien 4 und 6 (Mitteldeck, ab Start offen): Sponson mit zwei Rohren
mir('Batterien 4 und 6', [
  box('Batterie Sponson', [26, 12, Z.s4 - 10], [16, 9, 20], frame('trim', 'metal_dark', 'xz')),
  box('Batterie Kappe', [28, 21, Z.s4 - 9], [10, 2, 18], KAPPE, { jitter: false }),
  { op: 'line', name: 'Batterie Rohr', from: [42, 16.5, Z.s4 - 5], to: [60, 16.5, Z.s4 - 5], r: 2.4, color: 'metal_light' },
  { op: 'line', name: 'Batterie Rohr', from: [42, 16.5, Z.s4 + 5], to: [60, 16.5, Z.s4 + 5], r: 2.4, color: 'metal_light' },
  box('Batterie Muendung', [57, 13.5, Z.s4 - 8.5], [5, 6, 7], KAPPE, { jitter: false }),
  box('Batterie Muendung', [57, 13.5, Z.s4 + 1.5], [5, 6, 7], KAPPE, { jitter: false }),
  paint('Batterie Pforte', [28, 14, Z.s4 - 8], [6, 3, 1], 'dark', { repeat: { count: 3, step: [0, 0, 8] } }),
]);
// Platz 8: Lanze am Bug (ab Start), Rammsporn
add({ op: 'loft', name: 'Rammsporn', color: 'trim', sections: [{ z: 204, w: 14, y: 11, up: 2, down: 4, bevel: 1 }, { z: 232, w: 2, y: 10, up: 1, down: 2 }] });
add({ op: 'cyl', name: 'Lanze Lauf', axis: 'z', at: [0, 18, 198], r: 3, h: 40, color: 'metal_dark' });
add({ op: 'cyl', name: 'Lanze Fokusring', axis: 'z', at: [0, 18, 208], r: 4.5, h: 2, color: 'trim', repeat: { count: 3, step: [0, 0, 10] } });
add({ op: 'cyl', name: 'Lanze Linse', axis: 'z', at: [0, 18, 238], r: 2.5, h: 2, color: lamp('glow', 2.4), jitter: false });
// Platz 5: Bugturm auf dem Vorschiff (ab Stufe 2)
add({ op: 'cyl', name: 'Bugturm Drehkranz', at: [0, 24, 188], r: 8, h: 2, color: 'metal_dark', if: 'p25' });
add({ op: 'cyl', name: 'Bugturm Kappe', at: [0, 30, 188], r: 6, h: 2, color: KAPPE, jitter: false, if: 'p25' });
add(box('Bugturm Gehaeuse', [-4, 26, 184], [8, 4, 9], frame('trim', 'metal_dark', 'xz'), { if: 'p25' }));
add({ op: 'line', name: 'Bugturm Rohr', from: [-4, 28, 192], to: [-4, 28, 203], r: 2, color: 'metal_dark', if: 'p25' });
add({ op: 'line', name: 'Bugturm Rohr', from: [4, 28, 192], to: [4, 28, 203], r: 2, color: 'metal_dark', if: 'p25' });
add(box('Bugturm Muendung', [-6, 27, 202], [12, 2, 2], 'trim', { if: 'p25' }));
add({ op: 'cyl', name: 'Bugdeckel', at: [0, 24, 188], r: 6, h: 1, color: 'metal', if: '1 - p25' });
add({ op: 'cyl', name: 'Bugdeckel Rand', at: [0, 24, 188], r: 6, h: 1, hollow: 1, color: 'trim', if: '1 - p25' });
add(paint('Bugdeckel Naht', [-5, 24, 187], [10, 1, 2], 'dark', { if: '1 - p25' }));
add(paint('Bugdeckel Naht laengs', [-1, 24, 182], [2, 1, 12], 'dark', { if: '1 - p25' }));
// Platz 2: Heckwaffe im Antriebsraum (ab Stufe 2)
add(box('Heckturm Gehaeuse', [-4, 14, -8], [8, 8, 8], frame('trim', 'metal', 'xy'), { if: 'p25' }));
add({ op: 'line', name: 'Heckturm Rohr', from: [0, 18, -8], to: [0, 18, -30], r: 2.2, color: 'metal_dark', if: 'p25' });
add(box('Heckturm Muendung', [-3, 15, -32], [6, 6, 3], KAPPE, { jitter: false, if: 'p25' }));
add(box('Heckturm Kappe', [-3, 22, -8], [6, 2, 8], KAPPE, { jitter: false, if: 'p25' }));
add(box('Heckdeckel', [-4, 14, -9], [8, 8, 1], frame('trim', 'metal', 'xy'), { if: '1 - p25' }));
add(paint('Heckdeckel Naht', [-4, 17, -9], [8, 2, 1], 'dark', { if: '1 - p25' }));

// ---------------------------------------------------------------------------------------------
// Module (Unterdeck, Seitenwand): offen = Fensterlicht, verschlossen = Laeden. Modul 1+2 immer, 3 ab Stufe 1, 4 ab Stufe 2
// ---------------------------------------------------------------------------------------------
const modul = (nm, x, z0, len, cond) => {
  const fenster = paint(`${nm} Fenster`, [x, 5, z0 + 1], [2, 2, 2], lamp('glow2', 1.2), { jitter: false, repeat: { count: Math.floor(len / 4), step: [0, 0, 4] } });
  const laden = paint(`${nm} Laden`, [x, 4, z0], [2, 4, len], 'dark');
  const bandl = paint(`${nm} Ladenband`, [x, 6, z0], [2, 1, len], 'metal_light');
  if (cond === null) return [fenster];
  return [{ ...fenster, if: cond }, { ...laden, if: `1 - ${cond}` }, { ...bandl, if: `1 - ${cond}` }];
};
add(paint('Unterdeck Goldband', [-22, 10, 56], [44, 1, 128], 'trim', { mode: 'paint' }));
for (const o of [...modul('Modul 1', 20, 138, 22, null), ...modul('Modul 3', 20, 50, 18, 'm3')]) add(o);
for (const o of [...modul('Modul 2', -22, 138, 22, null), ...modul('Modul 4', -22, 50, 18, 'm4')]) add(o);
add(paint('Bugraum Fenster', [-6, 5, 176], [12, 2, 2], lamp('glow2', 1.2), { jitter: false, repeat: { count: 1, step: [0, 0, 4] } }));

// Positionslichter (Backbord rot, Steuerbord mint) am Ende des Lafettenwulsts
add(box('Positionslicht Backbord (rot)', [32, 9, 126], [2, 2, 2], lamp('warning', 2.0), { jitter: false }));
add(box('Positionslicht Steuerbord (mint)', [-34, 9, 126], [2, 2, 2], lamp('glow', 2.0), { jitter: false }));

// ---------------------------------------------------------------------------------------------
// Andockpunkte (Meter, relativ zum Anker, +z Bug, +x Backbord, y oben)
// ---------------------------------------------------------------------------------------------
const m = (v) => [+((v[0] - ANCHOR[0]) / 4).toFixed(3), +((v[1] - ANCHOR[1]) / 4).toFixed(3), +((v[2] - ANCHOR[2]) / 4).toFixed(3)];
const sockets = {
  bug: m([0, 18, 232]), bugzier: m([0, 24, 196]), muendung_lanze: m([0, 18, 240]),
  triebwerk_bb: m([15, 18, -40]), triebwerk_stb: m([-15, 18, -40]), triebwerk_mitte: m([0, 18, -30]),
  banner_bb: m([23, 46, 44]), banner_stb: m([-23, 46, 44]), mast: m([0, 52, 166]),
  positionslicht_bb: m([33, 10, 127]), positionslicht_stb: m([-33, 10, 127]),
  lafette_1: m([30, 12, Z.s1]), lafette_4: m([30, 17, Z.s4]), lafette_7: m([30, 12, Z.s7]),
  lafette_3: m([-30, 12, Z.s1]), lafette_6: m([-30, 17, Z.s4]), lafette_9: m([-30, 12, Z.s7]),
  muendung_1: m([61, 15, Z.s1]), muendung_4: m([61, 16.5, Z.s4]), muendung_7: m([61, 15, Z.s7]),
  muendung_3: m([-61, 15, Z.s1]), muendung_6: m([-61, 16.5, Z.s4]), muendung_9: m([-61, 15, Z.s7]),
  muendung_2: m([0, 18, -33]), muendung_5: m([0, 28, 204]), muendung_8: m([0, 18, 240]),
  lafette_2: m([0, 18, -8]), lafette_5: m([0, 26, 188]), lafette_8: m([0, 18, 200]),
};
// Blickrichtung der Lafette in der Draufsicht, Grad, 0 = Bug, 90 = Backbord, 180 = Heck, 270 = Steuerbord
const lafettenRichtung = { 1: 90, 4: 90, 7: 90, 3: 270, 6: 270, 9: 270, 2: 180, 5: 0, 8: 0 };

const recipe = {
  id: 'schiff/lerche/rom',
  name: 'KRS Lerche (rom): drei Decks, Ausbaustufe 0-3',
  tier: 'architecture',
  palette: 'lerche',
  tags: ['schiff', 'lerche', 'rom', 'crew', 'ausbau'],
  footprint: [23, 70],
  params: {
    stufe: { default: 3, min: 0, max: 3, step: 1, label: 'Ausbaustufe (0 = 3 Waffen, 1 = 5, 2 = 7, 3 = 9)' },
  },
  let: {
    p79: 'stufe >= 1 ? 1 : 0',
    p25: 'stufe >= 2 ? 1 : 0',
    p13: 'stufe >= 3 ? 1 : 0',
    m3: 'stufe >= 1 ? 1 : 0',
    m4: 'stufe >= 2 ? 1 : 0',
  },
  variants: { stufe0: { stufe: 0 }, stufe1: { stufe: 1 }, stufe2: { stufe: 2 }, stufe3: { stufe: 3 } },
  sockets,
  socketsRichtung: lafettenRichtung,
  ops,
  anchor: ANCHOR,
};

const text = JSON.stringify(recipe, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) { console.log('✗ lerche/rom.json weicht vom Generator ab'); process.exit(1); }
  console.log('✓ lerche/rom.json unveraendert');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`✓ ${path.relative(root, OUT)}  ${ops.length} Schritte`);
}
