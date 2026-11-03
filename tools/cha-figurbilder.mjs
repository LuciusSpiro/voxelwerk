// Bilder aller Bestandsfiguren mit dem 8er-Kopf (CHA-02 A2): je Gruppe eine Ganzfigur-Reihe und eine Kopf-Reihe, jeweils von vorn und ¾.
// Aufruf: node tools/cha-figurbilder.mjs <Ausgabeordner>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { ladeFigur, baueFigurMitAnbauten } from './cha-lib.mjs';
import { reihe } from './cha-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots', 'cha02'));
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.figures) await ladeFigur(lib, id);
const GRUPPEN = {
  lerche: [['lerche/crew_0'], ['lerche/crew_1'], ['lerche/crew_2'], ['lerche/ivo']],
  crew: [['crew/nova'], ['crew/juno'], ['crew/tami']],
  rostmeute: [0, 1, 2].map((role) => ['lerche/scavenger', { role }]),
  rom: [['rom/legionaer'], ['rom/legionaer', { rank: 1 }]],
  germanen: ['grundtyp', 'grenadier', 'niederhalter', 'schuetze', 'enterer', 'haescher'].map((r) => [`fig/germanen/${r}`]),
  test: [...['grundtyp', 'schuetze', 'enterer', 'haescher', 'test_gross'].map((r) => [`fig/test/${r}`]), ['test/puppe']],
};
for (const [name, liste] of Object.entries(GRUPPEN)) {
  const figs = liste.map(([id, params]) => [...baueFigurMitAnbauten(lib, id, { params }).grid.values()]);
  reihe(path.join(out, `a2-${name}-ganz.png`), figs, { px: 9, yaws: [0, 35], pitch: 8 });
  reihe(path.join(out, `a2-${name}-kopf.png`), figs, { px: 14, yaws: [0, 35, 90], crop: [21, 38], pitch: 8 });
}
console.log('ok', out);
