// node kitscene2a.mjs <zielordner-assets/scenes> <id>  : zwei Häuser 8x6 (links hoch mit Dach, rechts niedrig/cut) aus echten kit/rom/wand + kit/rom/tuer, art=aussenposten
import fs from 'fs';
const [out, id] = process.argv.slice(2);
const W = 26, D = 10;
function haus(ox, oz, w, d, cut, dach, doorX) {
  const place = [];
  const ring = (x, z) => x >= 0 && z >= 0 && x < w && z < d && (x === 0 || z === 0 || x === w - 1 || z === d - 1);
  const door = (x, z) => z === d - 1 && (x === doorX || x === doorX + 1);
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if (!ring(x, z) || door(x, z)) continue;
    const n = ring(x, z - 1), e = ring(x + 1, z), s = ring(x, z + 1), wv = ring(x - 1, z);
    const conn = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (wv ? 8 : 0);
    place.push({ model: 'kit/rom/wand', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut, art: 'aussenposten', zustand: 0, seed: x * 7 + z * 13 } });
  }
  place.push({ model: 'kit/rom/tuer', at: [ox + doorX + 1, oz + d - 0.5], params: { cut, art: 'aussenposten', zustand: 0, state: 0, seed: 3 } });
  if (dach) place.push({ model: 'kit/rom/dach', at: [ox, oz], params: { w, d, zustand: 0 } });
  return place;
}
const place = [...haus(2, 2, 8, 6, 0, true, 3), ...haus(15, 2, 8, 6, 1, false, 3)];
const leg = { a: { h: 1, top: '#CFC4AE', fill: '#2A2A2E' }, b: { h: 1, top: '#C2B6A0', fill: '#2A2A2E' } };
const rows = [...Array(D)].map((_, z) => [...Array(W)].map((_, x) => ((x + z) % 2 ? 'a' : 'b')).join(''));
const cam = (t, dist, elev, az) => ({ target: t, dist, elev, az, fov: 36 });
const sc = { id, name: id, palette: 'rom', mood: 'planet_day',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(D).fill('1'.repeat(W)) }, place,
  cameras: { uebersicht: cam([13, 1.0, 5.5], 30, 46, 28), spielnah: cam([13, 0.5, 5.8], 28, 72, 0), detail: cam([6, 1.6, 8.4], 9, 22, 20), innen: cam([19, 0.8, 5.5], 12, 48, 20) } };
fs.writeFileSync(`${out}/${id}.json`, JSON.stringify(sc));
