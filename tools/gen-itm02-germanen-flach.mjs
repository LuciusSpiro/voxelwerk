// ITM-02 Paket A: erzeugt die germanischen Fallen-Modelle falle_schott und falle_druck (flach, begehbar).
// node tools/gen-itm02-germanen-flach.mjs   Quelle der Wahrheit sind die erzeugten JSON-Dateien.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = path.join(ROOT, 'assets/models');
const out = (m) => { const f = path.join(M, m.id + '.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(m, null, 1) + '\n'); };
const box = (name, at, size, color, extra) => Object.assign({ op: 'box', name, at, size, color }, extra || {});
const MXZ = { mirror: 'xz', mirrorAt: { x: -0.5, z: -0.5 } };
const MX = { mirror: 'x', mirrorAt: -0.5 };
const lit = (role, e) => ({ role, emit: e });
const sh = (role, f) => ({ shade: role, f });
const LOCH = sh('dark', 0.3); // schwarzes Loch / Schacht
const RUSS = { noise: [sh('metal_dark', 0.78), sh('metal_dark', 0.55)], weights: [1, 1], cell: 1 };
const RUSS2 = { noise: [sh('metal_dark', 0.5), sh('dark', 1)], weights: [1, 1], cell: 1 };
const S = (n) => `state == ${n}`;

// gefaste Eisenplatte mit Plankenstreifen und Kupfernieten; state 3: verkohlt, Umriss gebrochen
const platte = () => [
  box('Platte', [-7, 0, -7], [14, 1, 14], 'metal'),
  box('Fase Ecke', [-7, 0, -7], [2, 1, 1], 'metal', Object.assign({ mode: 'carve' }, MXZ)),
  box('Fase Ecke 2', [-7, 0, -7], [1, 1, 2], 'metal', Object.assign({ mode: 'carve' }, MXZ)),
  box('Planke', [-3, 0, -7], [1, 1, 14], 'metal_light', Object.assign({ mode: 'paint' }, MX)),
  box('Niet', [-6, 1, -6], [1, 1, 1], 'copper', MXZ),
  // ausgelöst: Umriss gebrochen
  box('Bruch hinten', [2, 0, -7], [4, 1, 1], 'metal', { mode: 'carve', if: S(3) }),
  box('Bruch links', [-7, 0, 0], [1, 1, 4], 'metal', { mode: 'carve', if: S(3) }),
  box('Bruch rechts', [6, 0, 1], [1, 1, 3], 'metal', { mode: 'carve', if: S(3) }),
  box('Bruch vorn', [-5, 0, 6], [3, 1, 1], 'metal', { mode: 'carve', if: S(3) }),
  box('Bruch vorn rechts', [4, 0, 5], [2, 1, 2], 'metal', { mode: 'carve', if: S(3) }),
  box('Ruß Platte', [-7, 0, -7], [14, 2, 14], RUSS, { mode: 'paint', if: S(3) }),
  box('Ruß Niete', [-6, 1, -6], [1, 1, 1], RUSS2, Object.assign({ mode: 'paint', if: S(3) }, MXZ)),
];

const ST = { state: { default: 1, min: 0, max: 3, step: 1, label: 'Zustand (0 verborgen, 1 erkannt, 2 entschärft, 3 ausgelöst)' } };
const VAR = { verborgen: { state: 0 }, erkannt: { state: 1 }, entschaerft: { state: 2 }, ausgeloest: { state: 3 } };
const TAGS = (t) => ['prop', 'anker', 'falle', t, 'germanen'];

// ============================================================ SCHOTT: quadratische Sensorplatte mit Auge
out({
  id: 'ort/germanen/gemein/falle_schott', name: 'Falle Schott (Germanen): flache Eisenplatte mit quadratischem Auge; erkannt = rotes Auge im dunklen Rahmen, entschärft = Loch mit Deckel daneben, ausgelöst = verkohlt, Loch schwarz',
  tier: 'detail', palette: 'nord', jitter: 0, tags: TAGS('schott'), footprint: [1, 1], params: ST, variants: VAR,
  ops: [].concat(platte(), [
    // 0 verborgen: schlichter dunkler Ring, bündig
    box('Naht', [-3, 0, -3], [6, 1, 6], { frame: 'metal_dark', fill: 'metal', axes: 'xz', width: 1 }, { mode: 'paint', if: S(0) }),
    // 1 erkannt: dunkler Rahmen, rotes Auge, heller Kern
    box('Rahmen', [-4, 0, -4], [8, 2, 8], 'falle_dunkel', { if: S(1), jitter: false }),
    box('Auge', [-3, 0, -3], [6, 2, 6], lit('falle', 1.1), { if: S(1), jitter: false }),
    box('Kern', [-2, 1, -2], [4, 1, 4], lit('falle_kern', 1.3), { if: S(1), jitter: false }),
    // 2 entschärft: Loch, Deckel daneben
    box('Lochrand', [-4, 0, -4], [8, 1, 8], 'metal_dark', { mode: 'paint', if: S(2) }),
    box('Loch', [-3, 0, -3], [6, 1, 6], LOCH, { mode: 'paint', if: S(2), jitter: false }),
    box('Deckel', [3, 1, 3], [4, 1, 4], 'metal_light', { if: S(2) }),
    box('Deckel Niet', [4, 1, 4], [2, 1, 2], 'copper_dark', { mode: 'paint', if: S(2) }),
    // 3 ausgelöst: Loch schwarz, Schutt am Rand, matte Restglut in den Rissen
    box('Loch ausgelöst', [-3, 0, -3], [6, 1, 6], LOCH, { mode: 'paint', if: S(3), jitter: false }),
    box('Loch ausgelöst links', [-4, 0, -2], [1, 1, 4], LOCH, { mode: 'paint', if: S(3), jitter: false }),
    box('Loch ausgelöst rechts', [3, 0, -3], [1, 1, 5], LOCH, { mode: 'paint', if: S(3), jitter: false }),
    box('Schutt', [-4, 1, -4], [2, 1, 2], RUSS2, { if: S(3) }),
    box('Schutt 2', [3, 1, 2], [2, 1, 2], RUSS2, { if: S(3) }),
    box('Schutt 3', [2, 1, -5], [3, 1, 1], RUSS2, { if: S(3) }),
    box('Riss', [-6, 0, 2], [3, 1, 1], lit('ember_dark', 0.12), { mode: 'paint', if: S(3), jitter: false }),
    box('Riss 2', [4, 0, -5], [1, 1, 3], lit('ember_dark', 0.12), { mode: 'paint', if: S(3), jitter: false }),
  ]),
  anchor: [0, 0, 0],
});

// ============================================================ DRUCK: quadratisches Gitter mit Schlitzen
const GITTER = (name, y, hh, color, extra) => [
  box(name + ' links', [-5, y, -5], [2, hh, 10], color, extra),
  box(name + ' mitte', [-1, y, -5], [2, hh, 10], color, extra),
  box(name + ' rechts', [3, y, -5], [2, hh, 10], color, extra),
  box(name + ' quer', [-5, y, -1], [10, hh, 2], color, extra),
];
const SCHLITZ = (name, y, color, extra) => [-3, 1].flatMap((x) => [-5, 1].map((z) => box(name, [x, y, z], [2, 1, 4], color, extra)));

out({
  id: 'ort/germanen/gemein/falle_druck', name: 'Falle Druck (Germanen): flaches Eisengitter mit Schlitzen; erkannt = Schlitze glühen, entschärft = Ventilrad auf dem Gitter, ausgelöst = Gitter abgesprengt, Schacht schwarz, kleiner Dampf',
  tier: 'detail', palette: 'nord', jitter: 0, tags: TAGS('druck'), footprint: [1, 1], params: ST, variants: VAR,
  ops: [].concat(platte(), [
    // 0 verborgen: Gitterfeld nur als dunkle Naht, bündig
    box('Feld', [-5, 0, -5], [10, 1, 10], { frame: 'metal_dark', fill: 'metal', axes: 'xz', width: 1 }, { mode: 'paint', if: S(0) }),
    SCHLITZ('Schlitz zu', 0, 'metal_dark', { mode: 'paint', if: S(0) }),
    // Schacht unter dem Gitter (1, 2, 3)
    box('Schacht', [-5, 0, -5], [10, 1, 10], LOCH, { mode: 'paint', if: 'state > 0', jitter: false }),
    // 1 erkannt: Gitter leicht gewölbt, Schlitze glühen
    SCHLITZ('Schlitz glüht', 0, lit('falle', 1.1), { mode: 'paint', if: S(1), jitter: false }),
    box('Glut Kern', [-3, 0, -3], [2, 1, 2], lit('falle_kern', 1.3), { mode: 'paint', if: S(1), jitter: false }),
    box('Glut Kern 2', [1, 0, 1], [2, 1, 2], lit('falle_kern', 1.3), { mode: 'paint', if: S(1), jitter: false }),
    GITTER('Gitter', 1, 1, 'metal_light', { if: 'state == 1 || state == 2' }),
    box('Wölbung mitte', [-1, 2, -5], [2, 1, 10], 'metal_light', { if: S(1) }),
    box('Wölbung quer', [-5, 2, -1], [10, 1, 2], 'metal_light', { if: S(1) }),
    // 2 entschärft: Schlitze dunkel (Schacht), Ventilrad zugedreht auf dem Gitter
    box('Rad Kranz', [-3, 2, -3], [6, 1, 6], 'copper_dark', { if: S(2) }),
    box('Rad Kranz frei', [-2, 2, -2], [4, 1, 4], 'copper_dark', { mode: 'carve', if: S(2) }),
    box('Rad Speiche', [-3, 2, -1], [6, 1, 2], 'copper_dark', { if: S(2) }),
    box('Rad Speiche 2', [-1, 2, -3], [2, 1, 6], 'copper_dark', { if: S(2) }),
    box('Rad Nabe', [-1, 3, -1], [2, 1, 2], 'copper', { if: S(2) }),
    // 3 ausgelöst: Gitter weg, nur Reste, Schacht schwarz, Dampf hinten
    box('Rest', [-5, 1, -5], [2, 1, 3], RUSS2, { if: S(3) }),
    box('Rest 2', [-5, 1, -2], [1, 1, 1], RUSS2, { if: S(3) }),
    box('Bügel', [3, 1, 1], [2, 1, 4], RUSS2, { if: S(3) }),
    box('Rand Ruß', [-5, 1, 3], [3, 1, 2], RUSS2, { if: S(3) }),
    { op: 'ellipsoid', name: 'Dampf unten', at: [3, 2.5, -4.5], r: [2.6, 1.8, 2.2], color: 'frost_dark', if: S(3) },
    { op: 'ellipsoid', name: 'Dampf oben', at: [4, 4.3, -5], r: [2, 1.6, 1.8], color: 'frost', if: S(3) },
  ].flat()),
  anchor: [0, 0, 0],
});
console.log('ok');
