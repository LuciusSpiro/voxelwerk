// Bild des 8er-Kopfes (CHA-02 A1): nackter Kopf, Kurzschnitt, offenes Haar und Bordhelm je von vorn, ¾ und von der Seite; Hauttöne 0, 1, 5 in einer zweiten Reihe.
// Aufruf: node tools/cha-kopfbild.mjs <Ausgabeordner>
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { baueFigur } from './cha-lib.mjs';
import { reihe } from './cha-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots', 'cha01'));
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));
const fig = (params, haut = 0, haar = 0) => baueFigur(lib, 'cha/spieler', { params, colors: { ...katalog.farben.haut[haut], hair: katalog.farben.haar[haar] } }).grid.values();
const opt = { px: 16, yaws: [0, 30, 90], crop: [22, 36], pitch: 6 };
reihe(path.join(out, 'kopf-a1-frisuren.png'), [fig({ frisur: 'keine' }), fig({ frisur: 'kurz' }), fig({ frisur: 'offen' }), fig({ frisur: 'offen', kopf: 'bordhelm' })], opt);
reihe(path.join(out, 'kopf-a1-hauttoene.png'), [0, 1, 2, 3, 4, 5].map((h) => fig({ frisur: 'keine' }, h)), { px: 12, yaws: [30], crop: [22, 36], pitch: 6 });
reihe(path.join(out, 'figur-a1-standard.png'), [fig({}), fig({ frisur: 'offen', kopf: 'bordhelm', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' }, 2, 3)], { px: 14, yaws: [0, 30, 90, 200] });
console.log('ok', out);
