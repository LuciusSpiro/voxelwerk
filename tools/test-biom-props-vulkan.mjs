// Test der Vulkan-Props (VOX-02 Paket 4): Aschefarn, Basalt, Schlot sowie Bewuchs und Lava mit biom_vulkan.
// Footprint, Höhe, Dreiecksbudget, Gestalten über seed, Helligkeit (Schlot am dunkelsten, kein heller Stein), Asche bleibt grau,
// Leuchten nur in der Rolle fluid – mit Mutationsproben (absichtlich verletzte Rezepte müssen rot werden).
// Aufruf: node tools/test-biom-props-vulkan.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/, schreibt nichts. Nutzt tools/biom-props-lib.mjs unverändert.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { lstar, SCHWELLEN, BODEN_ROLLEN } from './biom-lib.mjs';
import { messe, pruefeRezept, pruefeGestalten, pruefeSteinHelligkeit, rollenVon } from './biom-props-lib.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const meldungen = (fehler) => fehler.slice(0, 3).join(' | ') + (fehler.length > 3 ? ` … (${fehler.length} Meldungen)` : '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);

const FARN = 'biom/vulkan/aschefarn', BASALT = 'biom/vulkan/basalt', SCHLOT = 'biom/vulkan/schlot';
const BEWUCHS = 'biom/gemein/bewuchs', FLUID = 'biom/gemein/fluid';
const PAL = 'biom_vulkan';
const VULKAN = [FARN, BASALT, SCHLOT];
for (const id of [...VULKAN, BEWUCHS, FLUID]) await lib.load('models', id);
const modell = (id) => lib.get('models', id);
const seeds = (n) => Array.from({ length: n }, (_, i) => i);

/** Fälle je Rezept wie in tools/biom-props-lib.mjs (REGELN): Parameter, Budget, Höhenband in Metern. */
const REGELN = {
  [FARN]: { faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 600, hoehe: [0.8, 1.0], label: `seed ${seed}` })) },
  [BASALT]: {
    faelle: () => [0, 1].flatMap((hoch) => seeds(64).map((seed) => ({
      params: { seed, hoch }, budget: hoch ? 900 : 500, hoehe: hoch ? [1.95, 2.15] : [0.70, 0.80], label: `hoch ${hoch} seed ${seed}`,
    }))),
  },
  [SCHLOT]: { faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 800, hoehe: [1.5, 2.0], label: `seed ${seed}` })) },
};

/** Mutation eines Rezepts: Kopie unter neuer ID registrieren und die ID zurückgeben. */
let mutN = 0;
async function mutant(id, aendere) {
  const m = structuredClone(modell(id));
  aendere(m);
  m.id = `test/vulkan-mutant${++mutN}`;
  await lib.put('models', m);
  return m.id;
}

const pal = lib.palette(PAL).roles;
const L = (rolle) => lstar(pal[rolle].c);
const boden = BODEN_ROLLEN.map(L), bMax = Math.max(...boden);
const lava = (v) => v.c === pal.fluid.c || v.c === pal.fluid_v.c;   // Lava-Voxel (Rolle fluid, fluid_v) sind ausgenommen: Lava ist nicht Fels und nicht Asche
const chroma = (c) => (Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) - Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255)) / 255;

/** Leuchten nur in der Rolle fluid: ohne `muendung` darf kein Voxel leuchten; mit `muendung` nur kleine Fläche ganz oben, in Farbe fluid. */
function pruefeLeuchten(id, params, muendung) {
  const f = [], l = `${id} ${JSON.stringify(params)}`;
  const m = messe(lib, id, params, PAL), a = m.built.anchor;
  const hell = [...m.grid.values()].filter((v) => v.e > 0);
  if (!muendung) {
    if (hell.length) f.push(`${l}: ${hell.length} leuchtende Voxel (Leuchten ist nur in der Rolle fluid erlaubt)`);
    return f;
  }
  if (!hell.length) f.push(`${l}: die Mündung leuchtet nicht (Lava fehlt)`);
  const fremd = hell.filter((v) => v.c !== pal.fluid.c).length;
  if (fremd) f.push(`${l}: ${fremd} leuchtende Voxel sind nicht in der Rolle fluid (Fels leuchtet)`);
  const ausserhalb = hell.filter((v) => Math.abs((v.x + 0.5 - a[0]) / 16) > 0.22 || Math.abs((v.z + 0.5 - a[2]) / 16) > 0.22 || (v.y - a[1]) / 16 < m.max[1] - 0.13).length;
  if (ausserhalb) f.push(`${l}: ${ausserhalb} leuchtende Voxel außerhalb der Mündung (oben, höchstens ±0,22 m um die Mitte)`);
  if (hell.length > 20) f.push(`${l}: ${hell.length} leuchtende Voxel, die Mündung soll klein bleiben (höchstens 20)`);
  return f;
}

/** Schlot: fest und hoch = die dunkelste Stufe. Alle Fels-Voxel (ohne Lava) mindestens `festAbstand` dunkler als Teppich, stone_dark und stone. */
function pruefeSchlotDunkel(id, params) {
  const f = [], l = `${id} ${JSON.stringify(params)}`;
  const m = messe(lib, id, params, PAL);
  const grenze = Math.min(L('teppich'), L('stone_dark'), L('stone')) - SCHWELLEN.festAbstand;
  const hellste = Math.max(...[...m.grid.values()].filter((v) => !lava(v)).map((v) => lstar(v.c)));
  if (hellste > grenze + 0.5) f.push(`${l}: Fels L* ${hellste.toFixed(1)} ist heller als ${grenze.toFixed(1)} (Teppich/Stein minus ${SCHWELLEN.festAbstand}): der Schlot ist nicht das Dunkelste`);
  return f;
}

/** Keine Voxel heller als der hellste Boden plus `steinKappe` und Asche bleibt grau (Buntheit der Voxelfarbe höchstens 0,08), ausgenommen Lava. */
function pruefeAsche(id, params) {
  const f = [], l = `${id} ${JSON.stringify(params)}`;
  const m = messe(lib, id, params, PAL);
  const vs = [...m.grid.values()].filter((v) => !lava(v));
  const zuHell = vs.filter((v) => lstar(v.c) > bMax + SCHWELLEN.steinKappe + 0.5);
  if (zuHell.length) f.push(`${l}: ${zuHell.length} Voxel heller als der Boden plus ${SCHWELLEN.steinKappe}`);
  const bunt = vs.filter((v) => chroma(v.c) > 0.08);
  if (bunt.length) f.push(`${l}: ${bunt.length} Voxel nicht grau (Buntheit über 0,08, die Asche würde braun oder grün)`);
  return f;
}

console.log('\n== Rezepte: Footprint, Höhe, Dreiecksbudget (alle Seeds und Varianten)');
const tabelle = {};
for (const id of VULKAN) {
  const r = pruefeRezept(lib, id, REGELN[id], PAL);
  tabelle[id] = r.maxTris;
  ok(r.fehler.length === 0, `${id}: ${REGELN[id].faelle().length} Fälle (Footprint 1×1, Höhe, Budget), höchste Dreiecke ${Object.entries(r.maxTris).map(([g, t]) => `${g}: ${t}`).join(', ')}${r.fehler.length ? ' – ' + meldungen(r.fehler) : ''}`);
}

console.log('\n== Rezeptkopf');
for (const id of VULKAN) {
  const m = modell(id);
  ok(m.id === id && m.tags?.[0] === 'biom' && m.tags.includes('vulkan') && m.tier === 'detail' && JSON.stringify(m.footprint) === '[1,1]', `${id}: Tags beginnen mit "biom" und nennen "vulkan", Stufe detail, footprint [1,1]`);
  const budget = Math.max(...REGELN[id].faelle().map((f) => f.budget));
  ok(m.budgetTris === budget, `${id}: budgetTris ${m.budgetTris} = größtes Budget der Regel (${budget})`);
  ok(m.palette === PAL, `${id}: Standardpalette ${m.palette} ist biom_vulkan`);
}

console.log('\n== Spielregeln der Maße');
{
  const h = (id, params) => messe(lib, id, params, PAL).max[1];
  const halb = seeds(8).map((seed) => h(BASALT, { hoch: 0, seed })), voll = seeds(8).map((seed) => h(BASALT, { hoch: 1, seed }));
  ok(halb.every((x) => Math.abs(x - 0.75) <= 0.03) && voll.every((x) => Math.abs(x - 2.06) <= 0.1), `Basalt hoch 0 = ${Math.max(...halb).toFixed(2)} m (halbe Deckung 0,75 m), hoch 1 = ${Math.max(...voll).toFixed(2)} m (volle Deckung ca. 2,1 m), alle Seeds gleich hoch`);
  const f = seeds(8).map((seed) => h(FARN, { seed })), s = seeds(8).map((seed) => h(SCHLOT, { seed }));
  ok(f.every((x) => x >= 0.8 && x <= 1.0), `Aschefarn 0,8 bis 1,0 m (Sichtschleier, niedrig): ${f.map((x) => x.toFixed(2)).join(' / ')} m`);
  ok(s.every((x) => x >= 1.5 && x <= 2.0) && Math.min(...s) > Math.max(...f) && Math.min(...s) < Math.max(...voll), `Schlot 1,5 bis 2,0 m, höher als jeder Aschefarn, niedriger als der volle Basalt: ${s.map((x) => x.toFixed(2)).join(' / ')} m`);
  const sf = messe(lib, SCHLOT, { seed: 0 }, PAL);
  ok(sf.max[0] - sf.min[0] <= 1 && sf.max[2] - sf.min[2] <= 1, `Schlot Footprint höchstens 1 × 1 m (${(sf.max[0] - sf.min[0]).toFixed(2)} × ${(sf.max[2] - sf.min[2]).toFixed(2)} m)`);
}

console.log('\n== Seeds: verschiedene Gestalten, deterministisch');
{
  const g = (id, fn, seedsL, min) => pruefeGestalten(lib, id, fn, seedsL, min);
  let f = g(FARN, (seed) => ({ seed }), [0, 1, 2, 3, 4], 0.1);
  ok(f.length === 0, `Aschefarn seed 0 bis 4: verschiedene Blätter${f.length ? ' – ' + meldungen(f) : ''}`);
  for (const hoch of [0, 1]) {
    f = g(BASALT, (seed) => ({ seed, hoch }), [0, 1, 2], 0.25);
    ok(f.length === 0, `Basalt hoch ${hoch}, seed 0, 1, 2: drei deutlich verschiedene Gestalten (Bündel, Treppe, Gruppe)${f.length ? ' – ' + meldungen(f) : ''}`);
    f = g(BASALT, (seed) => ({ seed, hoch }), [0, 3, 6], 0.04);
    ok(f.length === 0, `Basalt hoch ${hoch}, seed 0, 3, 6 (gleiche Gestalt): trotzdem andere Höhen${f.length ? ' – ' + meldungen(f) : ''}`);
  }
  f = g(SCHLOT, (seed) => ({ seed }), [0, 1, 2], 0.15);
  ok(f.length === 0, `Schlot seed 0, 1, 2 (mindestens 15 % Unterschied): drei deutlich verschiedene Gestalten (Kegel, Terrassen, versetzt mit Nebenkegel)${f.length ? ' – ' + meldungen(f) : ''}`);
  f = g(SCHLOT, (seed) => ({ seed }), [0, 3, 6], 0.03);
  ok(f.length === 0, `Schlot seed 0, 3, 6 (gleiche Gestalt): trotzdem andere Höhe${f.length ? ' – ' + meldungen(f) : ''}`);
}

console.log('\n== Helligkeit und Farbe (Wertleiter): Schlot am dunkelsten, kein heller Stein, Asche bleibt grau');
{
  const sch = [...seeds(12).map((seed) => ({ seed }))];
  let f = sch.flatMap((p) => pruefeSchlotDunkel(SCHLOT, p));
  ok(f.length === 0, `Schlot: 12 Seeds, jedes Fels-Voxel mindestens ${SCHWELLEN.festAbstand} L* dunkler als Teppich (${L('teppich').toFixed(1)}), stone_dark (${L('stone_dark').toFixed(1)}) und stone (${L('stone').toFixed(1)})${f.length ? ' – ' + meldungen(f) : ''}`);
  f = [];
  for (const hoch of [0, 1]) for (const seed of [0, 1, 2, 3, 4, 5]) f.push(...pruefeSteinHelligkeit(lib, BASALT, { hoch, seed }, PAL));
  ok(f.length === 0, `Basalt: 2 Höhen × 6 Seeds, kein Voxel heller als der Boden plus 3 L*, Kappe und Sockel nicht heller als der Körper${f.length ? ' – ' + meldungen(f) : ''}`);
  f = [...seeds(12).map((seed) => pruefeAsche(FARN, { seed })), ...[0, 1].flatMap((hoch) => seeds(6).map((seed) => pruefeAsche(BASALT, { hoch, seed }))), ...seeds(6).map((seed) => pruefeAsche(SCHLOT, { seed }))].flat();
  ok(f.length === 0, `Aschefarn, Basalt, Schlot: kein Voxel heller als der hellste Boden plus 3 L*, alle grau (Buntheit höchstens 0,08)${f.length ? ' – ' + meldungen(f) : ''}`);
  const ar = new Set([...rollenVon(modell(FARN)), ...rollenVon(modell(BASALT))]);
  ok(![...ar].some((r) => /^fluid/.test(r)) && [...rollenVon(modell(BASALT))].every((r) => /^stone(_dark|_light)?$/.test(r)), `Basalt nennt nur stone*, Aschefarn keine Fluid-Rolle (${[...rollenVon(modell(FARN))].sort().join(', ')} | ${[...rollenVon(modell(BASALT))].sort().join(', ')})`);
  const sr = rollenVon(modell(SCHLOT));
  ok([...sr].every((r) => /^(rock|rock_dark|fluid|fluid_v)$/.test(r)) && sr.has('rock') && sr.has('fluid'), `Schlot nennt nur rock* und fluid (${[...sr].sort().join(', ')})`);
}

console.log('\n== Leuchten nur in der Rolle fluid');
{
  let f = [...seeds(64).map((seed) => pruefeLeuchten(FARN, { seed }, false)), ...[0, 1].flatMap((hoch) => seeds(16).map((seed) => pruefeLeuchten(BASALT, { hoch, seed }, false)))].flat();
  ok(f.length === 0, `Aschefarn (64 Seeds) und Basalt (2 × 16 Seeds): kein leuchtendes Voxel (keine Glut an Farn und Stein)${f.length ? ' – ' + meldungen(f) : ''}`);
  f = [0, 1, 2, 3].flatMap((form) => seeds(16).map((seed) => pruefeLeuchten(BEWUCHS, { form, seed }, false))).flat();
  ok(f.length === 0, `Bewuchs mit biom_vulkan (4 Formen × 16 Seeds): kein leuchtendes Voxel (keine Glutflechte)${f.length ? ' – ' + meldungen(f) : ''}`);
  f = seeds(64).flatMap((seed) => pruefeLeuchten(SCHLOT, { seed }, true));
  ok(f.length === 0, `Schlot (64 Seeds): leuchtet nur in der kleinen Mündung ganz oben, nur in der Rolle fluid, Fels leuchtet nie${f.length ? ' – ' + meldungen(f) : ''}`);
  const lv = messe(lib, FLUID, { art: 1, conn: 0 }, PAL);
  const nurFluid = [...lv.grid.values()].filter((v) => v.e > 0).every((v) => v.c === pal.fluid.c);
  ok(lv.emit > 0 && nurFluid, `Lava (art 1, biom_vulkan): ${lv.emit} leuchtende Voxel, alle in der Rolle fluid (Ufer und Variation fluid_v ohne Glut)`);
}

console.log('\n== Mutationsproben (absichtlich verletzte Rezepte müssen rot werden)');
{
  const rot = (name, fehler, re) => ok(fehler.length > 0 && fehler.some((x) => re.test(x)), `Mutation ${name} → rot${fehler.length ? ` (${fehler.find((x) => re.test(x)) ?? fehler[0]})` : ' (aber keine Meldung)'}`);
  // 1. Basalt über der Kachel
  let mid = await mutant(BASALT, (m) => m.ops.push({ op: 'box', name: 'Aufgebläht', at: [-9, 0, -9], size: [18, 5, 18], color: 'stone' }));
  rot('Basalt ragt über die Kachel (Quader 18 × 18 Voxel)', pruefeRezept(lib, mid, REGELN[BASALT], PAL).fehler, /ragt .* über die Kachel/);
  // 2. Aschefarn mit Glutspitzen
  mid = await mutant(FARN, (m) => m.ops.push({ op: 'box', name: 'Glutspitze', at: [0, 12, 0], size: [1, 1, 1], color: 'stone_light', emit: 1 }));
  rot('Aschefarn mit Glutspitze (emit)', pruefeLeuchten(mid, { seed: 0 }, false), /leuchtende Voxel/);
  // 3. Schlot mit leuchtendem Fels
  mid = await mutant(SCHLOT, (m) => m.ops.push({ op: 'box', name: 'Glühfels', mode: 'paint', at: [-8, 2, -8], size: [16, 4, 16], color: 'rock', emit: 1 }));
  rot('Schlot mit leuchtendem Fels', pruefeLeuchten(mid, { seed: 0 }, true), /nicht in der Rolle fluid|außerhalb der Mündung/);
  // 3b. Schlot ohne Lava in der Mündung
  mid = await mutant(SCHLOT, (m) => { m.ops = m.ops.filter((o) => !/Lava/.test(o.name)); });
  rot('Schlot ohne Lava (Mündung dunkel)', pruefeLeuchten(mid, { seed: 0 }, true), /Mündung leuchtet nicht/);
  // 3c. Schlot mit großer Lavafläche
  mid = await mutant(SCHLOT, (m) => m.ops.push({ op: 'box', name: 'Lavasee oben', at: [-6, 24, -6], size: [12, 1, 12], color: 'fluid' }));
  rot('Schlot mit großer Lavafläche statt kleiner Mündung', pruefeLeuchten(mid, { seed: 0 }, true), /außerhalb der Mündung|höchstens 20/);
  // 4. Schlot heller als Stein
  const hell = (ops) => ops.forEach((o) => { if (o.color === 'rock' || o.color === 'rock_dark') o.color = 'stone_light'; if (o.ops) hell(o.ops); });
  mid = await mutant(SCHLOT, (m) => hell(m.ops));
  rot('Schlot aus hellem Stein (heller als Teppich/Stein)', pruefeSchlotDunkel(mid, { seed: 0 }), /nicht das Dunkelste/);
  // 5. Aschefarn über Budget
  mid = await mutant(FARN, (m) => m.ops.push({ op: 'ellipsoid', name: 'Ballast', at: [0, 5, 0], r: [7, 5, 7], color: { noise: ['grass_dark', 'stone_dark'], cell: 1 } }));
  rot('Aschefarn über dem Dreiecksbudget (zusätzliche glatte Kuppel)', pruefeRezept(lib, mid, REGELN[FARN], PAL).fehler, /Dreiecke über dem Budget/);
  // 6. Weitere: Basalt hoch ohne Wirkung, heller Sockel, bunter (brauner) Farn, Seeds ohne Wirkung
  mid = await mutant(BASALT, (m) => { m.let.H = '12'; });
  rot('Basalt: hoch 1 liefert die halbe Höhe', pruefeRezept(lib, mid, REGELN[BASALT], PAL).fehler, /Oberkante/);
  mid = await mutant(BASALT, (m) => m.ops.push({ op: 'box', name: 'Sockel hell', mode: 'paint', at: [-8, 0, -8], size: [16, 2, 16], color: '#F2F4EA' }));
  rot('Basalt mit hellem Sockel', pruefeSteinHelligkeit(lib, mid, { hoch: 1, seed: 0 }, PAL), /heller als der Boden|heller Sockel/);
  mid = await mutant(FARN, (m) => m.ops.push({ op: 'box', name: 'Braun', mode: 'paint', at: [-8, 0, -8], size: [16, 4, 16], color: '#8A6A4A' }));
  rot('Aschefarn mit braunem Ton (Asche wird braun)', pruefeAsche(mid, { seed: 0 }), /nicht grau/);
  mid = await mutant(SCHLOT, (m) => { m.let.typ = '0'; m.let.ox = '0'; m.let.oz = '0'; m.let.nl = '3'; m.let.H = '28'; });
  rot('Schlot: seed ohne Wirkung', pruefeGestalten(lib, mid, (seed) => ({ seed }), [0, 1, 2], 0.25), /gleiche Gestalt/);
}

console.log('\n== Dreiecke je Rezept (gemessen, höchster Wert über alle Fälle)');
for (const id of VULKAN) console.log(`  ${id}: ${Object.entries(tabelle[id]).map(([g, t]) => `${g} ${t}`).join(' · ')}`);

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
