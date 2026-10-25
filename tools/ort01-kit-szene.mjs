// ORT-01 K1 (Gruppe 2b): Szene mit echten kit/germanen/wand-, tuer- und dach-Kacheln (art=aussenposten).
// Links ein Haus 8x6 "hoch" (Wand 3 m, Dach), rechts dasselbe "niedrig" (cut=1, ohne Dach, wie bei Sichtlinie).
// node tools/ort01-kit-szene.mjs [id] [palette]
import fs from 'node:fs';
const id = process.argv[2] || 'kit-aussen';
const pal = process.argv[3] || 'nord';
const place = [];
const W = 8, D = 6;
function haus(ox, oz, cut, dach, tuerBreite = 2) {
  const t0 = Math.floor((W - tuerBreite) / 2);   // erste Türkachel
  const isTuer = (x, z) => z === D - 1 && x >= t0 && x < t0 + tuerBreite;
  const isW = (x, z) => x >= 0 && z >= 0 && x < W && z < D && (x === 0 || z === 0 || x === W - 1 || z === D - 1);
  const wandOderTuer = (x, z) => isW(x, z);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (!isW(x, z) || isTuer(x, z)) continue;
    const conn = (wandOderTuer(x, z - 1) ? 1 : 0) | (wandOderTuer(x + 1, z) ? 2 : 0) | (wandOderTuer(x, z + 1) ? 4 : 0) | (wandOderTuer(x - 1, z) ? 8 : 0);
    place.push({ model: 'kit/germanen/wand', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut, art: 'aussenposten', zustand: 0, seed: (x * 7 + z * 13 + ox) % 97 } });
  }
  place.push({ model: 'kit/germanen/tuer', at: [ox + t0 + tuerBreite / 2, oz + D - 0.5], params: { cut, art: 'aussenposten', zustand: 0, state: 1, seed: 3 } });
  if (dach) place.push({ model: 'kit/germanen/dach', at: [ox, oz], params: { w: W, d: D, zustand: 0 } });
}
haus(2, 2, 0, true);
haus(12, 2, 1, false);
// zweites, kleineres Haus mit zugezogener Tür (verschlossen) und Zustand verfallen
const Wd = 22, Dd = 12;
const leg = { g: { h: 1, top: { noise: ['#6F7A55', '#5E6849', '#848C6A'], weights: [3, 2, 1] }, fill: '#4A3F33' }, p: { h: 1, top: '#8A8A82', fill: '#4A3F33' } };
const rows = [...Array(Dd)].map((_, z) => [...Array(Wd)].map((_, x) => (x >= 1 && x < Wd - 1 && z >= 1 && z < Dd - 2 ? 'p' : 'g')).join(''));
const sc = {
  id, name: id, palette: pal, mood: 'planet_day',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(Dd).fill('1'.repeat(Wd)) },
  place,
  cameras: {
    uebersicht: { target: [11, 1.0, 5.5], dist: 27, elev: 48, az: 28, fov: 36 },
    spielnah: { target: [11, 0.5, 6], dist: 24, elev: 72, az: 0, fov: 36 },
    detail: { target: [6, 1.0, 8], dist: 8, elev: 20, az: 20, fov: 36 },
  },
};
fs.writeFileSync(new URL(`../assets/scenes/${id}.json`, import.meta.url), JSON.stringify(sc));
console.log(id, place.length);
