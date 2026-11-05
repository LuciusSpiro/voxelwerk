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

/** Mittleres L* aller Voxel eines gebauten Modells (biom_wueste), gemittelt über die Seeds. */
function mittelL(id, seedListe) {
  const pal = 'biom_wueste', ms = seedListe.map((seed) => { const vs = [...messe(lib, id, { seed }, pal).grid.values()]; return vs.reduce((a, v) => a + lstar(v.c), 0) / vs.length; });
  return ms.reduce((a, b) => a + b, 0) / ms.length;
}
/** Wertleiter: fest und hoch (Kaktus) ist die dunkelste Stufe, der Sichtschleier ist heller als das Feste und dunkler als der dunkelste Boden. Keine festen Zahlen aus der Palette. */
function wertleiter(id) {
  const pal = lib.palette('biom_wueste').roles, bMin = Math.min(...BODEN_ROLLEN.map((r) => lstar(pal[r].c)));
  const sl = seeds(12), mk = mittelL(KAKTUS, sl), md = mittelL(id, sl), fehler = [];
  if (!(md >= mk + 1)) fehler.push(`${id}: mittleres L* ${md.toFixed(1)} nicht mindestens 1 über dem Kaktus (${mk.toFixed(1)}): der Sichtschleier muss heller sein als das feste Prop`);
  if (!(md <= bMin - 3)) fehler.push(`${id}: mittleres L* ${md.toFixed(1)} nicht mindestens 3 unter dem dunkelsten Boden (${bMin.toFixed(1)}): Sichtschleier muss dunkler sein als der Boden`);
  return { fehler, mk, md, bMin };
}
/** Gibt es irgendwo ein volles 3 × 3-Quadrat aus Voxeln (in einer der drei Ebenen)? Dann ist es ein Klotz, kein dünner Ast. */
function hatKlotz(keys) {
  for (const k of keys) {
    const [x, y, z] = k.split(',').map(Number);
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
      let alle = true;
      for (let i = 0; i < 3 && alle; i++) for (let j = 0; j < 3; j++) { const q = [x, y, z]; q[a] += i; q[b] += j; if (!keys.has(q.join(','))) { alle = false; break; } }
      if (alle) return true;
    }
  }
  return false;
}
/**
 * Dornbusch als Sichtschleier: keine rock*-Rolle (das ist die Stufe "fest und hoch"), Äste dünn (kein 3 × 3-Klotz), mindestens 60 % Luft in der Hüllbox,
 * mindestens 350 Dreiecke (jeder Seed bleibt als Sichtblock lesbar), Silhouette geht nach oben auf (oberes Drittel breiter als das untere), einzelne plant_dark-Dornen.
 * Liefert { fehler, stat } (Dreiecke, Luft, Höhe je Seed für den Bericht).
 */
function pruefeDornbusch(id) {
  const f = [], stat = { tris: [], luft: [], hoehe: [] }, pal = lib.palette('biom_wueste').roles;
  const rollen = [...rollenVon(modell(id))].filter((r) => /^rock/.test(r));
  if (rollen.length) f.push(`${id}: nutzt die Rolle ${rollen.join(', ')} (Stufe "fest und hoch", kein Sichtschleier)`);
  const rockC = new Set(['rock', 'rock_dark'].map((r) => pal[r].c)), dorn = pal.plant_dark.c;
  for (const seed of seeds(64)) {
    const m = messe(lib, id, { seed }, 'biom_wueste'), l = `${id} seed ${seed}`;
    const bb = m.grid.bounds(), hull = (bb.max[0] - bb.min[0] + 1) * (bb.max[1] - bb.min[1] + 1) * (bb.max[2] - bb.min[2] + 1), luft = 1 - m.voxels / hull;
    stat.tris.push(m.tris); stat.luft.push(luft); stat.hoehe.push(m.max[1]);
    if (m.tris < 350) f.push(`${l}: nur ${m.tris} Dreiecke (unter 350): als Sichtblock zu dünn`);
    if (luft < 0.6) f.push(`${l}: Luftanteil ${(luft * 100).toFixed(0)} % in der Hüllbox (mindestens 60 %): zu massiv`);
    if (hatKlotz(m.keys)) f.push(`${l}: Klotz (volles 3 × 3-Quadrat): Äste dürfen nur 1 Voxel stark sein, höchstens 2 × 2`);
    const vs = [...m.grid.values()], ys = vs.map((v) => v.y), y0 = Math.min(...ys), y1 = Math.max(...ys), dr = (a) => Math.max(...a.map((v) => Math.max(Math.abs(v.x + 0.5), Math.abs(v.z + 0.5))));
    const drittel = (y1 - y0 + 1) / 3, unten = vs.filter((v) => v.y < y0 + drittel), oben = vs.filter((v) => v.y >= y1 - drittel + 1);
    if (!(dr(oben) >= dr(unten) + 1)) f.push(`${l}: Silhouette geht nicht nach oben auf (Breite oben ${dr(oben)} Voxel, unten ${dr(unten)})`);
    if (vs.some((v) => rockC.has(v.c))) f.push(`${l}: Voxel in Felsfarbe`);
    if (seed < 12 && vs.filter((v) => v.c === dorn).length < 5) f.push(`${l}: weniger als 5 Dornen-Voxel in plant_dark: liest nicht als Pflanze`);
    lib.buildCache.clear();
  }
  return { fehler: f, stat };
}

/** Regeln der Wüsten-Props (Höhenbänder in Metern, Oberkante über dem Anker). */
const REGELN = {
  [DORN]: { faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 800, hoehe: [1.0, 1.4], label: `seed ${seed}` })) },
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
  ok(d.every((x) => x >= 1.0 && x <= 1.4), `Dornbusch 1,0 bis 1,4 m (Sichtschleier): ${d.map((x) => x.toFixed(2)).join(' / ')} m`);
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
  const wl = wertleiter(DORN);
  ok(wl.fehler.length === 0, `Wertleiter: Kaktus (Mittel L* ${wl.mk.toFixed(1)}) dunkler als Dornbusch (${wl.md.toFixed(1)}) dunkler als der dunkelste Boden (${wl.bMin.toFixed(1)}); Sichtschleier heller als das Feste, dunkler als der Boden${wl.fehler.length ? ' – ' + meldungen(wl.fehler) : ''}`);
  const kk = mittel(KAKTUS, { seed: 0 });
  ok(kk < bMin - 6, `Kaktus (Mittel L* ${kk.toFixed(1)}) liegt mindestens 6 unter dem dunkelsten Boden (${bMin.toFixed(1)})`);
  const emit = [DORN, KAKTUS, STEIN].reduce((s, id) => s + messe(lib, id, { seed: 1 }).emit, 0);
  ok(emit === 0, 'kein Prop leuchtet (Leuchtfarbe nur in fluid)');
}

console.log('');
console.log('== Dornbusch: Sichtschleier (dünn, luftig, Pflanze statt Brocken)');
const dornStat = pruefeDornbusch(DORN);
{
  const { fehler, stat } = dornStat, mn = (a) => Math.min(...a), mx = (a) => Math.max(...a);
  ok(fehler.length === 0, `Dornbusch, 64 Seeds: keine rock*-Rolle, kein 3 × 3-Klotz, Luftanteil mindestens ${(mn(stat.luft) * 100).toFixed(0)} % (Vorgabe 60 %), ${mn(stat.tris)} bis ${mx(stat.tris)} Dreiecke (Vorgabe 350 bis 800), Silhouette oben breiter als unten, Dornen in plant_dark${fehler.length ? ' – ' + meldungen(fehler) : ''}`);
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

/** Welt aus 2 × 2 gleichen Kacheln: Spalte/Reihe X, Z (Voxel) liegt in der Kachel an wrap16(X), wrap16(Z). */
const wrap16 = (a) => ((((a + 8) % 16) + 16) % 16) - 8;
/**
 * Direkte Nahtprobe: Der Treibsand ist ein Muster aus schrägen Streifen (2 Voxel breit), Periode 8 Voxel in x und z: Streifen, wo ((X + Z) mod 8) < 2.
 * Verglichen wird eine 2 × 2-Kachelszene (X und Z von −8 bis 23, die Naht liegt bei 7 | 8) mit dem periodisch fortgesetzten Referenzmuster;
 * jede Abweichung (andere Periode, Versatz an der Naht, leere Reihen) ist ein Fehler. Liefert { fehler, falsch, anNaht }.
 */
function nahtDirekt(lib2, id, params, palette) {
  const t = oberflaeche(messe(lib2, id, params, palette).grid), c = (x, z) => t.get(x * 1000 + z)?.c, f = [];
  const zahl = new Map();
  for (const v of t.values()) zahl.set(v.c, (zahl.get(v.c) ?? 0) + 1);
  if (t.size !== 256) f.push('Oberfläche hat ' + t.size + ' statt 256 Spalten');
  if (zahl.size !== 2) return { fehler: [...f, zahl.size + ' Farben statt 2 (Sand und Streifen)'], falsch: -1, anNaht: -1 };
  const streifen = [...zahl.entries()].sort((a, b) => a[1] - b[1])[0][0];
  let falsch = 0, anNaht = 0;
  for (let X = -8; X < 24; X++) for (let Z = -8; Z < 24; Z++) {
    const ist = c(wrap16(X), wrap16(Z)) === streifen, soll = ((((X + Z) % 8) + 8) % 8) < 2;
    if (ist !== soll) { falsch++; if (X === 7 || X === 8 || Z === 7 || Z === 8) anNaht++; }
  }
  if (falsch) f.push(falsch + ' von 1024 Voxeln der 2 × 2-Kachelszene weichen vom periodisch fortgesetzten Muster ab (Periode 8 in x und z), davon ' + anNaht + ' an der Naht: das Muster setzt sich nicht über die Kachelgrenze fort');
  return { fehler: f, falsch, anNaht };
}
{
  for (const pal of BIOM_PALETTEN) {
    const r = nahtDirekt(lib, FLUID, { art: 2 }, pal);
    ok(r.fehler.length === 0, 'Treibsand mit ' + pal + ': 2 × 2-Kachelszene gleich dem periodisch fortgesetzten Muster (Streifen 2 Voxel, Periode 8 in x und z, Spalte 7 geht diagonal in Spalte −8 über)' + (r.fehler.length ? ' – ' + r.fehler.join(' | ') : ''));
  }
}

console.log('');
console.log('== Fluid: benannte Varianten wirken');
/** Jede benannte Variante liefert eine eigene Kachel; wo diag gesetzt ist, unterscheidet sie sich von der Variante ohne diag und von jedem anderen conn ohne diag. */
function pruefeVarianten(lib2, id, vs) {
  const f = [], h = (q) => messe(lib2, id, q).hash, alle = Object.entries(vs);
  for (const [n, v] of alle) {
    if (!v.diag) continue;
    const ohne = { ...v }; delete ohne.diag;
    if (h(v) === h(ohne)) f.push('Variante ' + n + ': diag ' + v.diag + ' wirkt nicht (gleiche Kachel wie ohne diag)');
    for (let conn = 0; conn < 16; conn++) if (h(v) === h({ ...ohne, conn })) f.push('Variante ' + n + ': gleiche Kachel wie conn ' + conn + ' ohne diag (diag wirkt nicht)');
  }
  for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) if (h(alle[i][1]) === h(alle[j][1])) f.push('Varianten ' + alle[i][0] + ' und ' + alle[j][0] + ' liefern dieselbe Kachel');
  return f;
}
{
  const vs = modell(FLUID).variants, f = pruefeVarianten(lib, FLUID, vs);
  ok(f.length === 0, 'alle ' + Object.keys(vs).length + ' benannten Varianten (' + Object.keys(vs).join(', ') + ') liefern eigene Kacheln, jede Variante mit diag unterscheidet sich von der ohne diag und von allen conn ohne diag' + (f.length ? ' – ' + meldungen(f) : ''));
  const v = vs.wasser_innenecke;
  ok(v.art === 0 && v.conn === 15 && v.diag === 1, 'wasser_innenecke: art 0, conn 15, diag 1 (beide Nachbarn der Ecke NO vorhanden, nur die Diagonale fehlt) = ' + JSON.stringify(v));
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
    const s = messe(lib, FLUID, { art, conn, seed }, pal).form;   // nur die Form (Voxelpositionen): Palettenänderungen dürfen die Gleichheit nicht brechen
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    n++;
  }
  const BASIS = 'b9cf42ed';   // Formhash des Stands von Paket 2 (9d40838), gemessen mit gleichem Verfahren
  ok(n === 192 && (h >>> 0).toString(16) === BASIS, `Fluid ohne diag (Wasser, Lava): ${n} Kacheln in der Form (Voxelpositionen) wie in Paket 2 (Formhash ${(h >>> 0).toString(16)}, erwartet ${BASIS})`);
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
  mid = await mutant(DORN, (m) => { Object.assign(m, JSON.parse(JSON.stringify(m).split('hash(seed').join('hash(0'))); m.let.typ = '0'; });
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
  // 7. diag ohne Wirkung / diag immer gesetzt: alle vier Ecken, je Ecke einzeln; Belegzahl der ersetzten Stellen
  const EXPR = { NO: 'diag % 2', SO: 'floor(diag / 2) % 2', SW: 'floor(diag / 4) % 2', NW: 'floor(diag / 8) % 2' };
  const mutiereDiag = (m, ersatz, ecken) => {
    let n = 0;
    const walk = (ops) => { for (const o of ops) { if (o.if) for (const e of ecken) { const teile = o.if.split('(' + EXPR[e] + ') == 1'); n += teile.length - 1; o.if = teile.join(ersatz); } if (o.ops) walk(o.ops); } };
    walk(m.ops);
    return n;
  };
  for (const [ersatz, name, re] of [['0 == 1', 'diag ohne Wirkung (Bits werden ignoriert)', 'mit diag'], ['1 == 1', 'diag immer gesetzt (Ecke ohne Bit geschlossen)', 'ohne diag: Höhe']]) {
    let n = 0;
    mid = await mutant(FLUID, (m) => { n = mutiereDiag(m, ersatz, Object.keys(EXPR)); });
    ok(n === 24, 'Mutation ' + name + ': alle vier Ecken ersetzt (' + n + ' Stellen, erwartet 24 = 4 Ecken × 2 Arten × 3 Quader)');
    rot(name + ', alle Ecken, Wasser', pruefeDiag(lib, mid, 0), new RegExp(re));
    rot(name + ', alle Ecken, Lava', pruefeDiag(lib, mid, 1), new RegExp(re));
    for (const e of Object.keys(EXPR)) {
      let ne = 0;
      mid = await mutant(FLUID, (m) => { ne = mutiereDiag(m, ersatz, [e]); });
      ok(ne === 6, 'Mutation ' + name + ' nur an Ecke ' + e + ': ' + ne + ' Stellen (erwartet 6)');
      rot(name + ' nur an Ecke ' + e, pruefeDiag(lib, mid, 0), new RegExp('Ecke ' + e + ' ' + re));
    }
  }
  // 8. Treibsand mit Periode 7 statt 8 (Versatz an der Naht): die alte Dichteprobe bleibt grün, die direkte Probe wird rot
  {
    let geaendert = false;
    mid = await mutant(FLUID, (m) => {
      const i2 = m.ops.findIndex((o) => o.name === 'Treibsand');
      const alt = JSON.stringify(m.ops[i2]), neu = alt.split('% 8').join('% 7').split('+ 8)').join('+ 7)').split('8 * floor').join('7 * floor');
      geaendert = alt !== neu; m.ops[i2] = JSON.parse(neu);
    });
    const r = nahtDirekt(lib, mid, { art: 2 }, 'biom_wueste');
    ok(geaendert, 'Mutation Treibsand Periode 7: Rezept geändert');
    rot('Treibsand mit Periode 7 statt 8 (Versatz an der Naht, leere Reihen)', r.fehler, /setzt sich nicht über die Kachelgrenze fort/);
    ok(r.anNaht > 0, 'Periode-7-Mutant: ' + r.falsch + ' abweichende Voxel, davon ' + r.anNaht + ' an der Naht (Spalte 7|8 oder Reihe 7|8)');
    console.log('    (Hinweis: die alte Dichteprobe nahtFehler meldet beim Periode-7-Mutanten ' + nahtFehler(naht(lib, mid, { art: 2 }, 'biom_wueste')).length + ' Fehler, daher die direkte Probe)');
  }
  // 9. benannte Variante ohne Wirkung (der Fehler aus Paket 3: conn 3 mit diag 2 hat nur die Ecke SO, die S und O braucht)
  mid = await mutant(FLUID, (m) => { m.variants.wasser_innenecke = { art: 0, conn: 3, diag: 2 }; });
  rot('Variante wasser_innenecke mit conn 3, diag 2 (diag wirkt nicht)', pruefeVarianten(lib, mid, lib.get('models', mid).variants), /wirkt nicht/);
  // 10. Dornbusch als Sichtschleier
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'box', name: 'Fels', at: [-1, 0, -1], size: [1, 3, 1], color: 'rock' }));
  rot('Dornbusch mit rock-Rolle (Stufe fest und hoch)', pruefeDornbusch(mid).fehler, /Rolle rock/);
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'box', name: 'Klotz 3x3', at: [-1, 0, -1], size: [3, 6, 3], color: 'soil_dark' }));
  rot('Dornbusch mit massivem 3 × 3-Klotz', pruefeDornbusch(mid).fehler, /Klotz/);
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'box', name: 'Block', at: [-7, 0, -7], size: [14, 12, 14], color: 'soil_dark' }));
  rot('Dornbusch als massiver Block (Luftanteil unter 60 %)', pruefeDornbusch(mid).fehler, /Luftanteil/);
  mid = await mutant(DORN, (m) => { Object.assign(m, JSON.parse(JSON.stringify(m).split('"soil_dark"').join('"plant_dark"'))); });
  rot('Dornbusch dunkler als der Kaktus (mittleres L* unter dem des Kaktus)', wertleiter(mid).fehler, /heller sein als das feste Prop/);
  mid = await mutant(DORN, (m) => { const weg = (ops) => { for (let k = ops.length - 1; k >= 0; k--) { if (/^Arme/.test(ops[k].name)) ops.splice(k, 1); else if (ops[k].ops) weg(ops[k].ops); } }; weg(m.ops); });
  rot('Dornbusch unter 350 Dreiecken (nur Stämme)', pruefeDornbusch(mid).fehler, /unter 350/);
  mid = await mutant(DORN, (m) => { const weg = (ops) => { for (let k = ops.length - 1; k >= 0; k--) { if (/Dorn|Spitze/.test(ops[k].name)) ops.splice(k, 1); else if (ops[k].ops) weg(ops[k].ops); } }; weg(m.ops); });
  rot('Dornbusch ohne Dornen (liest nicht als Pflanze)', pruefeDornbusch(mid).fehler, /Dornen-Voxel/);
  mid = await mutant(DORN, (m) => m.ops.push({ op: 'box', name: 'Fuß x', at: [-7, 0, 0], size: [15, 1, 1], color: 'soil_dark' }, { op: 'box', name: 'Fuß z', at: [0, 0, -7], size: [1, 1, 15], color: 'soil_dark' }));
  rot('Dornbusch mit breitem Fuß statt aufgehender Silhouette', pruefeDornbusch(mid).fehler, /Silhouette/);
}

console.log('\n== Dreiecke je Rezept (gemessen, höchster Wert über alle Fälle)');
for (const id of NEU) console.log(`  ${id}: ${Object.entries(tabelle[id]).map(([g, t]) => `${g} ${t}`).join(' · ')}`);
void BIOME; void BIOM_PFLICHT; void pruefeFall;

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
