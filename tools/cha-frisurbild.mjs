// Bilder der Frisuren (CHA-02 B): je Frisur Front, ¾, Seite, hinten; mit Bordhelm; alle Haarfarben (bartlang); alle Hauttöne (eine Frisur).
// Aufruf: node tools/cha-frisurbild.mjs <Ausgabeordner> [Frisur,Frisur,...]   (Standard: die vier germanischen Frisuren)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { baueFigur } from './cha-lib.mjs';
import { reihe } from './cha-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots', 'cha02'));
const frisuren = (process.argv[3] || 'bartkurz,bartlang,zopfband,wild').split(',');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));
const fig = (params, haut = 0, haar = 0) => baueFigur(lib, 'cha/spieler', { params, colors: { ...katalog.farben.haut[haut], hair: katalog.farben.haar[haar] } }).grid.values();
const ansicht = { px: 13, yaws: [0, 30, 90, 180], crop: [17, 36], pitch: 6 };
for (const f of frisuren) {
  reihe(path.join(out, `frisur-${f}.png`), [fig({ frisur: f })], ansicht);
  reihe(path.join(out, `frisur-${f}-bordhelm.png`), [fig({ frisur: f, kopf: 'bordhelm' })], ansicht);
}
reihe(path.join(out, 'frisur-bartlang-haarfarben.png'), katalog.farben.haar.map((_, i) => fig({ frisur: 'bartlang' }, 0, i)), { px: 9, yaws: [30], crop: [17, 36], pitch: 6 });
reihe(path.join(out, 'frisur-bartkurz-hauttoene.png'), katalog.farben.haut.map((_, i) => fig({ frisur: 'bartkurz' }, i, 0)), { px: 9, yaws: [30], crop: [17, 36], pitch: 6 });
reihe(path.join(out, 'frisur-alle-standard.png'), frisuren.map((f) => fig({ frisur: f })), { px: 9, yaws: [30], crop: [17, 36], pitch: 6 });
console.log('ok', out);
