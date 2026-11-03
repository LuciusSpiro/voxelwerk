// Passprobe des Kopfes für alle Bestandsfiguren (CHA-02 A2): in jeder Pose (stehen, laufen, zielen, knien, sitzen, ...) die Zahl der Kopf-Voxel (samt Aufsatz am Kopf),
// die einem Voxel von Rumpf, Schulter oder Oberarm (samt Schulteraufsatz) näher als DURCHDRINGUNG_RADIUS kommen und das in der Ruhepose nicht tun
// (Methode wie pruefePassung in cha-lib.mjs). Aufruf: node tools/cha-kopfpass.mjs     (gibt JSON aus)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { ladeFigur, baueFigurMitAnbauten, DURCHDRINGUNG_RADIUS } from './cha-lib.mjs';
import { PASS_ZUSTAENDE, poseWerte, posiere } from './cha-pose.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GEGEN = ['torso', 'upperArmL', 'upperArmR'];

/** { zustand: { 'head|torso': n, ... } } für eine Figur. Die Anbauten in den Händen (Waffen) fehlen. */
export function kopfDurchdringung(lib, figId) {
  const fig = lib.get('figures', figId), rig = lib.get('rigs', fig.rig), posen = lib.get('poses', rig.poses);
  const b = baueFigurMitAnbauten(lib, figId), pro = { head: b.pro.head };
  for (const g of GEGEN) pro[g] = b.pro[g] || [];
  const zus = [...PASS_ZUSTAENDE, { id: 'ruhe', pose: null }];
  const welt = zus.map((z) => posiere(rig, pro, z.pose ? poseWerte(posen, z.pose, z.phi) : { joints: {}, lift: 0 }));
  const R2 = DURCHDRINGUNG_RADIUS ** 2;
  const treffer = (w, g) => {
    const s = new Set(), a = w.head, c = w[g];
    for (let i = 0; i < a.length; i += 3) for (let j = 0; j < c.length; j += 3) {
      const dx = a[i] - c[j], dy = a[i + 1] - c[j + 1], dz = a[i + 2] - c[j + 2];
      if (dx * dx + dy * dy + dz * dz < R2) { s.add('h' + i); s.add('g' + j); }
    }
    return s;
  };
  const ruhe = Object.fromEntries(GEGEN.map((g) => [g, treffer(welt[welt.length - 1], g)]));
  const out = {};
  zus.slice(0, -1).forEach((z, k) => { out[z.id] = {}; for (const g of GEGEN) { let n = 0; for (const t of treffer(welt[k], g)) if (!ruhe[g].has(t)) n++; out[z.id]['head|' + g] = n; } });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lib = nodeLibrary(root), idx = await listAssets(root);
  const alle = {};
  for (const id of idx.figures.filter((i) => !i.startsWith('cha/'))) { await ladeFigur(lib, id); alle[id] = kopfDurchdringung(lib, id); }
  console.log(JSON.stringify(alle, null, 1));
}
