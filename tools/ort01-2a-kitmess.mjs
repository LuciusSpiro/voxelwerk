// node mess-kit.mjs  (cwd = Voxelwerk-Worktree)  misst Quads je Kit-Teil und Variante mit art=aussenposten
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.cwd();
const { nodeLibrary } = await import(pathToFileURL(path.join(root, 'tools/fs-io.js')).href);
const lib = nodeLibrary(root);
const art = 'aussenposten';
const q = (id, params) => { const b = lib.build(id, { params }); return b.mesh.lit.quads + b.mesh.emit.quads; };
await lib.load('models', 'kit/rom/wand'); await lib.load('models', 'kit/rom/tuer'); await lib.load('models', 'kit/rom/dach');
const rows = [];
const stat = (label, arr) => rows.push(`${label}: min ${Math.min(...arr)} · mittel ${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)} · max ${Math.max(...arr)}`);
for (const cut of [0, 1]) {
  const gerade = [], ecken = [], knoten = [], alle = [];
  for (let conn = 0; conn < 16; conn++) for (const zustand of [0, 1, 2]) for (const seed of [0, 1, 2, 3]) {
    const n = q('kit/rom/wand', { conn, cut, zustand, art, seed });
    if (zustand === 0) alle.push(n);
    if (zustand === 0 && seed === 0) { if (conn === 5 || conn === 10) gerade.push(n); else if ([3, 6, 9, 12].includes(conn)) ecken.push(n); else if ([7, 11, 13, 14, 15].includes(conn)) knoten.push(n); }
  }
  rows.push(`wand cut=${cut}: gerade ${gerade.join('/')} · ecken ${ecken.join('/')} · knoten ${knoten.join('/')}`);
  stat(`wand cut=${cut} alle conn/seed (zustand 0)`, alle);
}
const z = []; for (const zustand of [0, 1, 2]) z.push(q('kit/rom/wand', { conn: 10, cut: 0, zustand, art, seed: 1 }));
rows.push(`wand gerade nach zustand 0/1/2: ${z.join('/')}`);
for (const state of [0, 1, 2, 3]) for (const cut of [0, 1]) rows.push(`tuer state=${state} cut=${cut}: ${q('kit/rom/tuer', { state, cut, art, zustand: 0, seed: 1 })}`);
for (const [w, d] of [[2, 2], [3, 3], [6, 6], [6, 5], [7, 7], [8, 6], [8, 8], [10, 7], [12, 9], [13, 13]]) rows.push(`dach ${w}x${d}: ${q('kit/rom/dach', { w, d, zustand: 0 })}`);
console.log(rows.join('\n'));
