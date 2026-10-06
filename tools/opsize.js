// Misst, wie viele Voxel jeder oberste Bauschritt eines Modells beiträgt: node tools/opsize.js <model-id> [anzahl=15]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary } from './fs-io.js';
import { buildModel } from '../core/recipe.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, topN = 15] = process.argv.slice(2);
const lib = nodeLibrary(root);
const m = await lib.load('models', id);
const env = { getModel: (x) => lib.get('models', x), getVox: (f) => lib.vox.get(f), palette: lib.palette(m.palette || 'base'), resolvePalette: (p, o) => lib.palette(p, o) };
const rows = [];
for (const op of m.ops) {
  try { rows.push([buildModel({ ...m, ops: [op], variants: undefined }, {}, env).grid.size, op.name]); }
  catch (e) { rows.push([-1, `${op.name} (${e.message})`]); }
}
rows.sort((a, b) => b[0] - a[0]);
for (const [n, name] of rows.slice(0, +topN)) console.log(String(n).padStart(9), name);
