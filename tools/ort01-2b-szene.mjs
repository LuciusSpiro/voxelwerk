// ORT-01 Gruppe 2b: Szene "Germanen-Außenposten-Hof komplett". node tools/ort01-2b-szene.mjs
import fs from 'node:fs';
const base = JSON.parse(fs.readFileSync('assets/scenes/ort-ger-aussen.json', 'utf8'));
const GA = 'ort/germanen/aussenposten/', GG = 'ort/germanen/gemein/', PG = 'prop/germanen/';
const sx = 9.5, sz = 8.8; // Zellenschuppen
const place = [
  { model: GA + 'halle', at: [7.5, 4] },
  { model: GG + 'schildantenne', at: [13.8, 2.0] },
  { model: GA + 'sensorturm', at: [16.5, 1.5] },
  { model: GG + 'glutleitung', at: [12.6, 4], rot: 90, params: { n: 3 } },
  { model: GG + 'verteiler', at: [12.6, 6.3] },
  { model: GA + 'unterkunft', at: [3.6, 8.9] },
  { model: GA + 'zellenschuppen', at: [sx, sz] },
  { model: GG + 'fassregal', at: [sx, sz - 0.8] },
  { model: GG + 'fasszelle', at: [sx - 0.9, sz + 0.5] },
  { model: GG + 'fasszelle', at: [sx - 0.3, sz + 0.5], params: { charge: 2 } },
  { model: GG + 'fasszelle', at: [sx + 0.3, sz + 0.5], params: { charge: 0 } },
  { model: GG + 'fasszelle', at: [sx + 0.9, sz + 0.5] },
  { model: GA + 'landeplatz', at: [16, 8.1] },
  { model: GA + 'leitfeuer', at: [13.55, 6.4] },
  { model: GA + 'leitfeuer', at: [13.55, 9.8] },
  { model: GA + 'leitfeuer', at: [18.45, 6.4] },
  { model: GA + 'leitfeuer', at: [18.45, 9.8] },
  { model: GA + 'feldpfahl', at: [13.5, 10.7], row: { count: 6, step: [1, 0] } },
  { model: PG + 'aussenposten/runenmast', at: [1.2, 6.4], rot: 90 },
  { model: PG + 'gemein/kiste_stapel', at: [12.2, 8.6], rot: 10 },
  { model: PG + 'gemein/fass', at: [12.1, 9.5] },
  { model: PG + 'gemein/fass', at: [7.0, 7.3] },
  { model: PG + 'gemein/laterne', at: [6.9, 6.5] },
];
const W = 20, D = 14;
const cams = {
  uebersicht: { target: [10, 1.0, 6], dist: 29, elev: 48, az: 28, fov: 36 },
  spielnah: { target: [10, 0.5, 6.5], dist: 23, elev: 72, az: 0, fov: 36 },
  detail: { target: [15.5, 1.0, 7.5], dist: 7.5, elev: 28, az: 25, fov: 36 },
};
const sc = { ...base, id: 'ort-ger-aussen-2b', name: 'ORT-01 Germanen: Außenposten-Hof komplett (2b)', place, cameras: cams };
delete sc.scatter;
fs.writeFileSync('assets/scenes/ort-ger-aussen-2b.json', JSON.stringify(sc, null, 1));
console.log('ok', place.length);
