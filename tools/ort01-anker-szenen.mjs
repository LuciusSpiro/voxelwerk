// ORT-01 B1: Szenen mit allen Anker-Zuständen nebeneinander. node tools/ort01-anker-szenen.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets/scenes');
function scene(id, name, pal, mood, floor, rows, W, D, cam) {
  const place = [];
  rows.forEach((r, ri) => r.states.forEach((s, ci) => {
    const p = { model: r.model, at: [1.5 + ci * r.step, 1.5 + ri * r.rowStep], params: { state: s } };
    if (r.model.endsWith('reaktor')) p.params = { state: s };
    place.push(p);
  }));
  const cx = W / 2, cz = D / 2;
  const terrain = { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: { a: { h: 1, top: floor, fill: '#2A2A2E' } },
    rows: Array.from({ length: D }, () => 'a'.repeat(W)), heights: Array.from({ length: D }, () => '1'.repeat(W)) };
  const cams = { uebersicht: { target: [cx, 0.8, cz], dist: Math.max(W, D) * 1.3, elev: 48, az: 28, fov: 36 },
    spielnah: { target: [cx, 0.5, cz + 0.5], dist: Math.max(W, D) * 1.15, elev: 72, az: 0, fov: 36 },
    detail: cam || { target: [cx, 0.8, cz], dist: Math.max(W, D) * 0.75, elev: 28, az: 18, fov: 36 } };
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ id, name, palette: pal, mood, terrain, place, cameras: cams }, null, 1) + '\n');
}
const FL = { rom: '#D9CFBA', germanen: '#6A6864', aussenR: '#CFC4AE', aussenG: '#8A8A82' };
for (const k of ['rom', 'germanen']) {
  const R = k === 'rom', pal = R ? 'rom' : 'nord', P = `ort/${k}/`;
  const ziel = P + 'gemein/' + (R ? 'feldstandarte' : 'feldmast');
  const klein = [
    { model: ziel, states: [0, 1, 2], step: 2, rowStep: 2 },
    { model: P + 'gemein/zelle', states: [0, 1], step: 2, rowStep: 2 },
    { model: P + 'gemein/' + (R ? 'kassenkapsel' : 'fasstresor'), states: [0, 1], step: 2, rowStep: 2 },
    { model: P + 'gemein/terminal', states: [0, 1, 2, 3], step: 2, rowStep: 2 },
    { model: R ? 'ort/rom/gemein/abholbake' : 'prop/germanen/gemein/bake_abholpunkt', states: [0, 1], step: 2, rowStep: 2 },
  ];
  scene(`ort-anker-${k}-klein`, `ORT-01 B1 ${k}: Anker-Zustände (klein)`, pal, 'hall_metall', FL[k], klein, 9, 11);
  scene(`ort-anker-${k}-reaktor`, `ORT-01 B1 ${k}: Sprengreaktor`, pal, 'hall_metall', FL[k],
    [{ model: P + 'station/sprengreaktor', states: [0, 1, 2, 3], step: 3, rowStep: 3 }], 13, 4, { target: [6.5, 0.8, 2], dist: 9, elev: 30, az: 15, fov: 36 });
  scene(`ort-anker-${k}-aussen`, `ORT-01 B1 ${k}: Anker Außenposten`, pal, 'planet_day', R ? FL.aussenR : FL.aussenG,
    [{ model: P + 'aussenposten/' + (R ? 'zellenbatterie' : 'glutspeicher'), states: [0, 1, 2, 3], step: 2, rowStep: 2 },
     { model: ziel, states: [0, 1, 2], step: 2, rowStep: 2 },
     { model: P + 'gemein/' + (R ? 'kassenkapsel' : 'fasstresor'), states: [0, 1], step: 2, rowStep: 2 },
     { model: P + 'gemein/zelle', states: [0, 1], step: 2, rowStep: 2 }], 9, 8);
}
