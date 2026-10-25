// Kit-Probe ORT-01 3b (K1): Raum-Ring aus echten Kit-Kacheln (kit/germanen/wand, boden, tuer mit art=station, cut=1) mit Tür
// und einigen Stationsstücken. Aufruf: node tools/ort01-3b-kit-szene.mjs [--palette nord] [--id ort-kit-st-ring]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'assets', 'scenes') + path.sep;
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const palette = opt('palette', 'nord');
const id = opt('id', 'ort-kit-st-ring');
const W = 11, D = 8, DOOR = [5, 6];   // Tür in der unteren Wand (z = D-1), 2 Kacheln
const isWall = (x, z) => x === 0 || z === 0 || x === W - 1 || z === D - 1;
const isDoor = (x, z) => z === D - 1 && DOOR.includes(x);
const place = [];
for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
  if (isWall(x, z)) {
    if (isDoor(x, z)) continue;
    const wc = (xx, zz) => xx >= 0 && xx < W && zz >= 0 && zz < D && isWall(xx, zz);   // Tür zählt zur Wandklasse
    const conn = (wc(x, z - 1) ? 1 : 0) | (wc(x + 1, z) ? 2 : 0) | (wc(x, z + 1) ? 4 : 0) | (wc(x - 1, z) ? 8 : 0);
    place.push({ model: 'kit/germanen/wand', at: [x + 0.5, z + 0.5], params: { conn, cut: z > 0 ? 1 : 0, art: 'station', zustand: 0, seed: x * 7 + z * 13 }, lift: 0.25 });
  } else {
    const belag = x >= 8 ? 1 : (x >= 3 && x <= 6 && z >= 3 && z <= 5 ? 3 : 0);
    place.push({ model: 'kit/germanen/boden', at: [x + 0.5, z + 0.5], params: { belag, art: 'station', zustand: 0, seed: x * 5 + z * 11 }, lift: 0.25 });
  }
}
// Tür (2×1, Anker Kantenmitte)
place.push({ model: 'kit/germanen/tuer', at: [DOOR[1], D - 0.5], params: { art: 'station', cut: 1, state: 0, zustand: 0, seed: 3 }, lift: 0.25 });
const P = (model, x, z, rot = 0, params) => ({ model, at: [x, z], ...(rot ? { rot } : {}), ...(params ? { params } : {}), lift: 0.25 });
const GS = 'ort/germanen/station/', GG = 'ort/germanen/gemein/';
place.push(
  P(GS + 'kartentisch', 4.9, 4.1), P(GS + 'terminal', 1.0 + 0.3, 3.2, 90),
  P(GS + 'ladebock', 4.5, 1.0), P(GG + 'fasszelle', 3.8, 1.0, 0, { charge: 4 }), P(GG + 'fasszelle', 4.5, 1.0, 0, { charge: 2 }),
  P(GS + 'koje', 8.6, 1.0, 0), P(GS + 'spind', 1.0 + 0.3, 5.2, 90), P(GG + 'verteiler', 7.2, 1.0),
  P(GS + 'glutofen', 9.4, 5.4, 270), P(GS + 'medliege', 8.6, 3.4),
);
const leg = { g: { h: 1, top: '#2A2A2E', fill: '#2A2A2E' } };
const rows = [...Array(D)].map(() => 'g'.repeat(W));
const cams = {
  uebersicht: { target: [W / 2, 0.8, D / 2], dist: W * 1.4, elev: 48, az: 28, fov: 36 },
  spielnah: { target: [W / 2, 0.5, D / 2 + 0.5], dist: W * 1.25, elev: 72, az: 0, fov: 36 },
  detail: { target: [5.0, 0.8, 3.6], dist: 6.5, elev: 34, az: 25, fov: 36 },
};
const sc = { id, name: 'ORT-01 3b K1: Stations-Kit ' + palette, palette, mood: 'hall_metall',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(D).fill('1'.repeat(W)) }, place, cameras: cams };
fs.writeFileSync(OUT + id + '.json', JSON.stringify(sc, null, 1));
console.log(id, place.length, 'Platzierungen');
