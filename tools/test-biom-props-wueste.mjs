// Test der Wüsten-Props (VOX-02 Paket 3): Dornbusch, Kaktus, Schichtstein, dazu die Überarbeitung von biom/gemein/fluid
// (nahtloser Treibsand, Diagonalecken `diag`) – mit Mutationsproben (absichtlich verletzte Rezepte müssen rot werden).
// Aufruf: node tools/test-biom-props-wueste.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/, schreibt nichts. Nutzt tools/biom-props-lib.mjs unverändert.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { BIOME, lstar, BODEN_ROLLEN, BIOM_PFLICHT } from './biom-lib.mjs';
import { BIOM_PALETTEN, messe, pruefeRezept, pruefeGestalten, pruefeSteinHelligkeit, pruefeFall, rollenVon } from './biom-props-lib.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const meldungen = (fehler) => fehler.slice(0, 3).join(' | ') + (fehler.length > 3 ? ` … (${fehler.length} Meldungen)` : '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);
const DORN = 'biom/wueste/dornbusch', KAKTUS = 'biom/wueste/kaktus', STEIN = 'biom/wueste/schichtstein', FLUID = 'biom/gemein/fluid';
const NEU = [DORN, KAKTUS, STEIN];
for (const id of [...NEU, FLUID]) await lib.load('models', id);
const modell = (id) => lib.get('models', id);
const seeds = (n) => Array.from({ length: n }, (_, i) => i);

/** Regeln der Wüsten-Props (Höhenbänder in Metern, Oberkante über dem Anker). */
const REGELN = {
  [DORN]: { faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 800, hoehe: [1.0, 1.45], label: `seed ${seed}` })) },
  [KAKTUS]: { faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 700, hoehe: [2.0, 2.2], label: `seed ${seed}` })) },
  [STEIN]: {
    faelle: () => [0, 1].flatMap((hoch) => seeds(64).map((seed) => ({
      params: { seed, hoch }, budget: hoch ? 900 : 500, hoehe: hoch ? [1.95, 2.15] : [0.70, 0.80], label: `hoch ${hoch} seed ${seed}`,
    }))),
  },
};
/** Fluid mit diag: alle Arten, conn und diag (Stichprobe der Seeds). Art 2 ignoriert conn und diag. Maße wie in biom-props-lib (REGELN fluid), Uferecken höchstens 6 cm unter der Lauffläche. */
const FLUID_DIAG = {
  faelle: () => [0, 1].flatMap((art) => Array.from({ length: 16 }, (_, conn) => Array.from({ length: 16 }, (_, diag) => ({
    params: { art, conn, diag, seed: conn }, budget: 400, hoehe: conn === 15 && diag === 0 ? [-0.3, -0.2] : [-0.3, -0.04], tiefe: -1.0, label: `art ${art} conn ${conn} diag ${diag}`,
  })))).flat(),
};

let mutN = 0;
async function mutant(id, aendere) {
  const m = structuredClone(modell(id));
  aendere(m);
  m.id = `test/wmutant${++mutN}`;
  await lib.put('models', m);
  return m.id;
}

console.log('\n== Rezepte: Footprint, Höhe, Dreiecksbudget (64 Seeds, beide Höhen)');
const tabelle = {};
for (const id of NEU) {
  const r = pruefeRezept(lib, id, REGELN[id]);
  tabelle[id] = r.maxTris;
  ok(r.fehler.length === 0, `${id}: ${REGELN[id].faelle().length} Fälle (Footprint 1×1, Höhe, Budget), höchste Dreiecke ${Object.entries(r.maxTris).map(([g, t]) => `${g}: ${t}`).join(', ')}${r.fehler.length ? ' – ' + meldungen(r.fehler) : ''}`);
}

console.log('\n== Rezeptkopf');
for (const id of NEU) {
  const m = modell(id);
  ok(m.id === id && m.tags?.[0] === 'biom' && m.tier === 'detail' && JSON.stringify(m.footprint) === '[1,1]', `${id}: Tags beginnen mit "biom", Stufe detail, footprint [1,1]`);
  const budget = Math.max(...REGELN[id].faelle().map((f) => f.budget));
  ok(m.budgetTris === budget, `${id}: budgetTris ${m.budgetTris} = größtes Budget der Regel (${budget})`);
  ok(m.palette === 'biom_wueste', `${id}: Standardpalette ${m.palette}`);
  const eigene = BIOM_PALETTEN.map((p) => new Set(Object.keys(lib.get('palettes', p).roles)));
  const r = rollenVon(m), fremd = [...r].filter((x) => !eigene.every((s) => s.has(x)));
  ok(r.size > 0 && fremd.length === 0, `${id}: nennt nur Rollen, die jede Biom-Palette setzt (${[...r].sort().join(', ')})${fremd.length ? ' – fremd: ' + fremd.join(', ') : ''}`);
}
ok(modell(STEIN).params.hoch.max === 1 && modell(STEIN).params.hoch.min === 0, 'Schichtstein: Parameter hoch 0 bis 1');

console.log('\n== Spielregeln der Maße');
{
  const h = (id, params) => messe(lib, id, params).max[1];
  const halb = seeds(3).map((seed) => h(STEIN, { hoch: 0, seed })), voll = seeds(3).map((seed) => h(STEIN, { hoch: 1, seed }));
  ok(halb.every((x) => Math.abs(x - 0.75) <= 0.03) && voll.every((x) => Math.abs(x - 2.06) <= 0.1), `Schichtstein hoch 0 = ${halb.map((x) => x.toFixed(2)).join('/')} m (halbe Deckung 0,75 m), hoch 1 = ${voll.map((x) => x.toFixed(2)).join('/')} m (volle Deckung ca. 2,1 m)`);
  const d = seeds(3).map((seed) => h(DORN, { seed })), k = seeds(3).map((seed) => h(KAKTUS, { seed }));
  ok(d.every((x) => x >= 1.0 && x <= 1.45), `Dornbusch 1,0 bis 1,45 m (Sichtschleier): ${d.map((x) => x.toFixed(2)).join(' / ')} m`);
  ok(k.every((x) => x >= 2.0 && x <= 2.2) && Math.min(...k) > Math.max(...d), `Kaktus 2,0 bis 2,2 m (fest und hoch), höher als jeder Dornbusch: ${k.map((x) => x.toFixed(2)).join(' / ')} m`);
  // Stein füllt die Kachel (Kollisionsbox = ganze Kachel): Ausdehnung in x und z mindestens 0,6 m
  const breit = [0, 1].flatMap((hoch) => seeds(6).map((seed) => { const m = messe(lib, STEIN, { hoch, seed }); return Math.min(m.max[0] - m.min[0], m.max[2] - m.min[2]); }));
  ok(Math.min(...breit) >= 0.6, `Schichtstein füllt die Kachel (schmalste Seite ${Math.min(...breit).toFixed(2)} m, mindestens 0,6)`);
}

console.log('\n== Seeds: verschiedene Gestalten, deterministisch');
{
  const g = (id, fn, seedsL, min) => pruefeGestalten(lib, id, fn, seedsL, min);
  const fall = [[DORN, 'Dornbusch', (seed) => ({ seed })], [KAKTUS, 'Kaktus', (seed) => ({ seed })],
    [STEIN, 'Schichtstein hoch 0', (seed) => ({ seed, hoch: 0 })], [STEIN, 'Schichtstein hoch 1', (seed) => ({ seed, hoch: 1 })]];
  for (const [id, name, fn] of fall) {
    let f = g(id, fn, [0, 1, 2], 0.25);
    ok(f.length === 0, `${name} seed 0, 1, 2: drei deutlich verschiedene Gestalten (mindestens 25 % Unterschied)${f.length ? ' – ' + meldungen(f) : ''}`);
    f = g(id, fn, [0, 3, 6], 0.03);
    ok(f.length === 0, `${name} seed 0, 3, 6 (gleiche Gestalt): trotzdem andere Voxel${f.length ? ' – ' + meldungen(f) : ''}`);
  }
}

console.log('\n== Helligkeit gegen den Boden (Wertleiter): Stein ohne Kappe und Sockel, Kaktus nicht heller als der Boden');
{
  let f = [];
  for (const p of BIOM_PALETTEN) for (const hoch of [0, 1]) for (const seed of seeds(6)) f.push(...pruefeSteinHelligkeit(lib, STEIN, { hoch, seed }, p));
  ok(f.length === 0, `Schichtstein: ${BIOM_PALETTEN.length} Paletten × 2 Höhen × 6 Seeds, kein Voxel heller als der Boden plus 3 L*, Kappe und Sockel nicht heller als der Körper${f.length ? ' – ' + meldungen(f) : ''}`);
  f = [];
  for (const seed of seeds(12)) f.push(...pruefeSteinHelligkeit(lib, KAKTUS, { seed }, 'biom_wueste'));
  ok(f.length === 0, `Kaktus: 12 Seeds, kein Voxel heller als der Boden plus 3 L*, Kopf und Fuß nicht heller als der Stamm${f.length ? ' – ' + meldungen(f) : ''}`);
  const pal = lib.palette('biom_wueste').roles, bMin = Math.min(...BODEN_ROLLEN.map((r) => lstar(pal[r].c)));
  const mittel = (id, params) => { const vs = [...messe(lib, id, params, 'biom_wueste').grid.values()]; return vs.reduce((s, v) => s + lstar(v.c), 0) / vs.length; };
  const mk = mittel(KAKTUS, { seed: 0 }), md = mittel(DORN, { seed: 0 });
  ok(mk < bMin - 6 && md < bMin, `Kaktus (Mittel L* ${mk.toFixed(1)}) liegt mindestens 6 unter dem dunkelsten Boden (${bMin.toFixed(1)}), Dornbusch (${md.toFixed(1)}) darunter (Sichtschleier eine Stufe dunkler)`);
  const emit = [DORN, KAKTUS, STEIN].reduce((s, id) => s + messe(lib, id, { seed: 1 }).emit, 0);
  ok(emit === 0, 'kein Prop leuchtet (Leuchtfarbe nur in fluid)');
}

// ---------- Fluid
/** Oberflächenfarbe je Spalte (x, z) der Kachel: Farbe des höchsten Voxels. */
function oberflaeche(grid) {
  const top = new Map();
  for (const v of grid.values()) { const k = v.x * 1000 + v.z; if (!top.has(k) || top.get(k).y < v.y) top.set(k, v); }
  return top;
}
/**
 * Nahtprobe: Ein Feld aus gleichen Kacheln (3 × 3) liest nur dann als eine Fläche, wenn über die Kachelränder dieselbe Dichte an Farbwechseln herrscht
 * wie innerhalb der Kachel (kein Muster, das in der Kachelmitte beginnt und zum Rand ausläuft: Ringe, Punkte, Mulde). Verglichen wird je Richtung die Zahl der
 * Farbwechsel benachbarter Oberflächenvoxel an der Naht (x = 7 | −8 der Nachbarkachel, ebenso z) gegen alle Paare innerhalb der Kachel.
 */
function naht(lib2, id, params, palette) {
  const t = oberflaeche(messe(lib2, id, params, palette).grid);
  const c = (x, z) => t.get(x * 1000 + z)?.c;
  const wrap = (a) => (a > 7 ? a - 16 : a);
  const r = {};
  for (const [name, dx, dz] of [['x', 1, 0], ['z', 0, 1]]) {
    let innen = 0, nInnen = 0, nahtW = 0, nNaht = 0;
    for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) {
      const ex = x + dx, ez = z + dz;
      const seam = ex > 7 || ez > 7;
      const diff = c(x, z) !== c(wrap(ex), wrap(ez)) ? 1 : 0;
      if (seam) { nahtW += diff; nNaht++; } else { innen += diff; nInnen++; }
    }
    r[name] = { innen: innen / nInnen, naht: nahtW / nNaht };
  }
  return r;
}
const nahtFehler = (r) => {
  const f = [];
  for (const [d, v] of Object.entries(r)) {
    if (v.innen === 0 && v.naht === 0) continue;   // gar kein Muster in dieser Richtung: auch nahtlos
    const q = v.naht / v.innen;
    if (!(q >= 0.5 && q <= 2)) f.push(`Richtung ${d}: Farbwechsel an der Naht ${(v.naht * 100).toFixed(1)} % gegen ${(v.innen * 100).toFixed(1)} % innerhalb (Verhältnis ${Number.isFinite(q) ? q.toFixed(2) : '∞'}, erlaubt 0,5 bis 2): das Muster endet an der Kachel`);
  }
  return f;
};

console.log('\n== Treibsand: nahtlos über Kachelränder, ruhig');
{
  const f = nahtFehler(naht(lib, FLUID, { art: 2 }, 'biom_wueste'));
  ok(f.length === 0, `Treibsand biom_wueste: Farbwechsel an der Naht wie innerhalb der Kachel${f.length ? ' – ' + f.join(' | ') : ''}`);
  for (const p of BIOM_PALETTEN) { const g = nahtFehler(naht(lib, FLUID, { art: 2 }, p)); ok(g.length === 0, `Treibsand mit ${p}: nahtlos${g.length ? ' – ' + g.join(' | ') : ''}`); }
  const hs = new Set([0, 1, 7, 99].flatMap((seed) => [0, 5, 15].map((conn) => messe(lib, FLUID, { art: 2, seed, conn, diag: 9 }).hash)));
  ok(hs.size === 1, 'Treibsand: seed, conn und diag ohne Wirkung (gleiche Kachel überall, deshalb nahtlos)');
  // ruhig: die Oberfläche hat höchstens zwei Farben, die Streifen sind 2 Voxel breit (keine Einzelpunkte), Kontrast zum Boden klein
  const t = oberflaeche(messe(lib, FLUID, { art: 2 }, 'biom_wueste').grid), farben = new Set([...t.values()].map((v) => v.c));
  ok(farben.size <= 2, `Treibsand-Oberfläche ruhig: ${farben.size} Farben (höchstens 2)`);
  const pal = lib.palette('biom_wueste').roles, Ls = [...farben].map(lstar);
  ok(Math.max(...Ls) - Math.min(...Ls) <= 12, `Treibsand-Streifen leise: ${(Math.max(...Ls) - Math.min(...Ls)).toFixed(1)} L* Unterschied (höchstens 12)`);
  // einzelne Voxel ohne gleichfarbigen Nachbarn (Punkte, Rauschen) gibt es nicht; die Streifen sind schräg gleichmäßig
  let einzel = 0;
  for (const [k, v] of t) { const x = Math.floor((k + 500) / 1000), z = k - x * 1000; const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => t.get((x + a) * 1000 + z + b)?.c === v.c).length; if (nb === 0) einzel++; }
  ok(einzel === 0, `Treibsand: keine Einzelvoxel (${einzel})`);
  void pal;
}

console.log('\n== Fluid: Diagonalecken (diag) und Gleichheit ohne diag');
const ECKEN = { NO: { conn: 3, bit: 1, x: [6, 7], z: [-8, -7] }, SO: { conn: 6, bit: 2, x: [6, 7], z: [6, 7] }, SW: { conn: 12, bit: 4, x: [-8, -7], z: [6, 7] }, NW: { conn: 9, bit: 8, x: [-8, -7], z: [-8, -7] } };
/** höchstes Voxel im 2 × 2-Eckblock; Innenecke geschlossen = Ufer (−2), Lücke = Wasserspiegel (−5) */
const eckHoehe = (grid, e) => { let m = -99; for (const v of grid.values()) if (e.x.includes(v.x) && e.z.includes(v.z)) m = Math.max(m, v.y); return m; };
/** Alle Ecken geprüft: mit passendem diag-Bit geschlossen, ohne offen, bei Nachbar fehlend ohne Wirkung. */
function pruefeDiag(lib2, id, art) {
  const f = [];
  for (const [n, e] of Object.entries(ECKEN)) {
    const mit = eckHoehe(messe(lib2, id, { art, conn: e.conn, diag: e.bit }).grid, e);
    const ohne = eckHoehe(messe(lib2, id, { art, conn: e.conn }).grid, e);
    if (ohne !== -5) f.push(`Ecke ${n} ohne diag: Höhe ${ohne}, erwartet Wasserspiegel −5 (altes Verhalten)`);
    if (mit !== -2) f.push(`Ecke ${n} mit diag ${e.bit}: Höhe ${mit}, erwartet Uferkante −2: die Lücke bleibt offen`);
    // andere Bits derselben Kachel öffnen oder schließen diese Ecke nicht
    const fremd = eckHoehe(messe(lib2, id, { art, conn: e.conn, diag: 15 - e.bit }).grid, e);
    if (fremd !== -5) f.push(`Ecke ${n}: fremde diag-Bits ändern die Ecke (Höhe ${fremd})`);
  }
  return f;
}
{
  for (const art of [0, 1]) {
    const f = pruefeDiag(lib, FLUID, art);
    ok(f.length === 0, `art ${art}: diag schließt die Lücke an allen vier Innenecken, ohne diag offen wie in Paket 2, Bits wirken je Ecke${f.length ? ' – ' + meldungen(f) : ''}`);
  }
  // diag ohne Innenecke (ein Nachbar fehlt) ändert nichts: dort liegt schon ein Ufer
  let gleich = true;
  for (const art of [0, 1]) for (let conn = 0; conn < 16; conn++) for (const [n, e] of Object.entries(ECKEN)) {
    const beide = (conn & 15) === (conn | e.conn) && (conn & e.conn) === e.conn;   // beide Nachbarn der Ecke vorhanden
    if (beide) continue;
    if (messe(lib, FLUID, { art, conn, diag: e.bit }).hash !== messe(lib, FLUID, { art, conn }).hash) gleich = false;
  }
  ok(gleich, 'diag wirkt nur, wenn beide Nachbarn der Ecke Fluid sind (sonst Ufer vorhanden, Kachel unverändert)');
  // Gleichheit zu Paket 2: Fingerabdruck aller Kacheln ohne diag (Art 0 und 1 × 16 conn × Seeds 0, 7 × 3 Paletten) gegen den Stand von 9d40838
  let h = 2166136261, n = 0;
  for (const pal of ['biom_wiesenwald', 'biom_wueste', 'biom_vulkan']) for (const art of [0, 1]) for (let conn = 0; conn < 16; conn++) for (const seed of [0, 7]) {
    const s = messe(lib, FLUID, { art, conn, seed }, pal).hash;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    n++;
  }
  const BASIS = 'a6a34910';
  ok(n === 192 && (h >>> 0).toString(16) === BASIS, `Fluid ohne diag (Wasser, Lava): ${n} Kacheln byteweise wie in Paket 2 (Fingerabdruck ${(h >>> 0).toString(16)}, erwartet ${BASIS})`);
  let gl = true;
  for (const art of [0, 1]) for (let conn = 0; conn < 16; conn++) if (messe(lib, FLUID, { art, conn, seed: 3, diag: 0 }).hash !== messe(lib, FLUID, { art, conn, seed: 3 }).hash) gl = false;
  ok(gl, 'diag 0 ausdrücklich gesetzt = Standard (gleiche Kachel)');
  ok(modell(FLUID).params.diag.default === 0 && modell(FLUID).params.diag.min === 0 && modell(FLUID).params.diag.max === 15, 'diag: Standard 0, Bereich 0 bis 15');
  const r = pruefeRezept(lib, FLUID, FLUID_DIAG);
  ok(r.fehler.length === 0, `Fluid mit allen diag-Werten: 512 Kacheln (Footprint, Höhe, Budget 400, Tiefe), höchste Dreiecke ${Object.entries(r.maxTris).map(([g, t]) => `${g}: ${t}`).join(', ')}${r.fehler.length ? ' – ' + meldungen(r.fehler) : ''}`);
  const ml = messe(lib, FLUID, { art: 0, conn: 15, diag: 15 }, 'biom_wueste');
  ok(ml.max[1] <= -0.04 + 1e-6 && ml.emit === 0, `Oase (Wasser mit biom_wueste): Ufer an allen vier Innenecken ${ml.max[1].toFixed(2)} m unter der Lauffläche, kein Leuchten`);
}

console.log('\n== Mutationsproben (absichtlich verletzte Rezepte müssen rot werden)');
{
  const rot = (name, fehler, re) => ok(fehler.length > 0 && fehler.some((x) => re.test(x)), `Mutation ${name} → rot${fehler.length ? ` (${fehler.find((x) => re.test(x)) ?? fehler[0]})` : ' (aber keine Meldung)'}`);
  // 1. Stein über der Kachel
  let mid = await mutant(STEIN, (m) => m.ops.push({ op: 'box', name: 'Aufgebläht', at: [-9, 0, -9], size: [18, 5, 18], color: 'stone' }));
  rot('Schichtstein ragt über die Kachel (Quader 18 × 18 Voxel)', pruefeRezept(lib, mid, REGELN[STEIN]).fehler, /ragt .* über die Kachel/);
  mid = await mutant(KAKTUS, (m) => m.ops.push({ op: 'box', name: 'Ausleger', at: [6, 20, -2], size: [6, 3, 4], color: 'plant' }));
  rot('Kaktus mit Arm über den Kachelrand', pruefeRezept(lib, mid, REGELN[KAKTUS]).fehler, /ragt .* über die Kachel/);
  // 2. Kaktus mit hellem Kopf
  mid = await mutant(KAKTUS, (m) => m.ops.push({ op: 'box', name: 'Kopf hell', mode: 'paint', at: [-4, 29, -4], size: [8, 6, 8], color: '#F2F4EA' }));
  rot('Kaktus mit hellem Kopf (Voxel über dem Boden)', pruefeSteinHelligkeit(lib, mid, { seed: 0 }, 'biom_wueste'), /heller als der Boden|helle Kappe/);
  mid = await mutant(KAKTUS, (m) => m.ops.push({ op: 'box', name: 'Kopf mittelhell', mode: 'paint', at: [-4, 31, -4], size: [8, 3, 8], color: 'flower' }));
  rot('Kaktus mit Blüte (flower, heller als der Boden)', pruefeSteinHelligkeit(lib, mid, { seed: 0 }, 'biom_wueste'), /heller als der Boden|helle Kappe/);
  // 3. Dornbusch über Budget
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'ellipsoid', name: 'Ballast', at: [0, 8, 0], r: [7, 7, 7], color: { noise: ['soil_dark', 'teppich'], cell: 1 } }));
  rot('Dornbusch über dem Dreiecksbudget (glatte Kugel)', pruefeRezept(lib, mid, REGELN[DORN]).fehler, /Dreiecke über dem Budget/);
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'box', name: 'Zu hoch', at: [-1, 0, -1], size: [2, 40, 2], color: 'soil_dark' }));
  rot('Dornbusch zu hoch (2,5 m, kein Sichtschleier mehr)', pruefeRezept(lib, mid, REGELN[DORN]).fehler, /Oberkante/);
  // 4. Seeds ohne Wirkung / hoch ohne Wirkung
  mid = await mutant(DORN, (m) => { m.let.typ = '0'; m.let.hh = '0'; for (const o of m.ops) for (const k of Object.keys(m.let)) if (/^[rty]\d$/.test(k)) m.let[k] = k[0] === 'r' ? '4' : k[0] === 'y' ? '6' : '16'; });
  rot('Dornbusch: seed ohne Wirkung', pruefeGestalten(lib, mid, (seed) => ({ seed }), [0, 1, 2], 0.25), /gleiche Gestalt/);
  mid = await mutant(KAKTUS, (m) => { m.let.typ = '0'; m.let.hh = '0'; m.let.ya = '9'; m.let.yb = '15'; });
  rot('Kaktus: seed ohne Wirkung', pruefeGestalten(lib, mid, (seed) => ({ seed }), [0, 1, 2], 0.25), /gleiche Gestalt/);
  mid = await mutant(STEIN, (m) => { for (const op of m.ops) op.if = op.if.replace('hoch == 0', '1').replace('hoch == 1', '0'); });
  rot('Schichtstein: hoch 1 liefert die halbe Höhe', pruefeRezept(lib, mid, REGELN[STEIN]).fehler, /Oberkante/);
  // 5. helle Kappe / heller Sockel am Stein
  mid = await mutant(STEIN, (m) => m.ops.push({ op: 'box', name: 'Kappe hell', mode: 'paint', at: [-8, 9, -8], size: [16, 30, 16], color: '#F2F4EA' }));
  rot('Schichtstein mit heller Kappe', pruefeSteinHelligkeit(lib, mid, { hoch: 0, seed: 0 }, 'biom_wueste'), /heller als der Boden|helle Kappe/);
  mid = await mutant(STEIN, (m) => m.ops.push({ op: 'box', name: 'Sockel hell', mode: 'paint', at: [-8, 0, -8], size: [16, 2, 16], color: '#F2F4EA' }));
  rot('Schichtstein mit hellem Sockel', pruefeSteinHelligkeit(lib, mid, { hoch: 1, seed: 0 }, 'biom_wueste'), /heller als der Boden|heller Sockel/);
  // 6. Treibsand mit Punktmuster (Ring um die Kachelmitte, wie in Paket 2) und mit Rand ohne Muster
  const punkt = (m) => {
    const i = m.ops.findIndex((o) => o.name === 'Treibsand');
    m.ops[i] = { op: 'group', name: 'Treibsand', if: 'art == 2', ops: [
      { op: 'box', name: 'Sand', at: [-8, -16, -8], size: [16, 14, 16], color: 'soil', jitter: false },
      { op: 'box', name: 'Ring', mode: 'paint', at: [-4, -3, -4], size: [8, 1, 8], color: 'teppich', jitter: false },
      { op: 'box', name: 'Punkt', mode: 'paint', at: [-1, -3, -1], size: [2, 1, 2], color: 'soil_dark', jitter: false },
    ] };
  };
  mid = await mutant(FLUID, punkt);
  rot('Treibsand mit Ring und Punkt in der Kachelmitte (Karomuster im Feld)', nahtFehler(naht(lib, mid, { art: 2 }, 'biom_wueste')), /Muster endet an der Kachel/);
  mid = await mutant(FLUID, (m) => { const i = m.ops.findIndex((o) => o.name === 'Treibsand'); m.ops[i].ops = m.ops[i].ops.filter((o) => o.name !== 'Streifenspalte'); m.ops[i].ops.push({ op: 'box', name: 'Fleck', mode: 'paint', at: [-2, -3, -2], size: [4, 1, 4], color: 'teppich', jitter: false }); });
  rot('Treibsand mit einem Fleck in der Mitte', nahtFehler(naht(lib, mid, { art: 2 }, 'biom_wueste')), /Muster endet an der Kachel/);
  mid = await mutant(FLUID, (m) => { const i = m.ops.findIndex((o) => o.name === 'Treibsand'); m.ops[i].ops[1].ops[0].color = 'soil'; m.ops[i].ops[1].ops[0].size = [1, 1, 1]; });
  ok(nahtFehler(naht(lib, mid, { art: 2 }, 'biom_wueste')).length === 0 && messe(lib, mid, { art: 2 }).hash !== messe(lib, FLUID, { art: 2 }).hash, 'Gegenprobe: Treibsand ganz ohne Muster (eine Farbe) ist auch nahtlos, die Probe schlägt nicht blind an');
  // 7. diag ohne Wirkung, diag schließt zu viel
  mid = await mutant(FLUID, (m) => { for (const o of m.ops) if (o.if) o.if = o.if.replace(/\([^()]*diag[^()]*\) == 1/, '0 == 1'); });
  rot('diag ohne Wirkung (Bits werden ignoriert)', pruefeDiag(lib, mid, 0), /Lücke bleibt offen/);
  mid = await mutant(FLUID, (m) => { for (const o of m.ops) if (o.if) o.if = o.if.replace(/\([^()]*diag[^()]*\) == 1/, '1 == 1'); });
  rot('diag immer gesetzt (Ecken ohne Bit geschlossen)', pruefeDiag(lib, mid, 0), /altes Verhalten|fremde diag-Bits/);
}

console.log('\n== Dreiecke je Rezept (gemessen, höchster Wert über alle Fälle)');
for (const id of NEU) console.log(`  ${id}: ${Object.entries(tabelle[id]).map(([g, t]) => `${g} ${t}`).join(' · ')}`);
void BIOME; void BIOM_PFLICHT; void pruefeFall;

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
