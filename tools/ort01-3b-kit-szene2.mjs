// Kit-Probe ORT-01 3b (K2): Reihen aus echten Kit-Kacheln (art=station): Türen (offen/zu/verschlossen/gesprengt),
// Schotte (zu/offen/gehackt/verschlossen), Luke zu/offen, Deckung halb/voll, Kante, schwache Wand (Riss/Durchbruch), Boden-Beläge 0-3.
// Aufruf: node tools/ort01-3b-kit-szene2.mjs [--palette nord] [--id ort-kit-st-k2]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'assets', 'scenes') + path.sep;
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const palette = opt('palette', 'nord');
const id = opt('id', 'ort-kit-st-k2');
const W = 14, D = 10;
const L = 0.25;
const place = [];
const A = (extra) => ({ art: 'station', zustand: 0, ...extra });
const wandRow = (z, cut, gaps, tileModel = 'kit/germanen/wand', stateAt = {}) => {
  // Wandkacheln einer Reihe; gaps = Spalten, in denen Tür/Schott (2 breit) sitzt (Kacheln werden ausgelassen)
  for (let x = 0; x < W; x++) {
    if (gaps.some((g) => x === g || x === g + 1)) continue;
    const w = x > 0 ? 8 : 0, e = x < W - 1 ? 2 : 0;
    place.push({ model: stateAt[x] ? stateAt[x].model : tileModel, at: [x + 0.5, z + 0.5], lift: L,
      params: A({ conn: w | e, cut, seed: x * 7 + z * 13, ...(stateAt[x] ? stateAt[x].params : {}) }) });
  }
};
// Boden
for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
  const belag = (x + z) % 7 === 0 ? 3 : (x >= 10 ? 1 : (z >= 8 ? 2 : 0));
  place.push({ model: 'kit/germanen/boden', at: [x + 0.5, z + 0.5], lift: L, params: A({ belag, seed: x * 5 + z * 11 }) });
}
// Reihe 1 (z=0, volle Höhe): Türen mit Zustand offen(0) zu(1) verschlossen(2) gesprengt(3)
const dg = [1, 4, 7, 10];
wandRow(0, 0, dg);
dg.forEach((g, i) => place.push({ model: 'kit/germanen/tuer', at: [g + 1, 0.5], lift: L, params: A({ cut: 0, state: i, seed: 3 + i }) }));
// Reihe 2 (z=3, geschnitten): Schotte zu(0) offen(1) gehackt(2) verschlossen(3)
const sg = [1, 4, 7, 10];
wandRow(3, 1, sg, 'kit/germanen/wand', { 0: { model: 'kit/germanen/wand_schwach', params: { state: 0 } }, 13: { model: 'kit/germanen/wand_schwach', params: { state: 1 } } });
sg.forEach((g, i) => place.push({ model: 'kit/germanen/schott', at: [g + 1, 3.5], lift: L, params: A({ cut: 1, state: i, seed: 9 + i }) }));
// Reihe 3: Luken, Deckung halb/voll, Kante
place.push({ model: 'kit/germanen/luke', at: [1.5, 5.5], lift: L, params: A({ state: 0, conn: 0, seed: 4 }) });
place.push({ model: 'kit/germanen/luke', at: [3.5, 5.5], lift: L, params: A({ state: 1, conn: 0, seed: 5 }) });
for (let x = 6; x < 9; x++) place.push({ model: 'kit/germanen/deckung_halb', at: [x + 0.5, 5.5], lift: L, params: A({ conn: x === 6 ? 2 : x === 8 ? 8 : 10, cut: 0, seed: 20 + x }) });
for (let x = 10; x < 13; x++) place.push({ model: 'kit/germanen/deckung_voll', at: [x + 0.5, 5.5], lift: L, params: A({ conn: x === 10 ? 2 : x === 12 ? 8 : 10, cut: 1, seed: 30 + x }) });
for (let x = 1; x < 6; x++) place.push({ model: 'kit/germanen/kante', at: [x + 0.5, 7.5], lift: L, params: A({ conn: x === 1 ? 2 : x === 5 ? 8 : 10, cut: 1, seed: 40 + x }) });
place.push({ model: 'kit/germanen/deckung_halb', at: [8.5, 7.5], lift: L, params: A({ conn: 0, cut: 0, seed: 50 }) });
place.push({ model: 'kit/germanen/deckung_voll', at: [11.5, 7.5], lift: L, params: A({ conn: 0, cut: 1, seed: 51 }) });
const leg = { g: { h: 1, top: '#2A2A2E', fill: '#2A2A2E' } };
const rows = [...Array(D)].map(() => 'g'.repeat(W));
const cams = {
  uebersicht: { target: [W / 2, 0.8, D / 2], dist: W * 1.3, elev: 50, az: 20, fov: 36 },
  spielnah: { target: [W / 2, 0.5, D / 2 + 0.3], dist: W * 1.2, elev: 70, az: 0, fov: 36 },
  detail: { target: [W / 2, 1.2, 0.8], dist: 9.5, elev: 20, az: 0, fov: 36 },
  schotte: { target: [W / 2, 0.9, 3.6], dist: 9.5, elev: 24, az: 0, fov: 36 },
};
const sc = { id, name: 'ORT-01 3b K2: Stations-Kit ' + palette, palette, mood: 'hall_metall',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(D).fill('1'.repeat(W)) }, place, cameras: cams };
fs.writeFileSync(OUT + id + '.json', JSON.stringify(sc, null, 1));
console.log(id, place.length, 'Platzierungen');
