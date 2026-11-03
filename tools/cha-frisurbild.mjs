// Bilder der Frisuren (CHA-02 Paket B): je Frisur Front, ¾, Seite, Rücken; alle Frisuren mit Bordhelm; alle 8 Haarfarben; alle 6 Hauttöne.
// Aufruf: node tools/cha-frisurbild.mjs <Ausgabeordner> [Frisur für Haar- und Hautbilder, Standard welle]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { baueFigur } from './cha-lib.mjs';
import { reihe } from './cha-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots', 'cha02'));
const bild = process.argv[3] || 'welle';
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));
const fig = (params, haut = 0, haar = 0) => baueFigur(lib, 'cha/spieler', { params, colors: { ...katalog.farben.haut[haut], hair: katalog.farben.haar[haar] } }).grid.values();
const frisuren = katalog.teile.filter((t) => t.platz === 'frisur').map((t) => t.id.split('/')[1]);
const opt = { px: 20, crop: [19, 36], pitch: 6 };
for (const f of frisuren) reihe(path.join(out, `frisur-${f}.png`), [fig({ frisur: f })], { ...opt, yaws: [0, 35, 90, 180] });
reihe(path.join(out, 'frisur-mit-bordhelm.png'), frisuren.map((f) => fig({ frisur: f, kopf: 'bordhelm' })), { ...opt, px: 14, yaws: [35, 150] });
reihe(path.join(out, `haarfarben-${bild}.png`), katalog.farben.haar.map((_, i) => fig({ frisur: bild }, 0, i)), { ...opt, px: 14, yaws: [35] });
reihe(path.join(out, `hauttoene-${bild}.png`), katalog.farben.haut.map((_, i) => fig({ frisur: bild }, i, 0)), { ...opt, px: 14, yaws: [35] });
console.log('ok', out, frisuren.join(','));
