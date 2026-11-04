// Test der Biome (VOX-02 Paket 1): Wertleiter-Prüfung mit Mutationsproben, Gegenprobe der Kulturpaletten.
// Aufruf: node tools/test-biom.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/palettes und assets/moods, schreibt nichts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { resolvePalette } from '../core/color.js';
import { BIOME, pruefeBiomPalette, pruefeBiomStimmung, kulturHashes, gesamtHash, lstar, SCHWELLEN } from './biom-lib.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);
for (const id of BIOME) await lib.load('moods', id);

// Gegenprobe: Hash über die aufgelösten Rollen aller Paletten außer den Biomen, ermittelt vor VOX-02 (Stand main 89d789e, 47 Paletten).
const KULTUR_HASH = '6ec7e323:47';

/** Prüft eine (veränderte) Kopie der Biom-Palette; liefert die Meldungen. */
const palette = (id, aendere) => {
  const roh = structuredClone(lib.get('palettes', id));
  aendere?.(roh);
  const store = (p) => (p === id ? roh : lib.get('palettes', p));
  return pruefeBiomPalette(roh, resolvePalette(id, store).roles);
};
const stimmung = (id, aendere) => { const m = structuredClone(lib.get('moods', id)); aendere?.(m); return pruefeBiomStimmung(m); };
/** Mutation muss rot werden und die Meldung muss `re` nennen. */
const rot = (name, id, aendere, re) => {
  const m = palette(id, aendere);
  ok(m.length > 0 && m.some((x) => re.test(x)), `Mutation ${id}: ${name} → rot${m.length ? ` (${m.find((x) => re.test(x)) ?? m[0]})` : ' (aber keine Meldung)'}`);
};

console.log('\n== Biom-Paletten sauber');
for (const id of BIOME) {
  const m = palette(id);
  ok(m.length === 0, `${id}: Wertleiter grün${m.length ? ' – ' + m.join('; ') : ''}`);
}
{
  const r = (id, k) => lstar(lib.palette(id).roles[k].c);
  ok(r('biom_vulkan', 'fluid') > r('biom_vulkan', 'teppich') && lib.palette('biom_vulkan').roles.fluid.e > 0, 'Vulkan: Lava hell und leuchtend');
  ok(BIOME.every((id) => lib.palette(id).roles.glow.e === lib.palette('base').roles.glow.e), 'Biome erben die Basis-Leuchtrollen unverändert (setzen selbst keine)');
  const hue = (id) => lib.palette(id).roles.grass.c;
  ok(new Set(BIOME.map(hue)).size === 3, 'Bodenfarbe der drei Biome verschieden');
}

console.log('\n== Mutationsproben Wertleiter (Palette)');
rot('Teppich heller als Boden', 'biom_wiesenwald', (p) => { p.roles.teppich = '#A6C860'; }, /Teppich/);
rot('Teppich gleich Boden (wie im Entwurf)', 'biom_wiesenwald', (p) => { p.roles.teppich = p.roles.grass; }, /Teppich/);
rot('Teppich fast schwarz (liest sich als Fels)', 'biom_wueste', (p) => { p.roles.teppich = '#2A2018'; }, /Teppich/);
rot('Leuchtrolle ohne fluid (flower leuchtet)', 'biom_wueste', (p) => { p.roles.flower = { color: '#E9C04E', emit: 1 }; }, /flower.*leuchtet/);
rot('Leuchtrolle ohne fluid (grass leuchtet)', 'biom_wiesenwald', (p) => { p.roles.grass = { color: '#82A24C', emit: 0.5 }; }, /grass.*leuchtet/);
rot('Wasser leuchtet', 'biom_wiesenwald', (p) => { p.roles.fluid = { color: '#3B7EA2', emit: 1 }; }, /Wasser/);
rot('orange Blume in der Vulkanpalette (liest sich als Glut)', 'biom_vulkan', (p) => { p.roles.flower = '#E6B04A'; }, /flower.*Glutpunkt/);
rot('gelbe Blume2 in der Vulkanpalette (liest sich als Glut)', 'biom_vulkan', (p) => { p.roles.flower2 = '#E8D040'; }, /flower2.*Glutpunkt/);
rot('Lava leuchtet nicht', 'biom_vulkan', (p) => { p.roles.fluid = '#FF6A1E'; }, /Lava/);
rot('Glutrolle für Pflanzen (plant leuchtet)', 'biom_vulkan', (p) => { p.roles.plant = { color: '#6A6C48', emit: 1.3 }; }, /plant.*leuchtet/);
rot('helle Kappe auf Stein (Entwurf)', 'biom_vulkan', (p) => { p.roles.stone_light = '#C4BCB0'; }, /stone_light/);
rot('milde helle Kappe (nur über dem Boden, noch nahe am Stein)', 'biom_vulkan', (p) => { p.roles.stone_light = '#A09B97'; }, /helle Kappe/);
rot('Stein weicht vom Boden ab (zu dunkel)', 'biom_wiesenwald', (p) => { p.roles.stone = '#303430'; p.roles.stone_dark = '#202420'; }, /Boden.*angeglichen|Fels/);
rot('Fels heller als Stein', 'biom_wueste', (p) => { p.roles.rock = '#A58A60'; p.roles.rock_dark = '#8E7650'; }, /Fels/);
rot('Fels gleich Teppich', 'biom_vulkan', (p) => { p.roles.rock = p.roles.teppich; }, /Fels/);
rot('Abgrund heller als Fels', 'biom_wueste', (p) => { p.roles.abgrund = '#B09264'; }, /abgrund/);
rot('Boden zu hell', 'biom_wueste', (p) => { for (const r of ['sand', 'grass', 'grass_dark', 'grass_light', 'soil']) p.roles[r] = '#F0E4C6'; p.roles.teppich = '#D8C8A0'; }, /Boden .*außerhalb/);
rot('Boden zu dunkel', 'biom_vulkan', (p) => { for (const r of ['sand', 'grass', 'grass_dark', 'grass_light', 'soil']) p.roles[r] = '#2A2624'; }, /Boden .*außerhalb/);
rot('Boden unruhig (ein Fleck viel heller)', 'biom_wiesenwald', (p) => { p.roles.sand = '#D6C8A0'; }, /streuen/);
rot('Bewuchs heller als Boden', 'biom_wiesenwald', (p) => { p.roles.plant_light = '#B4D070'; }, /plant_light/);
rot('erbt von rom statt base', 'biom_wueste', (p) => { p.extends = 'rom'; }, /muss von "base" erben/);
rot('erbt von sommer_wald', 'biom_wiesenwald', (p) => { p.extends = 'sommer_wald'; }, /muss von "base" erben/);
rot('adjust gesetzt', 'biom_wiesenwald', (p) => { p.adjust = { light: 0.9 }; }, /adjust/);
rot('Kulturrolle gesetzt (primary)', 'biom_vulkan', (p) => { p.roles.primary = '#FF0000'; }, /primary.*keine Geländerolle/);
rot('Kulturrolle gesetzt (metal)', 'biom_wueste', (p) => { p.roles.metal = '#808080'; }, /metal.*keine Geländerolle/);
rot('Pflichtrolle teppich fehlt', 'biom_vulkan', (p) => { delete p.roles.teppich; }, /Pflichtrolle "teppich"/);
rot('Pflichtrolle fluid fehlt', 'biom_wiesenwald', (p) => { delete p.roles.fluid; }, /Pflichtrolle "fluid"/);
// Sicherheitsnetz: Schwellen sind nicht aufgeweicht worden
ok(SCHWELLEN.steinKappe <= 4 && SCHWELLEN.teppichMin >= 3 && SCHWELLEN.festAbstand >= 5, 'Schwellen nicht aufgeweicht (Kappe ≤ 4, Teppich-Stufe ≥ 3, Fest-Abstand ≥ 5 L*)');

console.log('\n== Biom-Stimmungen');
for (const id of BIOME) {
  const m = stimmung(id);
  ok(m.length === 0, `${id}: Stimmung grün${m.length ? ' – ' + m.join('; ') : ''}`);
}
{
  const g = (id) => lib.get('moods', id);
  ok(new Set(BIOME.map((id) => g(id).background)).size === 3 && new Set(BIOME.map((id) => g(id).sun.color)).size === 3, 'Stimmungen sichtbar verschieden (Himmel und Sonnenfarbe)');
  ok(g('biom_vulkan').background !== g('biom_wiesenwald').background && g('biom_wueste').sun.dir.join() !== g('biom_wiesenwald').sun.dir.join(), 'Sonnenrichtung bzw. Himmel unterscheiden sich');
}
const rotM = (name, id, aendere, re) => { const m = stimmung(id, aendere); ok(m.some((x) => re.test(x)), `Mutation ${id}: ${name} → rot`); };
rotM('Dunst (Nebel nah)', 'biom_wueste', (m) => { m.fog.near = 1.2; m.fog.far = 3.6; }, /Dunst/);
rotM('Sonne orange gesättigt (Asche wird braun)', 'biom_vulkan', (m) => { m.sun.color = '#FFC8A0'; }, /Sonnenfarbe/);
rotM('Belichtung zu dunkel', 'biom_wiesenwald', (m) => { m.exposure = 0.6; }, /exposure/);
rotM('Leuchtschleier (bloom)', 'biom_wueste', (m) => { m.bloom.strength = 0.6; }, /bloom/);
rotM('Sonne zu schwach', 'biom_vulkan', (m) => { m.sun.intensity = 1.5; }, /Sonnenstärke/);
rotM('Feld fehlt', 'biom_wueste', (m) => { delete m.fog; }, /"fog" fehlt/);

console.log('\n== Gegenprobe Kulturpaletten (Rollen unverändert)');
{
  const h = kulturHashes(lib, idx.palettes);
  const g = gesamtHash(h);
  ok(g === KULTUR_HASH, `Hash der aufgelösten Rollen aller ${Object.keys(h).length} Paletten außer den Biomen = ${KULTUR_HASH}${g === KULTUR_HASH ? '' : ` (ist ${g})`}`);
  ok(!Object.keys(h).some((id) => BIOME.includes(id)), 'Biom-Paletten sind aus der Gegenprobe ausgenommen');
  // Mutationsprobe der Gegenprobe: eine veränderte Kulturrolle ändert den Hash
  const rom = structuredClone(lib.get('palettes', 'rom'));
  rom.roles.primary = '#000001';
  const lib2 = { palette: (id) => resolvePalette(id, (p) => (p === 'rom' ? rom : lib.get('palettes', p))) };
  ok(gesamtHash(kulturHashes(lib2, idx.palettes)) !== KULTUR_HASH, 'Mutation: geänderte Rolle in rom → Hash weicht ab (und erbende Paletten ebenso)');
  // Auch die Basis selbst darf sich nicht verändern (alle Biome erben von ihr)
  ok(h.base === '95f132a4', 'base unverändert (Hash 95f132a4)');
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
