// Prüft alle Assets: baut jedes Modell (Defaults + Varianten), jede Figur und jede Szene.
// Aufruf: npm run check [-- --vox] [filter]
//   --vox   exportiert zusätzlich jedes Modell als .vox nach out/vox/ (für MagicaVoxel)
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { voxelSize } from '../core/scales.js';
import { gridToVox } from '../core/vox.js';
import { resolveScene } from '../core/scene.js';
import { buildTerrain } from '../core/terrain.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), exportVox = args.includes('--vox'), filter = args.find((a) => !a.startsWith('--'));
const lib = nodeLibrary(root), idx = await listAssets(root);
let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warnings++; console.log('  ! ' + m); };
const fmt = (n) => n.toLocaleString('de-DE');
const want = (id) => !filter || id.includes(filter);

const MAX_METERS = { terrain: 200, architecture: 40, detail: 10 };   // detail bis 10 m (Bäume, Standarten)

console.log('\n== Paletten');
for (const id of idx.palettes) {
  try { await lib.load('palettes', id); const p = lib.palette(id); console.log(`  ✓ ${id} (${Object.keys(p.roles).length} Rollen)`); }
  catch (e) { err(`${id}: ${e.message}`); }
}

console.log('\n== Modelle');
for (const id of idx.models.filter(want)) {
  try {
    const m = await lib.load('models', id);
    if (!m.name) warn(`${id}: Feld "name" fehlt`);
    const variants = [{ label: 'default', params: {} }, ...Object.entries(m.variants || {}).map(([k, v]) => ({ label: k, params: v }))];
    for (const v of variants) {
      const b = lib.build(id, { params: v.params });
      const bb = b.grid.bounds(), s = voxelSize(b.tier);
      const dims = [0, 1, 2].map((i) => (bb.max[i] - bb.min[i] + 1));
      const meters = dims.map((d) => (d * s).toFixed(2)).join(' × ');
      if (!b.grid.size) err(`${id} [${v.label}]: leer`);
      if (Math.max(...dims) * s > MAX_METERS[b.tier]) warn(`${id}: ${meters} m ist groß für Stufe ${b.tier}`);
      console.log(`  ✓ ${id} [${v.label}] ${b.tier}  ${dims.join('×')} Voxel = ${meters} m  ${fmt(b.grid.size)} Voxel  ${fmt(b.mesh.lit.quads + b.mesh.emit.quads)} Quads`);
      if (exportVox && v.label === 'default') {
        const f = path.join(root, 'out', 'vox', id + '.vox');
        await fs.mkdir(path.dirname(f), { recursive: true });
        try { await fs.writeFile(f, gridToVox(b.grid)); } catch (e) { warn(`${id}: .vox-Export: ${e.message}`); }
      }
    }
    if ((lib.buildCache.size || 0) > 0 && (m.tags || []).includes('schiff')) lib.buildCache.clear();   // große Schiffe nicht im Speicher halten
  } catch (e) { err(`${id}: ${e.message}`); }
}

console.log('\n== Figuren');
for (const id of idx.figures.filter(want)) {
  try {
    const f = await lib.load('figures', id);
    const rig = lib.get('rigs', f.rig);
    let vox = 0;
    for (const [jn, part] of Object.entries(f.parts || {})) {
      if (!rig.joints[jn]) { err(`${id}: Gelenk "${jn}" fehlt im Rig ${rig.id}`); continue; }
      const b = lib.build(part.model, { params: lib.partParams(part.model, f.params, part.params), palette: part.palette || f.palette, colors: f.colors });
      if (b.tier !== (rig.tier || 'detail')) err(`${id}: Teil ${part.model} hat Stufe ${b.tier}`);
      vox += b.grid.size;
    }
    for (const [jn, a] of Object.entries(f.attach || {})) {
      if (!rig.joints[jn]) { err(`${id}: Anbaupunkt "${jn}" fehlt im Rig`); continue; }
      vox += lib.build(a.model, { params: lib.partParams(a.model, f.params, a.params), palette: a.palette || f.palette, colors: f.colors }).grid.size;
    }
    const missing = Object.keys(rig.joints).filter((j) => !['root', 'back', 'handL', 'handR'].includes(j) && !f.parts?.[j]);
    if (missing.length) warn(`${id}: Gelenke ohne Teil: ${missing.join(', ')}`);
    console.log(`  ✓ ${id} (Rig ${f.rig}, ${fmt(vox)} Voxel)`);
  } catch (e) { err(`${id}: ${e.message}`); }
}

console.log('\n== Szenen');
for (const id of idx.scenes.filter(want)) {
  try {
    const sc = await lib.load('scenes', id);
    const res = resolveScene(sc, lib);
    let vox = 0;
    if (sc.terrain) vox += buildTerrain(sc.terrain, lib.palette(sc.terrain.palette || sc.palette || 'base')).grid.size;
    const uniq = new Set();
    for (const p of res.placements) { const b = lib.build(p.model, { params: p.params, palette: p.palette, colors: p.colors }); vox += b.grid.size; uniq.add(b); }
    for (const f of res.figures) if (!lib.get('figures', f.figure)) err(`${id}: Figur ${f.figure} fehlt`);
    if (sc.mood && !lib.get('moods', sc.mood)) err(`${id}: Stimmung ${sc.mood} fehlt`);
    console.log(`  ✓ ${id}: ${res.info.W}×${res.info.D} m, ${res.placements.length} Platzierungen (${uniq.size} verschiedene Bauten), ${res.figures.length} Figuren, ~${fmt(vox)} Voxel`);
  } catch (e) { err(`${id}: ${e.message}`); }
}

console.log(`\n${errors ? '✗' : '✓'} ${errors} Fehler, ${warnings} Warnungen`);
process.exit(errors ? 1 : 0);
