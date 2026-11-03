// Bilder der Spielerfigur aus Schichten (cha/) mit dem Node-Renderer, ohne Browser. Schreibt nach shots/cha01/ (nicht im Git).
// Aufruf: node tools/cha-bilder.mjs [Präfix]      Standard-Präfix "a2"
//   <präfix>-raster-<platz>.png   alle Teile des Platzes nebeneinander (Reihenfolge wie im Katalog), je Teil Vorder-, Seiten-, Rückansicht;
//                                 Kopf-Plätze als Ausschnitt, Kopfbedeckung zusätzlich mit Zöpfen
//   <präfix>-misch-<n>.png        drei Mischfiguren
//   <präfix>-portraet-<n>.png     vier Porträts aus Charakterkarten (portraet() in tools/cha-ansicht.mjs, Grund = figurGrund der Kammer), Vergleichsbilder für die Live-Porträts des Spiels
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { baueFigur, platzOptionen } from './cha-lib.mjs';
import { reihe, encodePng } from './cha-render.mjs';
import { portraet } from './cha-ansicht.mjs';

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

const KOPF = ['frisur', 'kopf'];
for (const platz of ['frisur', 'kopf', 'oberteil', 'hose', 'schuhe', 'haende', 'umhang']) {
  const figs = (optionen[platz] || []).map((w) => figur({ [platz]: w }));
  if (platz === 'kopf') for (const w of optionen.kopf) figs.push(figur({ kopf: w, frisur: 'zoepfe' }));
  reihe(out(`raster-${platz}`), figs, KOPF.includes(platz) ? { px: 15, yaws: [18, 100, 200], crop: [21, 35], pitch: 8 } : { px: 8, yaws: [18, 100] });
  console.log(`raster-${platz}: ${figs.length} Figuren (${(optionen[platz] || []).join(', ')}${platz === 'kopf' ? ' | dann mit Zöpfen' : ''})`);
}

const MISCH = [
  ['1 ganz germanisch (Haut 1, Haar blond)', { frisur: 'zoepfe', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' }, farbe(1, 2)],
  ['2 Bordtunika, Bordhelm, Fellumhang (Haut 2, Haar rot)', { kopf: 'bordhelm', umhang: 'fellumhang' }, farbe(2, 3)],
  ['3 Zöpfe, ohne Kopfbedeckung (Haut 5 sehr dunkel, Haar schwarz)', { frisur: 'zoepfe' }, farbe(5, 1)],
];
MISCH.forEach(([name, params, colors], i) => { reihe(out(`misch-${i + 1}`), [figur(params, colors)], { px: 16, yaws: [18, 100, 200] }); console.log(`misch-${i + 1}: ${name}`); });

// Porträts: Karten im Format der Spiel-Charakterkarte (Pantheon shared/charakter.js), Grund wie figurGrund der Kammer (rom)
const KARTEN = [
  { name: 'Standard', karte: { v: 2, koerper: 'standard', frisur: 'dutt', haut: 0, haar: 0, outfit: {} } },
  { name: 'Germanin: Zöpfe, Haut 1, Haar blond', karte: { v: 2, koerper: 'standard', frisur: 'zoepfe', haut: 1, haar: 2, outfit: { oberteil: 'plankenweste', umhang: 'fellumhang' } } },
  { name: 'Bordhelm mit Zöpfen, Haut 2, Haar rot', karte: { v: 2, koerper: 'standard', frisur: 'zoepfe', haut: 3, haar: 3, outfit: { kopf: 'bordhelm' } } },
  { name: 'Kahl, Haut 5 (sehr dunkel)', karte: { v: 2, koerper: 'standard', frisur: 'keine', haut: 5, haar: 1, outfit: {} } },
];
KARTEN.forEach(({ name, karte }, i) => {
  const cv = portraet(lib, katalog, karte, { bg: [0, 4, 19, 255] });
  fs.writeFileSync(out(`portraet-${i + 1}`), encodePng(cv.w, cv.h, cv.d)); console.log(`portraet-${i + 1}: ${name}`);
});
