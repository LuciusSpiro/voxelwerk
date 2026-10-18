// Lesbarkeitsvergleich der Drehsprites: alle Klassen in 30, 50 und 80 px Länge (jeweils Bug nach rechts und um 35° gedreht),
// dazu eine Zeile mit den Spielgrößen. Echte Renderings in der jeweiligen Pixelgröße (kein Herunterskalieren).
//
//   node tools/sprites-vergleich.mjs <Ausgabeordner> [zoom=3] [Set ...]     Standard-Sets: nord rom rostmeute
//
// Ausgabe: <ordner>/vergleich_<set>_x<zoom>.png (Zeilen: Jäger, Späher, Korvette, Frachter, Fregatte, Kreuzer, Linienschiff;
// Spalten: 30 px, 50 px, 80 px, je 2 Winkel, dann Spielgröße) und <ordner>/vergleich_<set>_x1.png in Originalgröße.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary } from './fs-io.js';
import { KLASSEN, SETS, renderOne, encodePng } from './sprites.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, zoomArg, ...rest] = process.argv.slice(2);
if (!outDir) { console.error('Aufruf: node tools/sprites-vergleich.mjs <Ausgabeordner> [zoom] [Set ...]'); process.exit(2); }
const zoom = +zoomArg || 3, sets = rest.length ? rest : ['nord', 'rom', 'rostmeute'];
const lib = nodeLibrary(root);
const SIZES = [30, 50, 80], ANGS = [0, (35 / 180) * Math.PI];
const classes = Object.keys(KLASSEN).filter((k) => !KLASSEN[k].modell);
await fs.mkdir(outDir, { recursive: true });
for (const setId of sets) {
  if (!SETS[setId]) { console.error('unbekanntes Set ' + setId); process.exit(2); }
  // Zellen: je Klasse eine Zeile
  const rows = [];
  for (const k of classes) {
    const cells = [];
    for (const len of SIZES) for (const a of ANGS) cells.push(await renderOne(lib, k, setId, len, a));
    cells.push(await renderOne(lib, k, setId, KLASSEN[k].len, 0));
    rows.push(cells); lib.buildCache.clear();
  }
  const colW = [], pad = 6;
  for (let c = 0; c < rows[0].length; c++) colW.push(Math.max(...rows.map((r) => r[c].F)) + pad);
  const rowH = rows.map((r) => Math.max(...r.map((x) => x.F)) + pad);
  const W = colW.reduce((a, b) => a + b, pad), H = rowH.reduce((a, b) => a + b, pad);
  const img = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < img.length; i += 4) { img[i] = 14; img[i + 1] = 18; img[i + 2] = 34; img[i + 3] = 255; }
  let y0 = pad;
  rows.forEach((r, ri) => {
    let x0 = pad;
    r.forEach((cell, ci) => {
      const ox = x0 + Math.floor((colW[ci] - pad - cell.F) / 2), oy = y0 + Math.floor((rowH[ri] - pad - cell.F) / 2);
      for (let y = 0; y < cell.F; y++) for (let x = 0; x < cell.F; x++) {
        const s = (y * cell.F + x) * 4; if (!cell.rgba[s + 3]) continue;
        const d = ((oy + y) * W + ox + x) * 4; img[d] = cell.rgba[s]; img[d + 1] = cell.rgba[s + 1]; img[d + 2] = cell.rgba[s + 2];
      }
      x0 += colW[ci];
    });
    y0 += rowH[ri];
  });
  await fs.writeFile(path.join(outDir, `vergleich_${setId}_x1.png`), encodePng(W, H, Buffer.from(img.buffer)));
  const z = new Uint8ClampedArray(W * zoom * H * zoom * 4);
  for (let y = 0; y < H * zoom; y++) for (let x = 0; x < W * zoom; x++) {
    const s = ((y / zoom | 0) * W + (x / zoom | 0)) * 4, d = (y * W * zoom + x) * 4;
    z[d] = img[s]; z[d + 1] = img[s + 1]; z[d + 2] = img[s + 2]; z[d + 3] = 255;
  }
  await fs.writeFile(path.join(outDir, `vergleich_${setId}_x${zoom}.png`), encodePng(W * zoom, H * zoom, Buffer.from(z.buffer)));
  console.log(`✓ vergleich_${setId} (${W}×${H} px, ×${zoom})`);
}
