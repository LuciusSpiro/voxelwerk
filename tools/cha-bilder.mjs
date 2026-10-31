// Bilder der Spielerfigur aus Schichten (cha/) mit dem Node-Renderer, ohne Browser. Schreibt nach shots/cha01/ (nicht im Git).
// Aufruf: node tools/cha-bilder.mjs [Präfix]      Standard-Präfix "a2"
//   <präfix>-raster-<platz>.png   alle Teile des Platzes nebeneinander (Reihenfolge wie im Katalog), je Teil Vorder-, Seiten-, Rückansicht;
//                                 Kopf-Plätze als Ausschnitt, Kopfbedeckung zusätzlich mit Zöpfen
//   <präfix>-misch-<n>.png        drei Mischfiguren
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { baueFigur, platzOptionen } from './cha-lib.mjs';
import { reihe } from './cha-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = process.argv[2] || 'a2';
const out = (n) => path.join(root, 'shots', 'cha01', `${prefix}-${n}.png`);
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));
const optionen = platzOptionen(lib, idx.models);
const farbe = (haut = 0, haar = 0) => ({ ...katalog.farben.haut[haut], hair: katalog.farben.haar[haar] });
const figur = (params = {}, colors = farbe()) => baueFigur(lib, 'cha/spieler', { params, colors }).grid.values();

const KOPF = ['gesicht', 'frisur', 'bart', 'kopf'];
for (const platz of ['gesicht', 'frisur', 'bart', 'kopf', 'oberteil', 'hose', 'schuhe', 'haende', 'umhang']) {
  const figs = (optionen[platz] || []).map((w) => figur({ [platz]: w }));
  if (platz === 'kopf') for (const w of optionen.kopf) figs.push(figur({ kopf: w, frisur: 'zoepfe' }));
  reihe(out(`raster-${platz}`), figs, KOPF.includes(platz) ? { px: 15, yaws: [18, 100, 200], crop: [21, 35], pitch: 8 } : { px: 8, yaws: [18, 100] });
  console.log(`raster-${platz}: ${figs.length} Figuren (${(optionen[platz] || []).join(', ')}${platz === 'kopf' ? ' | dann mit Zöpfen' : ''})`);
}

const MISCH = [
  ['1 ganz germanisch (Haut 1, Haar blond)', { gesicht: 'lerche', frisur: 'zoepfe', bart: 'vollbart', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' }, farbe(1, 2)],
  ['2 Bordtunika, Bordhelm, Fellumhang (Haut 2, Haar rot)', { kopf: 'bordhelm', umhang: 'fellumhang' }, farbe(2, 3)],
  ['3 Narbe, Vollbart, Zöpfe, ohne Kopfbedeckung (Haut 3, Haar schwarz)', { gesicht: 'narbe', bart: 'vollbart', frisur: 'zoepfe' }, farbe(3, 1)],
];
MISCH.forEach(([name, params, colors], i) => { reihe(out(`misch-${i + 1}`), [figur(params, colors)], { px: 16, yaws: [18, 100, 200] }); console.log(`misch-${i + 1}: ${name}`); });
