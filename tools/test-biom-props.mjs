// Test der Biom-Props (VOX-02 Paket 2): Footprint, Höhe, Dreiecksbudget, Gestalten über seed, Palettenunabhängigkeit, Fluid-Anschlüsse,
// Helligkeit der Steine gegen den Boden – mit Mutationsproben (absichtlich verletzte Rezepte müssen rot werden).
// Aufruf: node tools/test-biom-props.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/, schreibt nichts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { BIOME } from './biom-lib.mjs';
import { PROPS, BIOM_PALETTEN, REGELN, messe, pruefeRezept, pruefeGestalten, pruefeSteinHelligkeit, rollenVon } from './biom-props-lib.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const meldungen = (fehler) => fehler.slice(0, 3).join(' | ') + (fehler.length > 3 ? ` … (${fehler.length} Meldungen)` : '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);
for (const id of PROPS) await lib.load('models', id);
const modell = (id) => lib.get('models', id);

/** Mutation eines Rezepts: Kopie unter neuer ID registrieren und die ID zurückgeben. */
let mutN = 0;
async function mutant(id, aendere) {
  const m = structuredClone(modell(id));
  aendere(m);
  m.id = `test/mutant${++mutN}`;
  await lib.put('models', m);
  return m.id;
}
let anschluss;   // Anschlusstest je Rezept und Art, wird im Abschnitt „Fluid-Anschlüsse“ definiert und von den Mutationsproben wiederverwendet

console.log('\n== Rezepte: Footprint, Höhe, Dreiecksbudget (alle Seeds, Varianten, Anschlüsse)');
const tabelle = {};
for (const id of PROPS) {
  const r = pruefeRezept(lib, id);
  tabelle[id] = r.maxTris;
  const n = REGELN[id].faelle().length;
  ok(r.fehler.length === 0, `${id}: ${n} Fälle (Footprint 1×1, Höhe, Budget), höchste Dreiecke ${Object.entries(r.maxTris).map(([g, t]) => `${g}: ${t}`).join(', ')}${r.fehler.length ? ' – ' + meldungen(r.fehler) : ''}`);
}

console.log('\n== Rezeptkopf');
for (const id of PROPS) {
  const m = modell(id);
  ok(m.id === id && m.tags?.[0] === 'biom' && m.tier === 'detail' && JSON.stringify(m.footprint) === '[1,1]', `${id}: Tags beginnen mit "biom", Stufe detail, footprint [1,1]`);
  const budget = Math.max(...REGELN[id].faelle().map((f) => f.budget));
  ok(m.budgetTris === budget, `${id}: budgetTris ${m.budgetTris} = größtes Budget der Regel (${budget})`);
  ok(String(m.palette).startsWith('biom_'), `${id}: Standardpalette ${m.palette} ist eine Biom-Palette`);
}

console.log('\n== Spielregeln der Maße');
{
  const h = (id, params) => messe(lib, id, params).max[1];
  const halb = h('biom/wiese/findling', { hoch: 0 }), voll = h('biom/wiese/findling', { hoch: 1 });
  ok(Math.abs(halb - 0.75) <= 0.03 && Math.abs(voll - 2.06) <= 0.1, `Findling hoch 0 = ${halb.toFixed(2)} m (halbe Deckung, Kit 0,75 m), hoch 1 = ${voll.toFixed(2)} m (volle Deckung, ca. 2,1 m)`);
  const s = [0, 1, 2].map((seed) => h('biom/wiese/strauch', { seed }));
  ok(s.every((x) => x >= 1.2 && x <= 1.51), `Strauch 1,2 bis 1,5 m (sperrt von oben als Sichtblock): ${s.map((x) => x.toFixed(2)).join(' / ')} m`);
  const f = [0, 1, 2, 3].map((seed) => h('biom/wiese/farn', { seed }));
  ok(f.every((x) => x >= 0.75 && x <= 1.0) && Math.max(...f) < Math.min(...s), `Farn 0,8 bis 1,0 m, niedriger als jeder Strauch: ${f.map((x) => x.toFixed(2)).join(' / ')} m`);
  const b = [0, 1, 2, 3].map((form) => h('biom/gemein/bewuchs', { form, seed: 1 }));
  ok(b.every((x) => x <= 0.2), `Bewuchs höchstens 0,2 m (flach, keine Deckung): ${b.map((x) => x.toFixed(2)).join(' / ')} m`);
  const w = messe(lib, 'biom/gemein/fluid', { art: 0, conn: 15 });
  ok(Math.abs(w.max[1] + 0.25) <= 0.02 && w.min[1] >= -1.0 && w.max[1] < 0, `Fluid (conn 15): Oberfläche ${w.max[1].toFixed(2)} m, 25 cm unter der Lauffläche, Becken bis ${w.min[1].toFixed(2)} m`);
}

console.log('\n== Seeds: verschiedene Gestalten, deterministisch');
{
  const g = (id, fn, seedsL, min) => pruefeGestalten(lib, id, fn, seedsL, min);
  let f = g('biom/wiese/strauch', (seed) => ({ seed }), [0, 1, 2], 0.25);
  ok(f.length === 0, `Strauch seed 0, 1, 2: drei deutlich verschiedene Gestalten (mindestens 25 % Unterschied)${f.length ? ' – ' + meldungen(f) : ''}`);
  f = g('biom/wiese/strauch', (seed) => ({ seed }), [0, 3, 6], 0.04);
  ok(f.length === 0, `Strauch seed 0, 3, 6 (gleiche Gestalt): trotzdem andere Voxel durch Versatz${f.length ? ' – ' + meldungen(f) : ''}`);
  f = g('biom/wiese/farn', (seed) => ({ seed }), [0, 1, 2], 0.4);
  ok(f.length === 0, `Farn seed 0, 1, 2: drei deutlich verschiedene Gestalten (Vase, Spreizer, gemischt; mindestens 40 % Unterschied)${f.length ? ' – ' + meldungen(f) : ''}`);
  f = g('biom/wiese/farn', (seed) => ({ seed }), [0, 1, 2, 3, 4, 5], 0.15);
  ok(f.length === 0, `Farn seed 0 bis 5: paarweise mindestens 15 % verschiedene Wedel${f.length ? ' – ' + meldungen(f) : ''}`);
  for (const hoch of [0, 1]) {
    f = g('biom/wiese/findling', (seed) => ({ seed, hoch }), [0, 1, 2], 0.25);
    ok(f.length === 0, `Findling hoch ${hoch}, seed 0, 1, 2: drei verschiedene Steine${f.length ? ' – ' + meldungen(f) : ''}`);
  }
  for (const form of [0, 1, 2, 3]) {
    f = g('biom/gemein/bewuchs', (seed) => ({ seed, form }), [0, 1, 2], 0.4);
    ok(f.length === 0, `Bewuchs form ${form}, seed 0, 1, 2: verschiedene Streuung${f.length ? ' – ' + meldungen(f) : ''}`);
  }
}

console.log('\n== Palettenunabhängig (bewuchs, fluid): Rollen und Bau mit allen drei Biom-Paletten');
{
  const eigene = BIOM_PALETTEN.map((p) => new Set(Object.keys(lib.get('palettes', p).roles)));
  const gemeinsam = [...eigene[0]].filter((r) => eigene.every((s) => s.has(r)));
  ok(BIOM_PALETTEN.length === 3 && BIOME.every((b) => BIOM_PALETTEN.includes(b)), 'die drei Biom-Paletten sind die aus tools/biom-lib.mjs');
  for (const id of ['biom/gemein/bewuchs', 'biom/gemein/fluid']) {
    const r = rollenVon(modell(id)), fremd = [...r].filter((x) => !gemeinsam.includes(x));
    ok(r.size > 0 && fremd.length === 0, `${id}: nennt nur Rollen, die alle drei Biome selbst setzen (${[...r].sort().join(', ')})${fremd.length ? ' – fremd: ' + fremd.join(', ') : ''}`);
  }
  for (const [id, fallParams] of [['biom/gemein/bewuchs', [0, 1, 2, 3].map((form) => ({ form, seed: 5 }))], ['biom/gemein/fluid', [0, 1, 2].map((art) => ({ art, conn: 5, seed: 5 }))]]) {
    for (const params of fallParams) {
      let hashes = [], gebaut = true, voxel = new Set();
      for (const p of BIOM_PALETTEN) {
        try { const m = messe(lib, id, params, p); hashes.push(m.hash); voxel.add(m.voxels); } catch (e) { gebaut = false; console.log('    ' + e.message); }
      }
      ok(gebaut && voxel.size === 1 && new Set(hashes).size === 3, `${id} ${JSON.stringify(params)}: baut mit allen drei Paletten, gleiche Form, jeweils andere Farben`);
    }
  }
  const emit = (art, p) => messe(lib, 'biom/gemein/fluid', { art }, p).emit;
  ok(emit(1, 'biom_vulkan') > 0 && emit(0, 'biom_wiesenwald') === 0 && emit(0, 'biom_wueste') === 0 && emit(2, 'biom_wueste') === 0,
    `Glut nur bei Lava mit biom_vulkan: Lava ${emit(1, 'biom_vulkan')} leuchtende Voxel, Wasser (Wiesenwald, Wüste) und Treibsand 0`);
  ok(['biom_wiesenwald', 'biom_wueste', 'biom_vulkan'].every((p) => [0, 1, 2, 3].every((form) => messe(lib, 'biom/gemein/bewuchs', { form, seed: 2 }, p).emit === 0)), 'Bewuchs leuchtet in keiner Palette (auch Flechte ohne Glut)');
}

console.log('\n== Fluid-Anschlüsse (conn N1 O2 S4 W8)');
{
  // höchster Voxel in der Randreihe (Mitte der Seite, ohne Ecken): Wasserspiegel −4 (Oberkante −0,25 m) oder Uferkante −2
  const rand = (grid, seite) => {
    let m = -99;
    for (const v of grid.values()) {
      const inMitte = (a) => a >= -3 && a <= 2;
      const dazu = seite === 'N' ? v.z === -8 && inMitte(v.x) : seite === 'S' ? v.z === 7 && inMitte(v.x) : seite === 'O' ? v.x === 7 && inMitte(v.z) : v.x === -8 && inMitte(v.z);
      if (dazu) m = Math.max(m, v.y);
    }
    return m;
  };
  const BITS = { N: 1, O: 2, S: 4, W: 8 };
  anschluss = (id, art) => {
    const falsch = [];
    for (let conn = 0; conn < 16; conn++) {
      const m = messe(lib, id, { art, conn });
      for (const [s, bit] of Object.entries(BITS)) {
        const h = rand(m.grid, s), nachbar = (conn & bit) !== 0;
        if (nachbar && h !== -5) falsch.push(`conn ${conn} ${s}: Nachbar, aber Randhöhe ${h} statt Wasserspiegel −5 (nicht nahtlos)`);
        if (!nachbar && h !== -2) falsch.push(`conn ${conn} ${s}: kein Nachbar, aber Randhöhe ${h} statt Uferkante −2`);
      }
    }
    return falsch;
  };
  for (const art of [0, 1]) {
    const falsch = anschluss('biom/gemein/fluid', art);
    ok(falsch.length === 0, `art ${art} (${art ? 'Lava' : 'Wasser'}): an Seiten mit Nachbar nahtlos (Spiegelhöhe), an Seiten ohne Nachbar eine Uferkante, alle 16 conn${falsch.length ? ' – ' + meldungen(falsch) : ''}`);
  }
  const t = new Set(Array.from({ length: 16 }, (_, conn) => messe(lib, 'biom/gemein/fluid', { art: 2, conn, seed: 3 }).hash));
  ok(t.size === 1, 'Treibsand: conn ohne Wirkung (16 Werte, ein Ergebnis), ohne Ufer');
  ok(messe(lib, 'biom/gemein/fluid', { art: 2 }).max[1] < -0.08, 'Treibsand ist begehbar eingesunken (Oberfläche unter der Lauffläche, kein Rand darüber)');
}

console.log('\n== Farn: dünne Wedel (Pflanze), klar anders als der Strauch (dichter Block)');
const FARN_MIN = 350, FARN_VOX_ANTEIL = 0.15;   // mindestens 350 Dreiecke je Seed; höchstens 15 % der Voxel des kleinsten Strauchs
const farnDuenn = (id) => {
  const f = [], tr = Array.from({ length: 64 }, (_, seed) => messe(lib, id, { seed }).tris);
  if (Math.min(...tr) < FARN_MIN) f.push(`Farn: ${Math.min(...tr)} Dreiecke unter ${FARN_MIN} (zu dünn, liest sich nicht als Pflanze)`);
  const fv = Array.from({ length: 16 }, (_, seed) => messe(lib, id, { seed }).voxels), sv = Array.from({ length: 16 }, (_, seed) => messe(lib, 'biom/wiese/strauch', { seed }).voxels);
  if (Math.max(...fv) > FARN_VOX_ANTEIL * Math.min(...sv)) f.push(`Farn: bis zu ${Math.max(...fv)} Voxel, mehr als ${FARN_VOX_ANTEIL * 100} % des kleinsten Strauchs (${Math.min(...sv)}): ein Block statt dünner Wedel`);
  const fr = [...rollenVon(modell(id))];
  if (!fr.every((r) => /^plant(_dark|_light)?$/.test(r))) f.push(`Farn nutzt andere Rollen als plant*: ${fr.join(', ')}`);
  lib.buildCache.clear();
  return f;
};
{
  const f = farnDuenn('biom/wiese/farn');
  ok(f.length === 0, `Farn: 64 Seeds mindestens ${FARN_MIN} Dreiecke, höchstens ${FARN_VOX_ANTEIL * 100} % der Strauch-Voxel (dünne Wedel statt Block), nur Rollen plant*${f.length ? ' – ' + meldungen(f) : ''}`);
}

console.log('\n== Stein gegen den Boden: keine helle Kappe, kein heller Sockel (Voxelhelligkeit, alle Biom-Paletten)');
{
  let f = [];
  for (const p of BIOM_PALETTEN) for (const hoch of [0, 1]) for (const seed of [0, 1, 2, 3, 4, 5]) f.push(...pruefeSteinHelligkeit(lib, 'biom/wiese/findling', { hoch, seed }, p));
  ok(f.length === 0, `Findling: ${BIOM_PALETTEN.length} Paletten × 2 Höhen × 6 Seeds, kein Voxel heller als der Boden plus 3 L*, Kappe und Sockel nicht heller als der Körper${f.length ? ' – ' + meldungen(f) : ''}`);
}

console.log('\n== Mutationsproben (absichtlich verletzte Rezepte müssen rot werden)');
{
  const rot = (name, fehler, re) => ok(fehler.length > 0 && fehler.some((x) => re.test(x)), `Mutation ${name} → rot${fehler.length ? ` (${fehler.find((x) => re.test(x)) ?? fehler[0]})` : ' (aber keine Meldung)'}`);
  const bau = async (id, aendere) => { const mid = await mutant(id, aendere); return mid; };
  // 1. aufgeblähter Stein: ein Quader über die Kachel
  let mid = await bau('biom/wiese/findling', (m) => m.ops.push({ op: 'box', name: 'Aufgebläht', at: [-9, 0, -9], size: [18, 5, 18], color: 'stone' }));
  rot('Findling ragt über die Kachel (Quader 18 × 18 Voxel)', pruefeRezept(lib, mid, REGELN['biom/wiese/findling']).fehler, /ragt .* über die Kachel/);
  // 1b. Strauch ragt zur Seite hinaus
  mid = await bau('biom/wiese/strauch', (m) => m.ops.push({ op: 'ellipsoid', name: 'Ausleger', at: [8, 6, 0], r: [4, 4, 4], color: 'plant' }));
  rot('Strauch mit Ausleger über den Kachelrand', pruefeRezept(lib, mid, REGELN['biom/wiese/strauch']).fehler, /ragt .* über die Kachel/);
  // 2. Rezept über Budget: derselbe Strauch als glatte Ellipsoide in voller Auflösung
  mid = await bau('biom/wiese/strauch', (m) => { m.ops = [{ op: 'ellipsoid', name: 'Glatt', at: [0, 9, 0], r: [7.5, 9, 7.5], color: { noise: ['plant', 'plant_dark'], cell: 1 } }, { op: 'ellipsoid', name: 'Glatt 2', at: [0, 15, 0], r: [5, 6, 5], color: 'plant_light' }]; m.jitter = 0.035; });
  rot('Strauch über dem Dreiecksbudget (glatte Ellipsoide)', pruefeRezept(lib, mid, REGELN['biom/wiese/strauch']).fehler, /Dreiecke über dem Budget/);
  // 2b. Farn mit zu vielen Teilen
  mid = await bau('biom/wiese/farn', (m) => m.ops.push({ op: 'ellipsoid', name: 'Ballast', at: [0, 5, 0], r: [7, 5, 7], color: { noise: ['plant', 'plant_dark'], cell: 1 } }));
  rot('Farn über dem Dreiecksbudget (zusätzliche glatte Kuppel)', pruefeRezept(lib, mid, REGELN['biom/wiese/farn']).fehler, /Dreiecke über dem Budget/);
  // 2c. Farn als Block (Salat/Seerosenblätter statt Wedel), zu dünn, aus Steinrollen, seed ohne Wirkung
  mid = await bau('biom/wiese/farn', (m) => m.ops.push({ op: 'box', name: 'Blattplatte', at: [-6, 6, -6], size: [12, 3, 12], color: 'plant' }));
  rot('Farn mit Blattplatte (Block statt dünner Wedel)', farnDuenn(mid), /ein Block statt dünner Wedel/);
  mid = await bau('biom/wiese/farn', (m) => { m.ops = m.ops.slice(0, 3); });
  rot('Farn ohne Wedel (zu dünn)', farnDuenn(mid), /zu dünn/);
  mid = await bau('biom/wiese/farn', (m) => { const grau = (ops) => ops.forEach((o) => { if (typeof o.color === 'string') o.color = 'stone_dark'; if (o.ops) grau(o.ops); }); grau(m.ops); });
  rot('Farn aus Steinrollen', farnDuenn(mid), /andere Rollen/);
  mid = await bau('biom/wiese/farn', (m) => { m.let = { ...m.let, typ: '0', p: '0', H0: '14' }; m.ops = JSON.parse(JSON.stringify(m.ops).replace(/hash\(seed,/g, 'hash(0,')); });
  rot('Farn: seed ohne Wirkung', pruefeGestalten(lib, mid, (seed) => ({ seed }), [0, 1, 2], 0.4), /gleiche Gestalt/);
  // 3. Seeds ohne Wirkung
  mid = await bau('biom/wiese/strauch', (m) => { m.let.typ = '0'; m.let.ox = '0'; m.let.oz = '0'; m.let.a = '0'; });
  rot('Strauch: seed ohne Wirkung', pruefeGestalten(lib, mid, (seed) => ({ seed }), [0, 1, 2], 0.25), /gleiche Gestalt/);
  // 4. hoch ohne Wirkung: volle Deckung baut die halbe
  mid = await bau('biom/wiese/findling', (m) => { for (const op of m.ops) op.if = op.if.replace('hoch == 0', '1').replace('hoch == 1', '0'); });
  rot('Findling: hoch 1 liefert die halbe Höhe', pruefeRezept(lib, mid, REGELN['biom/wiese/findling']).fehler, /Oberkante/);
  // 5. helle Kappe auf dem Stein (Entwurf GEL-01)
  mid = await bau('biom/wiese/findling', (m) => m.ops.push({ op: 'box', name: 'Kappe hell', mode: 'paint', at: [-8, 9, -8], size: [16, 30, 16], color: '#F2F4EA' }));
  rot('Findling mit heller Kappe', pruefeSteinHelligkeit(lib, mid, { hoch: 0, seed: 0 }, 'biom_wiesenwald'), /heller als der Boden|helle Kappe/);
  mid = await bau('biom/wiese/findling', (m) => m.ops.push({ op: 'box', name: 'Sockel hell', mode: 'paint', at: [-8, 0, -8], size: [16, 2, 16], color: '#F2F4EA' }));
  rot('Findling mit hellem Sockel', pruefeSteinHelligkeit(lib, mid, { hoch: 1, seed: 0 }, 'biom_wiesenwald'), /heller als der Boden|heller Sockel/);
  // 6. Bewuchs zu hoch, nur ein Büschel in der Mitte, palettengebunden
  mid = await bau('biom/gemein/bewuchs', (m) => m.ops.push({ op: 'box', name: 'Zu hoch', at: [0, 0, 0], size: [1, 8, 1], color: 'plant' }));
  rot('Bewuchs 0,5 m hoch', pruefeRezept(lib, mid, REGELN['biom/gemein/bewuchs']).fehler, /Oberkante/);
  mid = await bau('biom/gemein/bewuchs', (m) => { m.ops = [{ op: 'box', name: 'Büschel', at: [-1, 0, -1], size: [3, 2, 3], color: 'plant' }]; });
  rot('Bewuchs als ein Büschel in der Mitte', pruefeRezept(lib, mid, REGELN['biom/gemein/bewuchs']).fehler, /Streuung/);
  mid = await bau('biom/gemein/bewuchs', (m) => { m.ops[0].color = 'primary'; });
  { const r = rollenVon(modell(mid)), eigene = BIOM_PALETTEN.map((p) => new Set(Object.keys(lib.get('palettes', p).roles)));
    rot('Bewuchs mit Kulturrolle primary (palettengebunden)', [...r].filter((x) => !eigene.every((s) => s.has(x))).map((x) => `Rolle ${x} fehlt in einer Biom-Palette`), /primary/); }
  // 7. Fluid: Becken zu tief unter der Lauffläche, Spiegel über der Lauffläche, conn ohne Wirkung
  mid = await bau('biom/gemein/fluid', (m) => m.ops.push({ op: 'box', name: 'Über der Lauffläche', at: [-8, 0, -8], size: [16, 2, 16], color: 'fluid' }));
  rot('Fluid über der Lauffläche', pruefeRezept(lib, mid, REGELN['biom/gemein/fluid']).fehler, /Oberkante/);
  mid = await bau('biom/gemein/fluid', (m) => { m.let = { cN: '0', cO: '0', cS: '0', cW: '0' }; });
  rot('Fluid: conn ohne Wirkung (immer Ufer)', anschluss(mid, 0), /nicht nahtlos/);
  mid = await bau('biom/gemein/fluid', (m) => { m.let = { cN: '1', cO: '1', cS: '1', cW: '1' }; });
  rot('Fluid: conn ohne Wirkung (nie Ufer)', anschluss(mid, 0), /Uferkante/);

}

console.log('\n== Dreiecke je Rezept (gemessen, höchster Wert über alle Fälle)');
for (const id of PROPS) console.log(`  ${id}: ${Object.entries(tabelle[id]).map(([g, t]) => `${g} ${t}`).join(' · ')}`);

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
