// node tools/ort01-2a-kitszene.mjs <zielordner/scenes> <id>
// Kit-Probeszene Rom-Außenposten aus echten kit/rom/*-Kacheln (art=aussenposten):
//  A: Haus 8x6 hoch mit Tür und Dach, B: Haus 8x6 niedrig (cut) mit Tor 4 breit und Innenboden belag 2,
//  C: Kleinhaus 3x3 mit Dach (kleine Spannweite), D: Plateau mit Kante und Boden belag 3, E: Gitterreihe, F: Landefeld belag 1.
import fs from 'fs';
const [out, id] = process.argv.slice(2);
const W = 36, D = 16;
const place = [];
const base = { art: 'aussenposten', zustand: 0 };
function haus(ox, oz, w, d, cut, dach, tuer, innen) {
  const ring = (x, z) => x >= 0 && z >= 0 && x < w && z < d && (x === 0 || z === 0 || x === w - 1 || z === d - 1);
  const dw = tuer.breite, d0 = tuer.x;
  const door = (x, z) => z === d - 1 && x >= d0 && x < d0 + dw;
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if (innen && !ring(x, z)) place.push({ model: 'kit/rom/boden', lift: 0.03, at: [ox + x + 0.5, oz + z + 0.5], params: { conn: 0, cut: 0, belag: 2, ...base, seed: x * 5 + z * 11 } });
    if (!ring(x, z) || door(x, z)) continue;
    const n = ring(x, z - 1) || door(x, z - 1), e = ring(x + 1, z) || door(x + 1, z), s = ring(x, z + 1) || door(x, z + 1), wv = ring(x - 1, z) || door(x - 1, z);
    const conn = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (wv ? 8 : 0);
    place.push({ model: 'kit/rom/wand', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut, ...base, seed: x * 7 + z * 13 } });
  }
  const cx = ox + d0 + dw / 2, cz = oz + d - 0.5;
  if (tuer.tor) place.push({ model: 'kit/rom/tor', at: [cx, cz], params: { cut, ...base, state: tuer.state ?? 0, breite: dw, seed: 3 } });
  else place.push({ model: 'kit/rom/tuer', at: [cx, cz], params: { cut, ...base, state: tuer.state ?? 0, seed: 3 } });
  if (dach) place.push({ model: 'kit/rom/dach', at: [ox, oz], params: { w, d, zustand: 0 } });
}
haus(2, 2, 8, 6, 0, true, { x: 3, breite: 2 }, false);
haus(14, 2, 8, 6, 1, false, { x: 2, breite: 4, tor: true, state: 0 }, true);
// C ohne Tür: Wandring 3x3 + Dach 3x3 und 4x4 daneben
{
  const ox = 26, oz = 2, w = 3, d = 3;
  const ring = (x, z) => x >= 0 && z >= 0 && x < w && z < d && (x === 0 || z === 0 || x === w - 1 || z === d - 1);
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if (!ring(x, z)) continue;
    const conn = (ring(x, z - 1) ? 1 : 0) | (ring(x + 1, z) ? 2 : 0) | (ring(x, z + 1) ? 4 : 0) | (ring(x - 1, z) ? 8 : 0);
    place.push({ model: 'kit/rom/wand', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut: 0, ...base, seed: x * 7 + z * 13 } });
  }
  place.push({ model: 'kit/rom/dach', at: [ox, oz], params: { w, d, zustand: 0 } });
  place.push({ model: 'kit/rom/dach', at: [31, 2], params: { w: 4, d: 4, zustand: 0 } });
  place.push({ model: 'kit/rom/dach', at: [31, 7], params: { w: 2, d: 2, zustand: 0 } });
}
// D: Plateau 5x3 mit Kante ringsum und Boden belag 3
for (let z = 0; z < 5; z++) for (let x = 0; x < 7; x++) {
  const r = (xx, zz) => xx >= 0 && zz >= 0 && xx < 7 && zz < 5 && (xx === 0 || zz === 0 || xx === 6 || zz === 4);
  const ox = 2, oz = 10;
  if (r(x, z)) {
    const conn = (r(x, z - 1) ? 1 : 0) | (r(x + 1, z) ? 2 : 0) | (r(x, z + 1) ? 4 : 0) | (r(x - 1, z) ? 8 : 0);
    place.push({ model: 'kit/rom/kante', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut: 0, ...base, seed: x + z } });
  } else place.push({ model: 'kit/rom/boden', lift: 0.03, at: [ox + x + 0.5, oz + z + 0.5], params: { conn: 0, cut: 0, belag: 3, ...base, seed: x * 3 + z } });
}
// E: Gitterreihe 6 Kacheln
for (let x = 0; x < 6; x++) place.push({ model: 'kit/rom/gitter', at: [12 + x + 0.5, 11.5], params: { conn: (x > 0 ? 8 : 0) | (x < 5 ? 2 : 0), cut: 0, ...base, seed: x } });
// F: Landefeld belag 1 (3x3) und Hofboden belag 0 (3x2)
for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) place.push({ model: 'kit/rom/boden', lift: 0.03, at: [20 + x + 0.5, 10 + z + 0.5], params: { conn: 0, cut: 0, belag: 1, ...base, seed: x + 3 * z } });
for (let z = 0; z < 2; z++) for (let x = 0; x < 3; x++) place.push({ model: 'kit/rom/boden', lift: 0.03, at: [25 + x + 0.5, 11 + z + 0.5], params: { conn: 0, cut: 0, belag: 0, ...base, seed: x + 3 * z } });
const leg = { a: { h: 1, top: '#B9AE98', fill: '#2A2A2E' }, b: { h: 1, top: '#AEA38E', fill: '#2A2A2E' } };
const rows = [...Array(D)].map((_, z) => [...Array(W)].map((_, x) => ((x + z) % 2 ? 'a' : 'b')).join(''));
const cam = (t, dist, elev, az) => ({ target: t, dist, elev, az, fov: 36 });
const sc = { id, name: id, palette: 'rom', mood: 'planet_day',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(D).fill('1'.repeat(W)) }, place,
  cameras: { uebersicht: cam([17, 1.0, 7.5], 40, 46, 28), spielnah: cam([18, 0.5, 8], 38, 72, 0), detail: cam([6, 1.6, 8.4], 9, 22, 20),
             innen: cam([18, 0.8, 5.5], 13, 50, 20), tor: cam([18, 1.4, 8.2], 8, 20, 15), kante: cam([5.5, 0.3, 12.5], 10, 35, 25) } };
fs.writeFileSync(`${out}/${id}.json`, JSON.stringify(sc));
