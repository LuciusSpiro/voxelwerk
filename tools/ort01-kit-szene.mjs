// ORT-01 K1/K2 (Gruppe 2b): Szene mit echten Kit-Kacheln (kit/germanen/wand, tuer, tor, boden, gitter, dach; art=aussenposten).
//   Haus A: 8x6 "hoch" (Wand 3 m, Dach) mit Tür
//   Haus B: 8x6 "niedrig" (cut=1, ohne Dach, wie bei Sichtlinie) mit Tor und Innenboden (belag 2)
//   Haus C: 8x6 hoch, Zustand umkämpft (zustand 2)
//   dahinter ein Gitterzaun
// node tools/ort01-kit-szene.mjs [id] [palette]
import fs from 'node:fs';
const id = process.argv[2] || 'kit-aussen';
const pal = process.argv[3] || 'nord';
const place = [];
const W = 8, D = 6, ART = 'aussenposten';
function haus(ox, oz, { cut = 0, dach = true, zustand = 0, tor = false, boden = false } = {}) {
  const t0 = Math.floor((W - 2) / 2);   // erste Tür-/Torkachel
  const isTuer = (x, z) => z === D - 1 && x >= t0 && x < t0 + 2;
  const isW = (x, z) => x >= 0 && z >= 0 && x < W && z < D && (x === 0 || z === 0 || x === W - 1 || z === D - 1);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (boden && !isW(x, z)) place.push({ model: 'kit/germanen/boden', lift: 0.03, at: [ox + x + 0.5, oz + z + 0.5], params: { belag: 2, art: ART, zustand, seed: x * 3 + z, conn: 10, cut: 0 } });
    if (!isW(x, z) || isTuer(x, z)) continue;
    const conn = (isW(x, z - 1) ? 1 : 0) | (isW(x + 1, z) ? 2 : 0) | (isW(x, z + 1) ? 4 : 0) | (isW(x - 1, z) ? 8 : 0);
    place.push({ model: 'kit/germanen/wand', at: [ox + x + 0.5, oz + z + 0.5], params: { conn, cut, art: ART, zustand, seed: (x * 7 + z * 13 + ox) % 97 } });
  }
  if (tor) place.push({ model: 'kit/germanen/tor', at: [ox + t0 + 1, oz + D - 0.5], params: { cut, art: ART, zustand, state: 0, breite: 2, seed: 3 } });
  else place.push({ model: 'kit/germanen/tuer', at: [ox + t0 + 1, oz + D - 0.5], params: { cut, art: ART, zustand, state: 1, seed: 3 } });
  if (dach) place.push({ model: 'kit/germanen/dach', at: [ox, oz], params: { w: W, d: D, zustand } });
}
haus(2, 2, {});
haus(12, 2, { cut: 1, dach: false, tor: true, boden: true });
haus(22, 2, { zustand: 2 });
// Gitterzaun (Ost-West) mit Pfosten an den Enden
for (let x = 0; x < 8; x++) place.push({ model: 'kit/germanen/gitter', at: [12 + x + 0.5, 10.5], params: { conn: (x > 0 ? 8 : 0) | (x < 7 ? 2 : 0), cut: 0, art: ART, zustand: 0, seed: x } });
// Hof-Streifen mit Boden belag 0 (Plateau/Hof)
for (let x = 0; x < 4; x++) place.push({ model: 'kit/germanen/boden', lift: 0.03, at: [2 + x + 0.5, 10.5], params: { belag: 0, art: ART, zustand: 0, seed: x, conn: 10, cut: 0 } });
const Wd = 32, Dd = 13;
const leg = { g: { h: 1, top: { noise: ['#6F7A55', '#5E6849', '#848C6A'], weights: [3, 2, 1] }, fill: '#4A3F33' }, p: { h: 1, top: '#8A8A82', fill: '#4A3F33' } };
const rows = [...Array(Dd)].map((_, z) => [...Array(Wd)].map((_, x) => (x >= 1 && x < Wd - 1 && z >= 1 && z < Dd - 1 ? 'p' : 'g')).join(''));
const sc = {
  id, name: id, palette: pal, mood: 'planet_day',
  terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(Dd).fill('1'.repeat(Wd)) },
  place,
  cameras: {
    uebersicht: { target: [16, 1.0, 6], dist: 36, elev: 48, az: 28, fov: 36 },
    spielnah: { target: [16, 0.5, 6.5], dist: 32, elev: 72, az: 0, fov: 36 },
    detail: { target: [15, 1.0, 8], dist: 9, elev: 24, az: 15, fov: 36 },
    tuer: { target: [6, 1.1, 8], dist: 8, elev: 18, az: 12, fov: 36 },
  },
};
fs.writeFileSync(new URL(`../assets/scenes/${id}.json`, import.meta.url), JSON.stringify(sc));
console.log(id, place.length);
