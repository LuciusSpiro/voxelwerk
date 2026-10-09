// Test der Kern-Erweiterungen (SYS-KERN, B1–B3): K1 Vorlagen in use, K2 erode, K3 Paletten-adjust, K4 Ausdrücke in emit.
// Aufruf: node tools/test-kern.mjs        (Exit-Code 1 bei Fehlern)
// Arbeitet nur mit Test-Assets im Speicher – liest und schreibt keine Dateien unter assets/.
import { Library } from '../core/library.js';
import { evalNum } from '../core/expr.js';
import { hash3 } from '../core/color.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  (ist ${JSON.stringify(a)}, soll ${JSON.stringify(b)})`}`);
const throws = (fn, re, msg) => {
  try { fn(); ok(false, `${msg} (kein Fehler)`); }
  catch (e) { ok(re.test(e.message), `${msg}${re.test(e.message) ? '' : `  (Meldung: ${e.message})`}`); }
};
const rejects = async (p, re, msg) => {
  try { await p; ok(false, `${msg} (kein Fehler)`); }
  catch (e) { ok(re.test(e.message), `${msg}${re.test(e.message) ? '' : `  (Meldung: ${e.message})`}`); }
};

/** Bibliothek über ein Objekt { 'assets/models/x.json': {...} } – fehlende Pfade werfen wie im Dateisystem. */
function memLibrary(files) {
  const io = {
    json: async (p) => { if (!(p in files)) throw new Error(`ENOENT ${p}`); return structuredClone(files[p]); },
    binary: async (p) => { throw new Error(`ENOENT ${p}`); },
  };
  return new Library(io);
}
const files = {};
const addModel = (m) => { files[`assets/models/${m.id}.json`] = m; };
const addPalette = (p) => { files[`assets/palettes/${p.id}.json`] = p; };

/** Fingerabdruck eines Gitters: FNV-1a über sortierte Voxel (x,y,z,Farbe,Leuchten). */
function gridHash(grid) {
  const arr = [...grid.values()].map((v) => `${v.x},${v.y},${v.z},${v.c},${v.e}`).sort();
  let h = 2166136261;
  for (const s of arr) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + arr.length;
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0').toUpperCase();

addPalette({ id: 'base', roles: {
  primary: '#808080', secondary: '#3366CC', trim: '#FF0000', stone: '#FF0000', metal: '#808080',
  glow: { color: '#9FE8FF', emit: 1.5 },
} });

// =============================================================================================
console.log('\n== K1 Vorlagen in use');
const slot = (id, color, extraParams = {}) => addModel({
  id, tier: 'architecture', palette: 'base', params: extraParams, anchor: [0, 0, 0],
  ops: [{ name: 'Füllung', op: 'box', at: [0, 0, 0], size: [1, 1, 1], color, jitter: false }],
});
slot('t/a/x/slot', '#AA0000', { zustand: { default: 0, min: 0, max: 2 } });
slot('t/a/gemein/slot', '#00AA00');
// Neutrales Teil: wählt seine Farbe selbst per Vorlage über das durchgereichte "art" (verschachtelte Vorlage)
addModel({ id: 't/neutral/slot', tier: 'architecture', palette: 'base', anchor: [0, 0, 0],
  params: { zustand: { default: 0, min: 0, max: 2 }, art: { default: 'x', options: ['x', 'y'] } },
  ops: [{ name: 'Farbe je Art', op: 'use', model: 't/farbe/{art}', at: [0, 0, 0] }] });
slot('t/farbe/x', '#0000AA');
slot('t/farbe/y', '#0000CC');
addModel({
  id: 't/geruest', tier: 'architecture', palette: 'base',
  params: { bauweise: { default: 'a', options: ['a', 'b'] }, art: { default: 'x', options: ['x', 'y'] }, zustand: { default: 1, min: 0, max: 2 } },
  ops: [{ name: 'Steckplatz', op: 'use', model: 't/{bauweise}/{art}/slot', fallback: ['t/{bauweise}/gemein/slot', 't/neutral/slot'],
    params: { zustand: 'zustand', art: '{art}' }, at: [0, 0, 0] }],
  anchor: [0, 0, 0],
});
addModel({
  id: 't/ohne_fallback', tier: 'architecture', palette: 'base',
  params: { bauweise: { default: 'a', options: ['a', 'b'] }, art: { default: 'x', options: ['x', 'y'] } },
  ops: [{ name: 'Steckplatz', op: 'use', model: 't/{bauweise}/{art}/slot' }], anchor: [0, 0, 0],
});
addModel({
  id: 't/platzhalter_zahl', tier: 'architecture', palette: 'base',
  params: { n: { default: 1, min: 0, max: 3 } },
  ops: [{ name: 'Steckplatz', op: 'use', model: 't/{n}/slot' }],
});
addModel({
  id: 't/fehlt_hart', tier: 'architecture', palette: 'base',
  ops: [{ name: 'Teil', op: 'use', model: 't/gibt_es_nicht' }],
});
{
  const lib = memLibrary(files);
  await lib.load('models', 't/geruest');
  ok(true, 'Laden mit fehlenden Kandidaten wirft nicht');
  eq(['t/a/x/slot', 't/a/gemein/slot', 't/neutral/slot'].map((id) => !!lib.get('models', id)), [true, true, true], 'vorhandene Kandidaten geladen');
  ok(lib.missing.has('models:t/b/y/slot') && lib.missing.has('models:t/b/gemein/slot'), 'fehlende Kandidaten in lib.missing vermerkt');
  const color = (params) => hex(lib.build('t/geruest', { params }).grid.get(0, 0, 0).c);
  eq(color({ bauweise: 'a', art: 'x' }), '#AA0000', 'a/x → eigenes Teil t/a/x/slot');
  eq(color({ bauweise: 'a', art: 'y' }), '#00AA00', 'a/y → Fallback 1 t/a/gemein/slot');
  eq(color({ bauweise: 'b', art: 'x' }), '#0000AA', 'b/x → Fallback 2 t/neutral/slot (mit art=x)');
  eq(color({ bauweise: 'b', art: 'y' }), '#0000CC', 'b/y → Fallback 2, "{art}" reicht y durch (verschachtelte Vorlage)');
  eq(lib.build('t/geruest', { params: { bauweise: 'a', art: 'x' } }).grid.size, 1, 'Parameter, die das Teil nicht kennt (art), werden nicht übergeben');
  eq(lib.templateGaps('t/geruest'), [], 'templateGaps: mit Fallback keine Lücke');

  await lib.load('models', 't/ohne_fallback');
  eq(hex(lib.build('t/ohne_fallback', { params: { bauweise: 'a', art: 'x' } }).grid.get(0, 0, 0).c), '#AA0000', 'ohne Fallback: vorhandene Kombination baut');
  throws(() => lib.build('t/ohne_fallback', { params: { bauweise: 'b', art: 'y' } }),
    /Vorlage "t\/\{bauweise\}\/\{art\}\/slot" mit bauweise=b, art=y: kein Modell vorhanden \(versucht: t\/b\/y\/slot\)/,
    'fehlende Bauweise ohne Fallback → Meldung mit Vorlage und Werten');
  eq(lib.templateGaps('t/ohne_fallback').length, 3, 'templateGaps: 3 von 4 Kombinationen ohne Modell');
  await rejects(lib.load('models', 't/platzhalter_zahl'), /Platzhalter \{n\} muss ein Parameter mit "options" sein/, 'Platzhalter auf Zahl-Parameter → klare Meldung');
  await rejects(lib.load('models', 't/fehlt_hart'), /t\/gibt_es_nicht/, 'normales use ohne Vorlage bleibt Pflicht-Abhängigkeit');
}

// =============================================================================================
console.log('\n== K2 erode');
const wuerfel = (id, erode) => addModel({
  id, tier: 'architecture', palette: 'base', anchor: [0, 0, 0],
  params: { d: { default: 0.5, min: 0, max: 1, step: 0.05 } },
  ops: [{ name: 'Block', op: 'box', at: [0, 0, 0], size: [8, 8, 8], color: 'stone', jitter: false }, { name: 'Verfall', op: 'erode', ...erode }],
});
wuerfel('t/erode', { density: 'd', depth: 2 });
wuerfel('t/erode_kanten', { density: 1, depth: 1 });
wuerfel('t/erode_flaeche', { density: 1, depth: 1, edges: false });
wuerfel('t/erode_bereich', { density: 0.8, depth: 3, at: [0, 4, 0], size: [8, 4, 8] });
wuerfel('t/erode_aus', { density: 0.8, depth: 3, if: 'd > 0.6' });
{
  const lib = memLibrary(files);
  for (const id of ['t/erode', 't/erode_kanten', 't/erode_flaeche', 't/erode_bereich', 't/erode_aus']) await lib.load('models', id);
  const b = (id, params) => lib.build(id, { params }).grid;
  const h1 = gridHash(b('t/erode', { seed: 1 })), h1b = gridHash(b('t/erode', { seed: 1, d: 0.5 })), h2 = gridHash(b('t/erode', { seed: 2 }));
  ok(h1 === h1b, `gleicher seed → gleicher Voxel-Hash (${h1})`);
  ok(h1 !== h2, `anderer seed → anderer Voxel-Hash (${h2})`);
  // unabhängig vom Build-Cache: frische Bibliothek, gleicher seed
  const lib2 = memLibrary(files); await lib2.load('models', 't/erode');
  eq(gridHash(lib2.build('t/erode', { params: { seed: 1 } }).grid), h1, 'frische Bibliothek, gleicher seed → gleicher Hash');
  const n = b('t/erode', { seed: 1 }).size;
  ok(n < 512 && n > 400, `density 0.5, depth 2: ${512 - n} von 512 Voxeln abgetragen`);
  eq(b('t/erode', { seed: 1, d: 0 }).size, 512, 'density 0 → nichts abgetragen');
  // density 1, depth 1, Kanten: obere 4 Kanten (8·8 − 6·6 = 28) + 4 senkrechte Kanten unter der Oberkante (4·7 = 28);
  // die Unterkante steht auf dem Boden und zählt nicht als Kante
  eq(b('t/erode_kanten').size, 512 - 56, 'density 1 + edges: genau die 56 Kanten-Voxel weg, Boden bleibt');
  ok(b('t/erode_kanten').has(4, 7, 4) && b('t/erode_kanten').has(0, 0, 4), 'Flächenmitte oben und Unterkante bleiben stehen');
  // edges false: eine Schicht an allen freien Seiten weg (Unterseite steht auf dem Boden) → 6 × 7 × 6 bleiben
  eq(b('t/erode_flaeche').size, 6 * 7 * 6, 'edges: false → ganze freie Oberfläche eine Schicht tief (Boden zählt nicht als frei)');
  const reg = b('t/erode_bereich', { seed: 3 });
  let unten = 0; for (const v of reg.values()) if (v.y < 4) unten++;
  ok(unten === 256 && reg.size < 512, `at/size: nur oberhalb y = 4 abgetragen (unten ${unten}/256, gesamt ${reg.size})`);
  eq(b('t/erode_aus', { d: 0.5 }).size, 512, '"if" schaltet erode ab');
  const grob = b('t/erode', { seed: 4, d: 0.9 });
  const allein = [...grob.values()].filter((v) => v.y > 0 && ![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some((d) => grob.has(v.x + d[0], v.y + d[1], v.z + d[2])));
  eq(allein.length, 0, `density 0.9: keine schwebenden Einzel-Voxel (${grob.size} Voxel übrig)`);
}

// =============================================================================================
console.log('\n== K3 Paletten-adjust');
addPalette({ id: 'p_basis', roles: { rot: '#FF0000', blau: '#3366CC', grau: '#808080', glow: { color: '#9FE8FF', emit: 1.5 } } });
addPalette({ id: 'p_sat', extends: 'p_basis', adjust: { sat: 0.5 } });
addPalette({ id: 'p_light', extends: 'p_basis', adjust: { light: 0.5 } });
addPalette({ id: 'p_tint', extends: 'p_basis', adjust: { tint: '#FF0000', mix: 0.5 } });
addPalette({ id: 'p_grau', extends: 'p_basis', adjust: { sat: 0, roles: ['rot', 'blau'] }, roles: { neu: '#FF0000', ref: 'rot' } });
addPalette({ id: 'p_except', extends: 'p_basis', adjust: { light: 0.5, except: ['glow'] } });
addPalette({ id: 'p_enkel', extends: 'p_light', adjust: { tint: '#000000', mix: 0.5, roles: ['grau'] } });
addPalette({ id: 'p_tippfehler', extends: 'p_basis', adjust: { sat: 0.5, roles: ['rott'] } });
addPalette({ id: 'p_ohne_mix', extends: 'p_basis', adjust: { tint: '#FF0000' } });
{
  const lib = memLibrary(files);
  for (const id of ['p_sat', 'p_light', 'p_tint', 'p_grau', 'p_except', 'p_enkel', 'p_tippfehler', 'p_ohne_mix']) await lib.load('palettes', id);
  const R = (pal, role) => hex(lib.palette(pal).roles[role].c);
  // Tabelle: Palette, Rolle, erwarteter Wert (von Hand über HSL gerechnet)
  const table = [
    ['p_sat', 'rot', '#BF4040'], ['p_sat', 'blau', '#5973A6'], ['p_sat', 'grau', '#808080'],
    ['p_light', 'rot', '#800000'], ['p_light', 'grau', '#404040'],
    ['p_tint', 'grau', '#C04040'], ['p_tint', 'rot', '#FF0000'],
    ['p_grau', 'rot', '#808080'], ['p_grau', 'blau', '#808080'], ['p_grau', 'grau', '#808080'], ['p_grau', 'glow', '#9FE8FF'],
    ['p_grau', 'neu', '#FF0000'], ['p_grau', 'ref', '#808080'],
    ['p_except', 'rot', '#800000'], ['p_except', 'glow', '#9FE8FF'],
    ['p_enkel', 'grau', '#202020'], ['p_enkel', 'rot', '#800000'],
  ];
  for (const [pal, role, want] of table) eq(R(pal, role), want, `${pal}.${role} = ${want}`);
  eq(lib.palette('p_light').roles.glow.e, 1.5, 'adjust lässt das Leuchten (emit) unverändert');
  eq(R('p_basis', 'rot'), '#FF0000', 'Elternpalette bleibt unverändert');
  throws(() => lib.palette('p_tippfehler'), /adjust nennt unbekannte Rolle "rott"/, 'unbekannte Rolle in adjust.roles → Fehler');
  throws(() => lib.palette('p_ohne_mix'), /adjust\.tint braucht adjust\.mix/, 'tint ohne mix → Fehler');
}

// =============================================================================================
console.log('\n== K4 Ausdrücke in emit');
{
  eq(evalNum('hash(1, 2)', {}), hash3(1, 2, 0, 0), 'hash(a, b) == hash3(a, b, 0, 0)');
  eq(evalNum('hash(3, 4, 5, seed)', { seed: 9 }), hash3(3, 4, 5, 9), 'hash(x, y, z, seed) == hash3');
  const h = evalNum('hash(seed, 7)', { seed: 42 });
  ok(h >= 0 && h < 1 && h === evalNum('hash(seed, 7)', { seed: 42 }), `hash liegt in [0, 1) und ist stabil (${h.toFixed(4)})`);
  ok(evalNum('hash(1, 2)', {}) !== evalNum('hash(2, 1)', {}), 'hash hängt von der Reihenfolge ab');
  ok(evalNum('hash(1.7, 2)', {}) === evalNum('hash(1, 2)', {}), 'hash rundet Argumente ab');

  addModel({
    id: 't/glut', tier: 'detail', palette: 'base', anchor: [0, 0, 0],
    params: { heat: { default: 0, min: 0, max: 3, step: 1 } },
    ops: [
      { name: 'Lauf', op: 'box', at: [0, 0, 0], size: [1, 1, 1], color: 'metal', emit: '0.3 + heat * 0.5', jitter: false },
      { name: 'Kristall', op: 'box', at: [1, 0, 0], size: [1, 1, 1], color: 'glow', emit: 'heat > 0 ? 2 : 0', jitter: false },
      { name: 'Blech', op: 'box', at: [2, 0, 0], size: [1, 1, 1], color: { shade: 'metal', f: '1 + heat * 0.1' }, jitter: false },
      { name: 'Ader', op: 'box', at: [3, 0, 0], size: [1, 1, 1], color: { role: 'glow', emit: 'heat * 0.4' }, jitter: false },
      { name: 'Streifen', op: 'box', at: [4, 0, 0], size: [1, 3, 1], color: { stripes: ['trim', 'metal'], axis: 'y', period: 'heat + 1' }, jitter: false },
    ],
  });
  addModel({ id: 't/glut_kaputt', tier: 'detail', palette: 'base', ops: [{ name: 'x', op: 'box', at: [0, 0, 0], size: [1, 1, 1], emit: 'hitze * 2' }] });
  const lib = memLibrary(files);
  await lib.load('models', 't/glut'); await lib.load('models', 't/glut_kaputt');
  const g = (heat) => lib.build('t/glut', { params: { heat } }).grid;
  eq(g(2).get(0, 0, 0).e, 1.3, 'emit "0.3 + heat * 0.5" bei heat 2 → 1.3');
  eq(g(0).get(0, 0, 0).e, 0.3, 'emit-Ausdruck bei heat 0 → 0.3');
  eq(g(0).get(1, 0, 0).e, 0, 'gesetztes emit 0 gilt auch auf einer Leucht-Rolle (glow aus)');
  eq(g(1).get(1, 0, 0).e, 2, 'emit-Bedingung heat > 0 → 2');
  eq(hex(g(2).get(2, 0, 0).c), '#999999', '{ shade, f: "1 + heat * 0.1" } bei heat 2 → #999999');
  ok(Math.abs(g(3).get(3, 0, 0).e - 1.2) < 1e-9, '{ role: glow, emit: "heat * 0.4" } bei heat 3 → 1.2');
  eq([0, 1, 2].map((y) => hex(g(1).get(4, y, 0).c)), ['#FF0000', '#FF0000', '#808080'], 'stripes period "heat + 1" bei heat 1');
  throws(() => lib.build('t/glut_kaputt'), /unbekannter Parameter "hitze"/, 'unbekannter Name im emit-Ausdruck → klare Meldung');
}

// =============================================================================================
console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
