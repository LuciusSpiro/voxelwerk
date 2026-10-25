// ORT-01 B1: erzeugt die Anker-Modelle (Rom/Germanen) als Rezepte. node tools/gen-ort-anker.mjs
// Quelle der Wahrheit sind die erzeugten JSON-Dateien unter assets/models/ort/*; dieses Skript ist nur die Schreibhilfe.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = path.join(ROOT, 'assets/models');
const rd = (id) => JSON.parse(fs.readFileSync(path.join(M, id + '.json'), 'utf8'));
const out = (m) => { const f = path.join(M, m.id + '.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(m, null, 1) + '\n'); };
const box = (name, at, size, color, extra) => Object.assign({ op: 'box', name, at, size, color }, extra || {});
const em = (role, e) => ({ role, emit: e });
const ST = (label, max) => ({ state: { default: 0, min: 0, max, step: 1, label } });
const base = (id, name, palette, tags, footprint, params, vars, ops, extra) => Object.assign({ id, name, tier: 'detail', palette, jitter: 0, tags: ['prop', 'anker', 'ort01'].concat(tags), footprint, params, variants: vars, ops, anchor: [0, 0, 0] }, extra || {});

// ================================================================== ZIEL (state 0 frei, 1 genommen, 2 aktiviert)
out(base('ort/rom/gemein/feldstandarte', 'Feldstandarte (Rom, Anker ziel): Feldgenerator mit Amberkern in vier Marmorpfosten auf Sockel; genommen = Kern fehlt, aktiviert = Ring und Strahl',
  'rom', ['rom', 'ziel', 'feldgenerator'], [1, 1], ST('Ziel (0 frei, 1 genommen, 2 aktiviert)', 2),
  { genommen: { state: 1 }, aktiviert: { state: 2 } },
  [
    box('Sockel', [-7, 0, -7], [14, 2, 14], 'stone_light'),
    box('Sockel Feld', [-6, 2, -6], [12, 1, 12], { frame: 'trim', fill: 'secondary', axes: 'xz', width: 1 }),
    box('Sockel Rot', [-6, 2, -6], [12, 1, 12], 'primary', { if: 'state == 1', mode: 'paint' }),
    box('Kernhalter', [-3, 3, -3], [6, 2, 6], 'metal_dark'),
    box('Pfosten', [-6, 3, -6], [2, 15, 2], 'secondary', { mirror: 'xz', mirrorAt: { x: -0.5, z: -0.5 } }),
    box('Pfostenband', [-6, 9, -6], [2, 1, 2], 'trim', { mirror: 'xz', mirrorAt: { x: -0.5, z: -0.5 } }),
    box('Pfostenkapitell', [-6, 18, -6], [2, 1, 2], 'trim', { mirror: 'xz', mirrorAt: { x: -0.5, z: -0.5 } }),
    box('Ringrahmen', [-6, 19, -6], [12, 1, 12], 'trim'),
    box('Ringrahmen frei', [-5, 19, -5], [10, 1, 10], 'metal_dark', { mode: 'carve' }),
    box('Ring Licht', [-5, 19, -5], [10, 1, 10], em('glow2', 'state == 1 ? 0 : (state == 2 ? 0.6 : 0.4)'), { jitter: false }),
    box('Ring Licht frei', [-4, 19, -4], [8, 1, 8], 'metal_dark', { mode: 'carve' }),
    { op: 'ellipsoid', name: 'Kern', if: 'state != 1', at: [0, 11, 0], r: 3.5, color: em('glow2', 'state == 2 ? 1.2 : 0.9'), jitter: false },
    box('Kern Halter oben', [-1, 14, -1], [2, 4, 2], 'metal', { if: 'state != 1' }),
    box('Kernmulde', [-2, 5, -2], [4, 1, 4], 'dark', { if: 'state == 1', mode: 'paint' }),
    box('Mastrest', [-1, 5, -1], [2, 13, 2], 'metal_dark', { if: 'state == 1' }),
    box('Strahl', [-1, 20, -1], [2, 11, 2], em('glow2', 0.9), { if: 'state == 2', jitter: false }),
  ]));

out(base('ort/germanen/gemein/feldmast', 'Feldmast (Germanen, Anker ziel): Runenmast als Feldgenerator, Glutkern im Eisenkäfig, Glutring; genommen = Käfig leer, aktiviert = Ring glüht und Runenspitze',
  'nord', ['germanen', 'ziel', 'feldgenerator'], [1, 1], ST('Ziel (0 frei, 1 genommen, 2 aktiviert)', 2),
  { genommen: { state: 1 }, aktiviert: { state: 2 } },
  [
    box('Fuß', [-7, 0, -7], [14, 2, 14], 'metal_dark'),
    box('Fuß Feld', [-6, 2, -6], [12, 1, 12], { frame: 'copper_dark', fill: 'metal', axes: 'xz', width: 1 }),
    box('Fuß Rost', [-6, 2, -6], [12, 1, 12], 'alarm_dark', { if: 'state == 1', mode: 'paint' }),
    box('Ring Rahmen', [-6, 22, -6], [12, 1, 12], 'copper_dark'),
    box('Ring Rahmen frei', [-5, 22, -5], [10, 1, 10], 'metal_dark', { mode: 'carve' }),
    box('Ring Glut', [-5, 22, -5], [10, 1, 10], em('ember', 'state == 1 ? 0 : (state == 2 ? 1.2 : 0.5)'), { jitter: false }),
    box('Ring Glut frei', [-4, 22, -4], [8, 1, 8], 'metal_dark', { mode: 'carve' }),
    box('Mast', [-2, 3, -2], [4, 25, 4], { stripes: ['metal_light', 'metal'], axis: 'x', period: 1 }),
    box('Speichen x', [-5, 21, -1], [10, 1, 2], 'metal'),
    box('Speichen z', [-1, 21, -5], [2, 1, 10], 'metal'),
    box('Käfigplatte unten', [-5, 4, -5], [10, 1, 10], 'metal_dark'),
    box('Käfigstab', [-5, 5, -5], [1, 9, 1], 'metal_dark', { mirror: 'xz', mirrorAt: { x: -0.5, z: -0.5 } }),
    box('Käfigstab Mitte', [-1, 5, 4], [2, 9, 1], 'metal_dark', { if: 'state != 1' }),
    box('Käfigplatte oben', [-5, 14, -5], [10, 1, 10], 'copper_dark'),
    box('Käfig Niet', [-4, 14, 4], [1, 1, 1], 'copper', { mirror: 'x', mirrorAt: -0.5 }),
    box('Glutkern', [-3, 6, -3], [6, 7, 6], em('ember', 'state == 2 ? 1.2 : 1'), { if: 'state != 1', jitter: false }),
    box('Mast im Käfig', [-2, 5, -2], [4, 9, 4], 'metal', { if: 'state == 1' }),
    box('Schlitz oben', [-3, 15, -1], [6, 1, 2], em('ember', 'state == 1 ? 0 : 0.9'), { jitter: false }),
    box('Runenspitze', [-1, 28, -1], [2, 3, 2], em('rune', 'state == 2 ? 1.2 : 0.2'), { jitter: false }),
    box('Rune Mast', [-1, 17, 2], [2, 2, 1], em('rune', 'state == 1 ? 0 : 0.8'), { jitter: false }),
  ]));

// ================================================================== SPRENGPUNKT Station (2x2, state 0 intakt, 1 scharf, 2 zerstoert, 3 platziert)
const SPR = 'Sprengpunkt (0 intakt, 1 scharf, 2 zerstoert, 3 platziert)';
const SPRV = { scharf: { state: 1 }, zerstoert: { state: 2 }, platziert: { state: 3 } };
out(base('ort/rom/station/sprengreaktor', 'Kreuzaquädukt-Reaktor als Sprengpunkt (Rom, Anker sprengpunkt): Bestand ort/rom/station/reaktor, scharf = Haftladung mit rotem Zünder, zerstört = Gefäß aufgerissen, platziert = Ladung ohne Zünder',
  'rom', ['rom', 'sprengpunkt', 'reaktor', 'hauptstueck'], [2, 2], ST(SPR, 3), SPRV,
  [
    { op: 'use', name: 'Reaktor', model: 'ort/rom/station/reaktor', params: { last: 'state == 2 ? 0 : (state == 3 ? 1 : 2)' }, at: [0, 0, 0] },
    // Zerstört: Oberteil weg, Zacken, Trümmer
    box('Bruch Oberteil', [-8, 15, -8], [16, 14, 16], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Bruch Flanke', [3, 6, -4], [5, 9, 8], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Zacke 1', [-6, 14, -6], [3, 3, 3], 'secondary', { if: 'state == 2' }),
    box('Zacke 2', [1, 14, 3], [3, 4, 3], 'secondary', { if: 'state == 2' }),
    box('Zacke 3', [-5, 14, 2], [2, 2, 3], 'trim', { if: 'state == 2' }),
    box('Ruß Gefäß', [-7, 2, -7], [14, 13, 14], { noise: ['dark', 'metal_dark', 'secondary'], weights: [2, 2, 1], cell: 2 }, { if: 'state == 2', mode: 'paint' }),
    box('Trümmer', [-13, 2, 6], [4, 2, 4], 'secondary', { if: 'state == 2' }),
    box('Trümmer 2', [6, 2, -13], [3, 3, 3], 'stone', { if: 'state == 2' }),
    box('Trümmer 3', [-3, 2, 12], [5, 1, 3], 'trim', { if: 'state == 2' }),
    box('Glimmer', [-1, 8, 6], [2, 1, 1], em('glow2', 0.6), { if: 'state == 2', jitter: false }),
    // Ladung (scharf/platziert)
    box('Ladung vorn', [-4, 4, 6], [8, 6, 3], 'metal_dark', { if: 'state == 1 || state == 3' }),
    box('Ladung vorn Band', [-4, 6, 8], [8, 1, 1], 'warning', { if: 'state == 1 || state == 3' }),
    box('Ladung seitlich', [6, 4, -4], [3, 6, 8], 'metal_dark', { if: 'state == 1 || state == 3' }),
    box('Ladung seitlich Band', [8, 6, -4], [1, 1, 8], 'warning', { if: 'state == 1 || state == 3' }),
    box('Zünder Licht', [-1, 10, 7], [2, 1, 2], em('primary', 1.6), { if: 'state == 1', jitter: false }),
    box('Zünder Licht 2', [7, 10, -1], [2, 1, 2], em('primary', 1.6), { if: 'state == 1', jitter: false }),
    box('Zünder aus', [-1, 10, 7], [2, 1, 2], 'metal', { if: 'state == 3' }),
    box('Zünder aus 2', [7, 10, -1], [2, 1, 2], 'metal', { if: 'state == 3' }),
  ]));

out(base('ort/germanen/station/sprengreaktor', 'Schmelzofen als Sprengpunkt (Germanen, Anker sprengpunkt): Bestand ort/germanen/station/reaktor, scharf = Haftladung mit rotem Zünder, zerstört = Schacht weggesprengt, platziert = Ladung ohne Zünder',
  'nord', ['germanen', 'sprengpunkt', 'reaktor', 'hauptstueck'], [2, 2], ST(SPR, 3), SPRV,
  [
    { op: 'use', name: 'Reaktor', model: 'ort/germanen/station/reaktor', params: { last: 'state == 2 ? 0 : (state == 3 ? 1 : 2)' }, at: [0, 0, 0] },
    box('Bruch Schacht', [-10, 15, -10], [20, 18, 20], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Bruch Flanke', [-4, 4, -10], [8, 10, 4], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Stumpf 1', [-9, 15, -9], [4, 3, 4], 'metal_dark', { if: 'state == 2' }),
    box('Stumpf 2', [3, 15, 2], [5, 4, 4], 'metal', { if: 'state == 2' }),
    box('Stumpf 3', [-3, 15, 4], [3, 2, 3], 'copper_dark', { if: 'state == 2' }),
    box('Ruß Ofen', [-11, 2, -9], [22, 13, 18], { noise: ['dark', 'metal_dark', 'alarm_dark'], weights: [3, 2, 1], cell: 2 }, { if: 'state == 2', mode: 'paint' }),
    box('Trümmer', [-14, 2, 8], [4, 2, 4], 'metal_dark', { if: 'state == 2' }),
    box('Trümmer 2', [8, 2, -14], [4, 3, 4], 'metal', { if: 'state == 2' }),
    box('Trümmer 3', [-4, 2, 13], [6, 1, 3], 'copper_dark', { if: 'state == 2' }),
    box('Glutrest', [-2, 14, 5], [3, 1, 2], em('ember', 0.5), { if: 'state == 2', jitter: false }),
    box('Ladung vorn', [-4, 12, 9], [8, 5, 3], 'metal_dark', { if: 'state == 1 || state == 3' }),
    box('Ladung vorn Riemen', [-4, 14, 12], [8, 1, 1], 'warning', { if: 'state == 1 || state == 3' }),
    box('Ladung Balg', [11, 8, -4], [5, 4, 8], 'metal_dark', { if: 'state == 1 || state == 3', mirror: 'x', mirrorAt: 0 }),
    box('Ladung Balg Riemen', [11, 10, -4], [5, 1, 8], 'warning', { if: 'state == 1 || state == 3', mirror: 'x', mirrorAt: 0 }),
    box('Zünder Licht', [-1, 17, 10], [2, 1, 2], em('alarm', 1.6), { if: 'state == 1', jitter: false }),
    box('Zünder Licht Balg', [13, 12, -1], [2, 1, 2], em('alarm', 1.6), { if: 'state == 1', jitter: false, mirror: 'x', mirrorAt: 0 }),
    box('Zünder aus', [-1, 17, 10], [2, 1, 2], 'metal', { if: 'state == 3' }),
    box('Zünder aus Balg', [13, 12, -1], [2, 1, 2], 'metal', { if: 'state == 3', mirror: 'x', mirrorAt: 0 }),
  ]));

// ================================================================== SPRENGPUNKT Außenposten (1x1)
out(base('ort/rom/aussenposten/zellenbatterie', 'Zellenbatterie (Rom, Anker sprengpunkt Außenposten): Marmorblock mit drei Amber-Sichtfenstern und Amphorenhälsen unter einer Rinne; scharf = Haftladung, zerstört = aufgerissen',
  'rom', ['rom', 'sprengpunkt', 'batterie', 'aussenposten'], [1, 1], ST(SPR, 3), SPRV,
  [
    box('Sockel', [-7, 0, -6], [14, 2, 12], 'stone_light'),
    box('Körper', [-6, 2, -5], [12, 12, 10], 'secondary'),
    box('Sockelband Rot', [-6, 2, 5], [12, 3, 1], 'primary'),
    box('Fenster', [-5, 6, 5], [2, 6, 1], em('glow2', 'state == 2 ? 0 : 0.9'), { jitter: false, repeat: { count: 3, step: [4, 0, 0] } }),
    box('Fenster dunkel', [-5, 6, 5], [2, 6, 1], 'dark', { if: 'state == 2', repeat: { count: 3, step: [4, 0, 0] } }),
    box('Goldband', [-6, 14, -5], [12, 1, 10], 'trim'),
    box('Hals', [-5, 15, -1], [2, 4, 2], 'secondary', { if: 'state != 2', repeat: { count: 3, step: [4, 0, 0] } }),
    box('Halskappe', [-5, 19, -1], [2, 1, 2], em('glow2', 0.8), { if: 'state != 2', jitter: false, repeat: { count: 3, step: [4, 0, 0] } }),
    box('Rinne', [-6, 20, -1], [12, 1, 2], 'trim', { if: 'state != 2' }),
    box('Bruch', [-6, 8, -5], [7, 8, 10], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Zacke', [-6, 14, -2], [2, 3, 3], 'secondary', { if: 'state == 2' }),
    box('Zacke 2', [3, 14, 1], [3, 2, 3], 'trim', { if: 'state == 2' }),
    box('Ruß', [-6, 2, -5], [12, 13, 10], { noise: ['dark', 'secondary'], weights: [3, 2], cell: 2 }, { if: 'state == 2', mode: 'paint' }),
    box('Trümmer', [-9, 0, 2], [3, 2, 3], 'secondary', { if: 'state == 2' }),
    box('Ladung', [-4, 3, 6], [8, 6, 3], 'metal_dark', { if: 'state == 1 || state == 3' }),
    box('Ladung Band', [-4, 5, 8], [8, 1, 1], 'warning', { if: 'state == 1 || state == 3' }),
    box('Zünder', [-1, 9, 7], [2, 1, 2], em('primary', 1.6), { if: 'state == 1', jitter: false }),
    box('Zünder aus', [-1, 9, 7], [2, 1, 2], 'metal', { if: 'state == 3' }),
  ]));

out(base('ort/germanen/aussenposten/glutspeicher', 'Glutspeicher (Germanen, Anker sprengpunkt Außenposten): Klinkerblock mit drei Glutschlitzen und Kupferkappen unter dem Glutrohr; scharf = Haftladung, zerstört = aufgerissen',
  'nord', ['germanen', 'sprengpunkt', 'speicher', 'aussenposten'], [1, 1], ST(SPR, 3), SPRV,
  [
    box('Fundament', [-7, 0, -6], [14, 2, 12], 'stone_dark'),
    box('Körper', [-6, 2, -5], [12, 12, 10], { stripes: ['metal', 'primary'], axis: 'y', period: 2 }),
    box('Eckpfosten', [-6, 2, 5], [1, 12, 1], 'metal_dark', { mirror: 'x', mirrorAt: -0.5 }),
    box('Niet', [-6, 4, 5], [1, 1, 1], 'copper', { repeat: { count: 3, step: [0, 4, 0] }, mirror: 'x', mirrorAt: -0.5 }),
    box('Glutschlitz', [-5, 5, 5], [2, 7, 1], em('ember', 'state == 2 ? 0 : 1'), { jitter: false, repeat: { count: 3, step: [4, 0, 0] } }),
    box('Schlitz dunkel', [-5, 5, 5], [2, 7, 1], 'dark', { if: 'state == 2', repeat: { count: 3, step: [4, 0, 0] } }),
    box('Reifen', [-6, 14, -5], [12, 1, 10], 'copper_dark'),
    box('Kappe', [-5, 15, -1], [2, 3, 2], 'copper', { if: 'state != 2', repeat: { count: 3, step: [4, 0, 0] } }),
    box('Kappenglut', [-5, 18, -1], [2, 1, 2], em('ember', 0.9), { if: 'state != 2', jitter: false, repeat: { count: 3, step: [4, 0, 0] } }),
    box('Glutrohr', [-6, 19, -1], [12, 1, 2], 'metal_dark', { if: 'state != 2' }),
    box('Bruch', [-6, 8, -5], [7, 8, 10], 'metal_dark', { if: 'state == 2', mode: 'carve' }),
    box('Zacke', [-6, 14, -2], [2, 3, 3], 'metal', { if: 'state == 2' }),
    box('Zacke 2', [3, 14, 1], [3, 2, 3], 'copper_dark', { if: 'state == 2' }),
    box('Ruß', [-6, 2, -5], [12, 13, 10], { noise: ['dark', 'metal_dark'], weights: [3, 2], cell: 2 }, { if: 'state == 2', mode: 'paint' }),
    box('Trümmer', [-9, 0, 2], [3, 2, 3], 'metal_dark', { if: 'state == 2' }),
    box('Ladung', [-4, 3, 6], [8, 6, 3], 'metal_dark', { if: 'state == 1 || state == 3' }),
    box('Ladung Riemen', [-4, 5, 8], [8, 1, 1], 'warning', { if: 'state == 1 || state == 3' }),
    box('Zünder', [-1, 9, 7], [2, 1, 2], em('alarm', 1.6), { if: 'state == 1', jitter: false }),
    box('Zünder aus', [-1, 9, 7], [2, 1, 2], 'metal', { if: 'state == 3' }),
  ]));

// ================================================================== ZELLE (state 0 zu, 1 offen): Klon der Feldzellen mit Zustand
function zelle(kultur) {
  const src = rd(`ort/${kultur}/station/feldzelle`);
  const feld = /^(Feldlinie|Feldschwelle Fluss|Feldquerlinie|Runenfeld|Feldschwelle|Feldemitter oben)$/;
  const ops = [];
  for (const o of src.ops) {
    const c = JSON.parse(JSON.stringify(o));
    if (feld.test(c.name)) {
      c.if = 'state == 0';
      if (/Schwelle/.test(c.name) && !/Fassung/.test(c.name)) { const d = JSON.parse(JSON.stringify(o)); d.name += ' aus'; d.color = 'metal_dark'; d.if = 'state == 1'; ops.push(c, d); continue; }
    }
    ops.push(c);
  }
  const rom = kultur === 'rom';
  // Bodenfeld, damit der Zustand von oben lesbar ist; offen: Torflügel aufgeklappt
  ops.push(box('Bodenfeld', rom ? [-5, 1, -5] : [-5, 2, -5], [10, 1, 9], em(rom ? 'glow2' : 'ember', 'state == 0 ? 0.5 : 0'), { jitter: false }));
  if (rom) {
    ops.push(box('Feld aus Schwelle', [-5, 1, 4], [10, 1, 3], 'metal_dark', { if: 'state == 1' }));
    ops.push(box('Feldschalter', [-8, 8, 4], [1, 3, 2], em('glow2', 'state == 0 ? 0.9 : 0'), { jitter: false }));
    ops.push(box('Feldschalter Fassung', [-8, 7, 4], [1, 1, 2], 'trim'));
  } else {
    ops.push(box('Feldschalter', [-8, 8, 6], [1, 3, 2], em('rune', 'state == 0 ? 0.9 : 0'), { jitter: false }));
    ops.push(box('Feldschalter Fassung', [-8, 7, 6], [1, 1, 2], 'copper'));
  }
  const nm = rom ? 'Feldzelle als Anker zelle (Rom): Bogenzelle, Amber-Feldlinien und Bodenfeld an (zu) oder aus (offen)'
    : 'Stabzelle als Anker zelle (Germanen): Runenfeld und Glutschwelle an (zu) oder aus (offen)';
  return base(`ort/${kultur}/gemein/zelle`, nm, rom ? 'rom' : 'nord', [kultur, 'zelle', 'feld'], [1, 1], ST('Zelle (0 zu, 1 offen)', 1), { offen: { state: 1 } }, ops);
}
out(zelle('rom')); out(zelle('germanen'));

// ================================================================== BEUTE/FUND (state 0 voll/da, 1 leer/genommen)
const BEU = 'Beute (0 voll bzw. da, 1 leer bzw. genommen)';
out(base('ort/rom/gemein/kassenkapsel', 'Kassenkapsel (Rom, Anker beute/fund): versiegelte Marmorkapsel mit Amberschloss und rotem Deckel; leer = Deckel aufgeklappt, Schloss aus',
  'rom', ['rom', 'beute', 'fund', 'kapsel'], [1, 1], ST(BEU, 1), { leer: { state: 1 } },
  [
    box('Sockel', [-7, 0, -6], [14, 2, 12], 'stone_light'),
    box('Körper lang', [-7, 2, -4], [14, 7, 8], 'secondary'),
    box('Körper breit', [-6, 2, -6], [12, 7, 12], 'secondary'),
    box('Band quer', [-7, 4, -4], [14, 1, 8], 'trim', { mode: 'paint' }),
    box('Band tief', [-6, 4, -6], [12, 1, 12], 'trim', { mode: 'paint' }),
    box('Rinne', [-5, 5, 6], [10, 1, 1], 'trim'),
    // leer: Innenraum ausnehmen
    box('Innenraum', [-5, 6, -5], [10, 3, 10], 'metal_dark', { if: 'state == 1', mode: 'carve' }),
    box('Innenboden', [-5, 5, -5], [10, 1, 10], 'dark', { if: 'state == 1', mode: 'paint' }),
    box('Deckel', [-6, 9, -6], [12, 2, 12], 'primary', { if: 'state == 0' }),
    box('Deckelkante', [-6, 11, -6], [12, 1, 12], { frame: 'trim', fill: 'primary', axes: 'xz', width: 1 }, { if: 'state == 0' }),
    box('Siegel Rinne', [-5, 12, -1], [10, 1, 2], em('glow2', 0.7), { if: 'state == 0', jitter: false }),
    box('Deckel offen', [-6, 9, -7], [12, 9, 2], 'primary', { if: 'state == 1' }),
    box('Deckel offen Kante', [-6, 17, -7], [12, 1, 2], 'trim', { if: 'state == 1' }),
    box('Schloss', [-1, 4, 6], [2, 4, 1], em('glow2', 'state == 0 ? 1 : 0'), { jitter: false }),
    box('Schloss Fassung', [-2, 3, 6], [4, 1, 1], 'trim'),
    box('Schloss aus', [-1, 4, 6], [2, 4, 1], 'metal_dark', { if: 'state == 1' }),
  ]));

out(base('ort/germanen/gemein/fasstresor', 'Fass-Tresor (Germanen, Anker beute/fund): Eisenfass mit Kupferreifen, Runensiegel und Glutschlitz im Deckel; leer = Deckel offen, Siegel aus',
  'nord', ['germanen', 'beute', 'fund', 'fass'], [1, 1], ST(BEU, 1), { leer: { state: 1 } },
  [
    box('Fuß', [-6, 0, -6], [12, 2, 12], 'metal_dark'),
    box('Fass lang', [-6, 2, -4], [12, 9, 8], { stripes: ['metal', 'primary'], axis: 'z', period: 1 }),
    box('Fass breit', [-4, 2, -6], [8, 9, 12], { stripes: ['metal', 'primary'], axis: 'x', period: 1 }),
    box('Reifen lang', [-6, 4, -4], [12, 1, 8], 'copper_dark', { mode: 'paint' }),
    box('Reifen breit', [-4, 4, -6], [8, 1, 12], 'copper_dark', { mode: 'paint' }),
    box('Reifen oben lang', [-6, 9, -4], [12, 1, 8], 'copper_dark', { mode: 'paint' }),
    box('Reifen oben breit', [-4, 9, -6], [8, 1, 12], 'copper_dark', { mode: 'paint' }),
    box('Niet', [-5, 6, 6], [1, 1, 1], 'copper', { mirror: 'x', mirrorAt: -0.5 }),
    box('Innenraum', [-5, 8, -5], [10, 3, 10], 'metal_dark', { if: 'state == 1', mode: 'carve' }),
    box('Innenboden', [-5, 7, -5], [10, 1, 10], 'dark', { if: 'state == 1', mode: 'paint' }),
    box('Deckel', [-5, 11, -5], [10, 2, 10], 'metal_dark', { if: 'state == 0' }),
    box('Deckelreif', [-5, 13, -5], [10, 1, 10], { frame: 'copper', fill: 'metal_dark', axes: 'xz', width: 1 }, { if: 'state == 0' }),
    box('Glutschlitz', [-3, 14, -1], [6, 1, 2], em('ember', 0.9), { if: 'state == 0', jitter: false }),
    box('Deckel offen', [-5, 11, -7], [10, 9, 2], 'metal_dark', { if: 'state == 1' }),
    box('Deckel offen Reif', [-5, 19, -7], [10, 1, 2], 'copper_dark', { if: 'state == 1' }),
    box('Siegel', [-2, 5, 6], [4, 4, 1], em('rune', 'state == 0 ? 0.9 : 0'), { jitter: false }),
    box('Siegel Fassung', [-3, 4, 6], [6, 6, 1], 'copper_dark', { mode: 'under' }),
  ]));

// ================================================================== TERMINAL (state 0 bereit, 1 laedt, 2 geladen, 3 gesperrt), Wrapper um das Stations-Terminal
const TERM = 'Terminal (0 bereit, 1 lädt, 2 geladen, 3 gesperrt)';
const TERMV = { laedt: { state: 1 }, geladen: { state: 2 }, gesperrt: { state: 3 } };
const bar = (rom, lit, dim, y, z, h) => [
  box('Ladeleiste lit', [-6, y, z], [1, 1, h], em(lit[0], lit[1]), { if: 'i < n && state != 0 && state != 3', jitter: false, repeat: { count: 6, var: 'i', step: [2, 0, 0] } }),
  box('Ladeleiste leer', [-6, y, z], [1, 1, h], dim, { if: 'i >= n && state != 0 && state != 3', repeat: { count: 6, var: 'i', step: [2, 0, 0] } }),
];
out(base('ort/rom/gemein/terminal', 'Kommandopult unter Bogen als Anker terminal (Rom): Bestand ort/rom/station/terminal; lädt = Amber-Ladeleiste halb, geladen = Leiste voll und Schirm weiß, gesperrt = Sperrband',
  'rom', ['rom', 'terminal'], [1, 1], ST(TERM, 3), TERMV,
  [
    { op: 'use', name: 'Pult', model: 'ort/rom/station/terminal', params: { state: 'state == 3 ? 2 : 0', holo: 'state == 0 || state == 3' }, at: [0, 0, 0] },
    ...bar(true, ['glow2', 0.9], 'stone_light', 16, -1, 3),
    box('Schirm geladen', [-4, 14, -5], [8, 9, 1], em('glow', 0.6), { if: 'state == 2', jitter: false }),
    box('Schirm Ladebalken', [-4, 14, -5], [4, 1, 1], em('glow2', 0.9), { if: 'state == 1', jitter: false }),
  ], { let: { n: 'state == 1 ? 3 : 6' } }));
out(base('ort/germanen/gemein/terminal', 'Hochsitz-Terminal als Anker terminal (Germanen): Bestand ort/germanen/station/terminal; lädt = Glut-Ladeleiste halb, geladen = Leiste voll und Runenplatte weiß, gesperrt = Sperre',
  'nord', ['germanen', 'terminal'], [1, 1], ST(TERM, 3), TERMV,
  [
    { op: 'use', name: 'Pult', model: 'ort/germanen/station/terminal', params: { state: 'state == 3 ? 2 : 0', fell: 1 }, at: [0, 0, 0] },
    ...bar(false, ['ember', 1], 'metal_dark', 12, -2, 2),
    box('Platte geladen', [-4, 14, -4], [8, 11, 1], em('rune', 0.6), { if: 'state == 2', jitter: false }),
    box('Platte Ladebalken', [-4, 14, -4], [4, 1, 1], em('ember', 1), { if: 'state == 1', jitter: false }),
  ], { let: { n: 'state == 1 ? 3 : 6' } }));

// ================================================================== ABHOLBAKE Rom (state 0 bereit, 1 gestoert)
out(base('ort/rom/gemein/abholbake', 'Abholbake (Rom, Anker abholpunkt): Amber-Leuchtlinse im Goldkäfig auf Gunmetal-Mast mit Bodenring; gestört = Mast schief, Linse dunkel, Solarflügel hängt',
  'rom', ['rom', 'abholpunkt', 'bake'], [0.7, 0.7], ST('Abholpunkt (0 bereit, 1 gestört)', 1), { gestoert: { state: 1 } },
  [
    box('Bodenring', [-7, 0, -7], [14, 1, 14], em('glow2', 'state == 0 ? 0.6 : 0'), { jitter: false }),
    box('Bodenring frei', [-6, 0, -6], [12, 1, 12], 'metal_dark', { mode: 'carve' }),
    box('Bodenring tot', [-7, 0, -7], [14, 1, 14], 'metal_dark', { if: 'state == 1', mode: 'paint' }),
    box('Fuß', [-5, 0, -5], [10, 2, 10], 'stone_light'),
    box('Fuß Gold', [-5, 2, -5], [10, 1, 10], { frame: 'trim', fill: 'metal_dark', axes: 'xz', width: 1 }),
    box('Mast', [-1, 3, -1], [2, 10, 2], 'metal_dark', { if: 'state == 0' }),
    { op: 'line', name: 'Mast schief', if: 'state == 1', from: [0, 3, 0], to: [3, 13, 0], r: 1.2, color: 'metal_dark' },
    box('Warnband', [-1, 4, -1], [2, 2, 2], 'primary', { if: 'state == 0', mode: 'paint' }),
    box('Warnband 2', [-1, 8, -1], [2, 2, 2], 'primary', { if: 'state == 0', mode: 'paint' }),
    { op: 'group', name: 'Kopf', at: ['state == 1 ? 3 : 0', 0, 0], ops: [
      box('Käfig unten', [-3, 12, -3], [6, 1, 6], 'trim'),
      { op: 'cyl', name: 'Linse', at: [0, 13, 0], r: 2.5, h: 5, color: { role: 'glow2', emit: 'state == 0 ? 1 : 0' }, jitter: false },
      { op: 'cyl', name: 'Linse tot', if: 'state == 1', at: [0, 13, 0], r: 2.5, h: 5, color: 'glass', jitter: false },
      box('Käfig Stab', [-3, 13, -3], [1, 5, 1], 'trim', { mirror: 'xz', mirrorAt: { x: 0, z: 0 } }),
      box('Käfig oben', [-3, 18, -3], [6, 1, 6], 'trim'),
      box('Splitter', [2, 18, -3], [1, 1, 3], 'metal_dark', { if: 'state == 1', mode: 'carve' }),
      box('Kappe', [-1, 19, -1], [2, 1, 2], 'metal_dark'),
    ] },
    box('Solarflügel links', [-6, 10, -1], [3, 1, 2], 'glass'),
    box('Solarflügel rechts', [3, 10, -1], [3, 1, 2], 'glass', { if: 'state == 0' }),
    box('Solarflügel hängt', [5, 5, -1], [1, 5, 2], 'glass', { if: 'state == 1' }),
    { op: 'line', name: 'Kabel gerissen', if: 'state == 1', from: [1, 3, 1], to: [6, 1, 5], r: 0.5, color: 'metal' },
  ]));
console.log('ok');
