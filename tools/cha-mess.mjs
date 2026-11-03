// Messung der Figuren: Voxel und Dreiecke je Figur, dazu Kopfteil und Kopfbreite (Bestandsaufnahme für CHA-02).
// Methode wie FIG-01 (mess-figuren): jedes Teil einzeln gebaut und vernetzt (core/mesher.js, mit AO, Greedy), Dreiecke = Indizes / 3 der beleuchteten
// und leuchtenden Netze, Teile und Anbauten (attach, z. B. Waffe) getrennt ausgewiesen. Spiegelteile zählen einzeln.
//
// Aufruf: node tools/cha-mess.mjs [--json] [Filter]
//   Filter   nur Figuren, deren ID den Text enthält (z. B. cha/, germanen)
// Zusätzlich: Spielerfigur im Worst Case (je Platz das Teil mit den meisten Dreiecken, CHA-02 D1) neben dem Standard; Baukasten-Gegner stehen in assets/figures/fig/*.
//   --teile   je Platz und Teil die Dreiecke und der Unterschied zum leeren Wert (keine/keiner), Grenze je Oberteil +1500 (CHA-02 D)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { meshGrid } from '../core/mesher.js';
import { platzOptionen, LEERE_WERTE } from './cha-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), json = args.includes('--json'), filter = args.find((a) => !a.startsWith('--'));
const lib = nodeLibrary(root), idx = await listAssets(root);


async function ladeFigur(figId) {
  const f = await lib.load('figures', figId);
  for (const p of [...Object.values(f.parts || {}), ...Object.values(f.attach || {})]) await lib.load('models', p.model);
  return f;
}

function messe(figId, opts = {}) {
  const fig = lib.get('figures', figId), rig = lib.get('rigs', fig.rig);
  const palette = fig.palette, colors = { ...(fig.colors || {}), ...(opts.colors || {}) }, params = { ...(fig.params || {}), ...(opts.params || {}) };
  const r = { voxel: 0, dreiecke: 0, voxelAnbau: 0, dreieckeAnbau: 0, kopf: null, kopfModell: fig.parts?.head?.model, kopfBreite: null, kopfHoehe: null, kopfTiefe: null };
  const teil = (part, anbau) => {
    const b = lib.build(part.model, { params: lib.partParams(part.model, params, part.params), palette: part.palette || palette, colors });
    const m = meshGrid(b.grid), tri = (m.lit.indices.length + m.emit.indices.length) / 3;
    if (anbau) { r.voxelAnbau += b.grid.size; r.dreieckeAnbau += tri; } else { r.voxel += b.grid.size; r.dreiecke += tri; }
    return b;
  };
  for (const [jn, part] of Object.entries(fig.parts || {})) {
    const b = teil(part, false);
    if (jn === 'head') {   // Kopf: Voxel ab Halsansatz (y >= 26), Breite/Tiefe/Höhe der Voxelhülle
      const vs = [...b.grid.values()].filter((v) => v.y >= 26);
      if (vs.length) {
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (const v of vs) for (const [i, w] of [[0, v.x], [1, v.y], [2, v.z]]) { mn[i] = Math.min(mn[i], w); mx[i] = Math.max(mx[i], w); }
        r.kopfBreite = mx[0] - mn[0] + 1; r.kopfHoehe = mx[1] - mn[1] + 1; r.kopfTiefe = mx[2] - mn[2] + 1;
      }
    }
  }
  for (const a of Object.values({ ...(fig.attach || {}), ...(opts.attach || {}) })) if (a) teil(a, true);
  r.dreiecke = Math.round(r.dreiecke); r.dreieckeAnbau = Math.round(r.dreieckeAnbau);
  return r;
}

const zeilen = [];
for (const id of idx.figures.filter((i) => !filter || i.includes(filter))) {
  try { await ladeFigur(id); zeilen.push({ id, ...messe(id) }); } catch (e) { zeilen.push({ id, fehler: e.message }); }
}
let WORST = null;
if (lib.get('figures', 'cha/spieler') && (!filter || 'cha/spieler'.includes(filter) || filter.startsWith('cha'))) {
  // Worst Case: je Platz das Teil mit den meisten Dreiecken (einzeln gegen die Standardfigur gemessen); Plätze und Werte stehen als options in den Sammelmodellen
  for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
  const optionen = platzOptionen(lib, idx.models), params = {}, tabelle = [];
  for (const [p, ws] of Object.entries(optionen)) {
    if (p === 'koerper') continue;
    const leer = ws.find((w) => LEERE_WERTE.includes(w)), basis = leer ? messe('cha/spieler', { params: { [p]: leer } }).dreiecke : null;
    let best = null;
    for (const w of ws) { const d = messe('cha/spieler', { params: { [p]: w } }).dreiecke; tabelle.push({ platz: p, teil: w, dreiecke: d, gegenLeer: basis === null ? null : d - basis }); if (!best || d > best.d) best = { w, d }; }
    params[p] = best.w;
  }
  WORST = params;
  if (args.includes('--teile')) { console.log('Teil'.padEnd(28) + 'Dreiecke'.padStart(9) + '  gegen leer'); for (const t of tabelle) console.log(`${t.platz}/${t.teil}`.padEnd(28) + String(t.dreiecke).padStart(9) + (t.gegenLeer === null ? '' : `  ${t.gegenLeer >= 0 ? '+' : ''}${t.gegenLeer}`)); console.log(''); }
  try { zeilen.push({ id: 'cha/spieler (Worst Case: ' + Object.values(params).join(', ') + ')', ...messe('cha/spieler', { params }) }); } catch (e) { zeilen.push({ id: 'cha/spieler Worst Case', fehler: e.message }); }
}

// ---- CHA-02 D2: Worst Case mit Lorica (Rüstung statt Plankenweste)
if (WORST && lib.get('figures', 'cha/spieler') && (!filter || filter.startsWith('cha'))) {
  const params = { ...WORST, oberteil: 'lorica' };
  try { zeilen.push({ id: 'cha/spieler (Worst Case Lorica: ' + Object.values(params).join(', ') + ')', ...messe('cha/spieler', { params }) }); } catch (e) { zeilen.push({ id: 'cha/spieler Worst Case Lorica', fehler: e.message }); }
}
// ---- CHA-02 D2 (Ende)

if (json) console.log(JSON.stringify(zeilen, null, 1));
else {
  console.log('Figur'.padEnd(34) + 'Voxel'.padStart(7) + 'Dreiecke'.padStart(10) + '  Anbau V/D'.padEnd(14) + 'Kopfteil'.padEnd(34) + 'Breite×Höhe×Tiefe');
  for (const z of zeilen) {
    if (z.fehler) { console.log(z.id.padEnd(34) + 'FEHLER ' + z.fehler); continue; }
    console.log(z.id.padEnd(34) + String(z.voxel).padStart(7) + String(z.dreiecke).padStart(10) + `  ${z.voxelAnbau}/${z.dreieckeAnbau}`.padEnd(14) + String(z.kopfModell).padEnd(34) + (z.kopfBreite ? `${z.kopfBreite}×${z.kopfHoehe}×${z.kopfTiefe}` : '-'));
  }
}
