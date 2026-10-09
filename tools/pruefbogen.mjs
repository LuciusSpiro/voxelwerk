// Prüfbogen für Kit-Teile und Modelle: baut alle Fälle, prüft sie automatisch und rendert einen Kontaktbogen.
//
// Aufruf:
//   node tools/pruefbogen.mjs <id> [<id> …] [--params art=station,zustand=1] [--port 3433] [--nur-pruefung]
//   node tools/pruefbogen.mjs --kit [filter]              alle Modelle mit Tag "kit" (nur Prüfung, ohne Bild: --nur-pruefung)
//   node tools/pruefbogen.mjs --datei <rezept.json>       Rezept außerhalb von assets/ prüfen (Testdaten, Entwürfe)
//   node tools/pruefbogen.mjs --silhouette <ordner> [--pose stand]   alle Figuren unter assets/figures/<ordner>/ als Silhouette
//
// Fälle:
//   Kit-Teile (Tag "kit"): alle 16 conn-Fälle × cut 0/1 × Zustand (zustand/state/open/decay …, soweit deklariert),
//   dazu alle variants. Andere Modelle: Zustandsparameter × variants.
// Prüfungen je Fall (Kachelart aus der ID kit/<bauweise>/<kind> oder aus den Tags):
//   Grundfläche  alle Voxel innerhalb von footprint (Mitte = Anker); Wand & Co. ≤ 1 Kachel
//   Höhe         Wand voll 3 m / geschnitten 1,25 m (ab Anker-y gemessen); Deckung halb ≤ 0,9 m, voll ≥ 2,2 m
//   Türöffnung   tuer/tor/schott im offenen Zustand: mittlere 2 Kacheln (2 m) über die ganze Tiefe bis 2,2 m leer
//   Naht         je gesetztem conn-Bit reicht die Wand lückenlos bis an die Kachelkante und passt zum Gegenstück
//   Budget       Dreiecke je Fall (M4 §5: Wandkachel 600, Boden 150, Architekturmodul 3.000, Detail-Prop 2.500;
//                Rezeptfeld "budgetTris" überschreibt)
// Ausgabe: shots/pruefbogen/<id>.json (Bericht) + shots/pruefbogen/<id>.png (Kontaktbogen über editor/pruefbogen.html).
// Der Server wird bei Bedarf selbst gestartet (Port --port, Standard 3433) und am Ende beendet.
// Exit-Code: 0 = keine Fehler, 1 = Prüfungsfehler, 2 = Renderfehler.
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Library } from '../core/library.js';
import { fsIO, listAssets } from './fs-io.js';
import { voxelSize, tierOf } from '../core/scales.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// Regeln
// ---------------------------------------------------------------------------------------------
const DIRS = [   // conn-Bits: N1 O2 S4 W8; Vorderseite = +z = Süden
  { bit: 1, name: 'N', axis: 2, side: -1 },
  { bit: 2, name: 'O', axis: 0, side: +1 },
  { bit: 4, name: 'S', axis: 2, side: +1 },
  { bit: 8, name: 'W', axis: 0, side: -1 },
];
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };

/**
 * Kachelarten (ART-PLAN §4.1, CONTRACT-B1 §3.1/§10.1) mit ihren Regeln. h/hCut = Sollhöhe (m), hMin/hMax = Grenzen,
 * door = Durchgangsprüfung in den begehbaren Zuständen (width = Durchgangsbreite in m, sonst 2 m).
 */
export const KIT_KINDS = {
  wand:         { h: 3.0, hCut: 1.25, tile: true, budget: 600 },
  zaun:         { hMax: 3.0, tile: true, budget: 600 },
  fenster:      { h: 3.0, hCut: 1.25, tile: true, budget: 600 },
  pfeiler:      { hMin: 2.2, tile: true, budget: 600 },
  deckung_halb: { hMax: 0.9, tile: true, budget: 600 },
  deckung_voll: { hMin: 2.2, tile: true, budget: 600 },
  boden:        { hMax: 0.5, tile: true, budget: 150 },
  luke:         { hMax: 0.5, tile: true, budget: 3000 },
  tuer:         { hMax: 3.0, hCutMax: 1.25, door: true, budget: 3000 },
  tor:          { hMax: 3.0, hCutMax: 1.25, door: true, budget: 3000 },
  schott:       { hMax: 3.0, hCutMax: 1.25, door: true, budget: 3000 },
  gitter:       { hMax: 3.0, tile: true, budget: 600, seamMatch: false }, // Gitterzaun/Zellengitter; Stabraster wiederholt sich, Querschnitt je Kante darf abweichen
  kante:        { hMax: 1.25, tile: true, budget: 600 },                // Plateaurand/Brüstung, halbe Deckung (Plateau 0,5 m optisch)
  truemmer:     { hMax: 0.9, tile: true, budget: 600, noSeam: true },   // halbe Deckung aus dem Zustand-Überzug, kein Fugenbild
  wand_schwach: { h: 3.0, hCut: 1.25, tile: true, budget: 600, door: true, width: 1.0 },   // Zustand „offen“ = begehbar
};

/**
 * Begehbare Zustände je Kachelart aus content/buehnen/kacheln.json des Spiels (state = Index in "zustaende").
 * Pfad: PANTHEON_ROOT=<spiel> oder ../Pantheon neben Voxelwerk. Fehlt die Datei, gilt die Tabelle aus CONTRACT-B1 §3.1.
 */
const KACHELN_FALLBACK = {
  tuer: { zustaende: ['offen', 'zu', 'verschlossen', 'gesprengt'], begehbarIn: ['offen', 'gesprengt'] },
  schott: { zustaende: ['zu', 'offen', 'gehackt', 'verschlossen'], begehbarIn: ['offen', 'gehackt'] },
  tor: { zustaende: ['zu', 'offen', 'gesprengt'], begehbarIn: ['offen', 'gesprengt'] },
  luke: { zustaende: ['zu', 'offen'], begehbarIn: ['offen'] },
  wand_schwach: { zustaende: ['intakt', 'offen'], begehbarIn: ['offen'] },
};
let KACHELN = KACHELN_FALLBACK, KACHELN_QUELLE = 'CONTRACT-B1 §3.1 (eingebaut)';
try {
  const f = path.join(process.env.PANTHEON_ROOT || path.join(root, '..', 'Pantheon'), 'content', 'buehnen', 'kacheln.json');
  const j = JSON.parse(await fs.readFile(f, 'utf8')), t = {};
  for (const z of Object.values(j.zeichen || {})) if (z.zustaende && z.begehbarIn) t[z.kind] = { zustaende: z.zustaende, begehbarIn: z.begehbarIn };
  if (Object.keys(t).length) { KACHELN = { ...KACHELN_FALLBACK, ...t }; KACHELN_QUELLE = f; }
} catch { /* eingebaute Tabelle */ }
export const kachelQuelle = () => KACHELN_QUELLE;
const STATE_PARAMS = ['zustand', 'state', 'open', 'blown', 'decay', 'damaged'];
const DOOR_CLEAR_M = 2.2, DOOR_WIDTH_M = 2.0, EPS = 1e-6;

export function kindOf(model) {
  const m = /(?:^|\/)kit\/[^/]+\/([a-z_]+)$/.exec(model.id || '');
  if (m && KIT_KINDS[m[1]]) return m[1];
  const tags = model.tags || [];
  return Object.keys(KIT_KINDS).find((k) => tags.includes(k)) || null;
}
const isKit = (model) => (model.tags || []).includes('kit') || /(?:^|\/)kit\//.test(model.id || '');

/** Ist der Fall „offen“ im Sinne der Türprüfung? */
function doorOpen(kind, p) {
  const k = KACHELN[kind];
  if (k && 'state' in p) return k.begehbarIn.includes(k.zustaende[p.state]);   // Vertrag: state = Index in den Zuständen
  if ('open' in p) return p.open >= 1;                                          // ältere Teile (M4: lerche/kit/door)
  return p.blown === 1;
}

// ---------------------------------------------------------------------------------------------
// Fälle
// ---------------------------------------------------------------------------------------------
const range = (d) => { const out = []; for (let v = d.min ?? 0; v <= (d.max ?? 0) + EPS; v += d.step || 1) out.push(+v.toFixed(6)); return out; };
const numParam = (decl) => decl && !decl.options && typeof (decl.default ?? 0) === 'number';
const fmtP = (p) => Object.entries(p).map(([k, v]) => `${k}=${v}`).join(' ');

/** Alle Fälle eines Modells: [{ key, section, row, label, params }]. fixed = feste Parameter (--params). */
export function casesOf(model, fixed = {}) {
  const decl = model.params || {}, kit = isKit(model) || !!kindOf(model), out = [], seen = new Set();
  // feste Parameter (--params) nur, wenn das Modell sie deklariert (Steckplatz-Teile kennen z. B. "bauweise" nicht)
  fixed = Object.fromEntries(Object.entries(fixed).filter(([k]) => k in decl || k === 'seed'));
  const defaults = Object.fromEntries(Object.entries(decl).map(([k, d]) => [k, d.default]));
  const add = (section, row, label, params) => {
    const full = { ...defaults, ...params, ...fixed };
    const k = JSON.stringify(Object.keys(full).sort().map((x) => [x, full[x]]));
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ key: `${section}|${row}|${label}`, section, row, label, params: { ...params, ...fixed } });
  };
  const stateAxes = STATE_PARAMS.filter((k) => numParam(decl[k]) && !(k in fixed)).map((k) => [k, range(decl[k]).slice(0, 6)]);
  const cutAxis = numParam(decl.cut) && !('cut' in fixed) ? [['cut', range(decl.cut)]] : [];
  const product = (axes) => axes.reduce((acc, [k, vals]) => acc.flatMap((a) => vals.map((v) => ({ ...a, [k]: v }))), [{}]);
  if (kit && numParam(decl.conn) && !('conn' in fixed)) {
    for (const rowP of product([...cutAxis, ...stateAxes])) {
      for (let c = 0; c < 16; c++) add('Anschlüsse', fmtP(rowP) || 'Standard', `conn ${c}`, { ...rowP, conn: c });
    }
  } else {
    const axes = [...cutAxis, ...stateAxes];
    if (axes.length) for (const p of product(axes)) add('Zustände', axes.map(([k]) => k).join(' × '), fmtP(p), p);
  }
  add('Varianten', 'variants', 'default', {});
  for (const [name, v] of Object.entries(model.variants || {})) add('Varianten', 'variants', name, v);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prüfungen
// ---------------------------------------------------------------------------------------------
/**
 * Kernband einer Randschicht der Kachel: Set "y,t" (t = Koordinate entlang der Kante, relativ zur Kachel).
 * Ausgelassen wird je Seite ein Randstreifen von 25 cm (Schauseiten-Relief, Nischen, Kanten), weil sich der
 * Querschnitt dort je nach Freistellung der Nachbarseiten zu Recht ändert (Innenecke, Feld vertieft …).
 */
function edgeCore(grid, tile, dir, margin) {
  const fixedC = dir.side > 0 ? tile.max[dir.axis] - 1 : tile.min[dir.axis];
  const tAxis = dir.axis === 0 ? 2 : 0, W = tile.max[tAxis] - tile.min[tAxis], set = new Set();
  for (const v of grid.values()) {
    const c = [v.x, v.y, v.z];
    if (c[dir.axis] !== fixedC) continue;
    const t = c[tAxis] - tile.min[tAxis];
    if (t < margin || t > W - 1 - margin) continue;
    set.add(`${v.y},${t}`);
  }
  return set;
}
const setDiff = (a, b) => { let n = 0; for (const x of a) if (!b.has(x)) n++; return n; };

/**
 * Prüft ein Modell in allen Fällen. lib muss das Modell geladen haben.
 * Rückgabe: { id, name, kind, tier, budget, cases: [{ …case, tris, heightM, voxels, errors, warnings }], errors, warnings }
 */
export function pruefeModell(lib, id, fixed = {}) {
  const model = lib.get('models', id);
  if (!model) throw new Error(`Modell "${id}" nicht geladen`);
  const kind = kindOf(model), rule = KIT_KINDS[kind] || null, kit = isKit(model);
  const vpm = tierOf(model.tier).voxelsPerMeter, s = voxelSize(model.tier);
  const budget = model.budgetTris ?? rule?.budget ?? (model.tier === 'detail' ? 2500 : 3000);
  const fp = model.footprint || [1, 1];
  const report = { id, name: model.name, kind, kit, tier: model.tier, footprint: fp, budget, fixed, cases: [], errors: 0, warnings: 0, modelErrors: [] };

  if (rule?.tile && (fp[0] > 1 + EPS || fp[1] > 1 + EPS)) report.modelErrors.push(`Grundfläche ${fp.join('×')} m: Kachelart ${kind} darf höchstens 1 Kachel belegen`);
  if (rule?.door && !rule.tile && fp[1] > 1 + EPS) report.modelErrors.push(`Grundfläche ${fp.join('×')} m: Tür/Tor/Schott höchstens 1 Kachel tief`);
  const doorW = rule?.width ?? DOOR_WIDTH_M;
  if (rule?.door && fp[0] < doorW - EPS) report.modelErrors.push(`Breite ${fp[0]} m: ${kind} braucht ${doorW} m Durchgang (Kantenmitte), Grundfläche zu schmal`);

  const cases = casesOf(model, fixed);
  const built = new Map();
  const build = (params) => {
    const k = JSON.stringify(params);
    if (!built.has(k)) built.set(k, lib.build(id, { params }));
    return built.get(k);
  };

  for (const c of cases) {
    const r = { ...c, errors: [], warnings: [] };
    report.cases.push(r);
    let b;
    try { b = build(c.params); } catch (e) { r.errors.push(`Bau: ${e.message}`); continue; }
    const g = b.grid, a = b.anchor;
    r.voxels = g.size;
    r.tris = 2 * (b.mesh.lit.quads + b.mesh.emit.quads);
    if (!g.size) { r.errors.push('leer'); continue; }
    const bb = g.bounds();
    r.heightM = +((bb.max[1] + 1 - a[1]) * s).toFixed(3);
    r.bounds = { min: bb.min.map((v, i) => +((v - a[i]) * s).toFixed(3)), max: bb.max.map((v, i) => +((v + 1 - a[i]) * s).toFixed(3)) };
    const p = { ...Object.fromEntries(Object.entries(model.params || {}).map(([k, d]) => [k, d.default])), seed: 0, ...c.params };

    // Budget (gilt für alle Modelle; bei Nicht-Kit-Teilen nur Warnung)
    if (r.tris > budget) (kit || rule ? r.errors : r.warnings).push(`Budget: ${r.tris} Dreiecke > ${budget}`);
    if (!rule) continue;

    const f2 = (x) => x.toFixed(2).replace('.', ',');
    // Grundfläche: alle Voxel innerhalb des footprint-Rechtecks um den Anker
    const tile = {
      min: [a[0] - fp[0] * vpm / 2, -Infinity, a[2] - fp[1] * vpm / 2],
      max: [a[0] + fp[0] * vpm / 2, Infinity, a[2] + fp[1] * vpm / 2],
    };
    if (bb.min[0] < tile.min[0] - EPS || bb.max[0] + 1 > tile.max[0] + EPS || bb.min[2] < tile.min[2] - EPS || bb.max[2] + 1 > tile.max[2] + EPS) {
      r.errors.push(`Grundfläche: ragt über die Kachel (x ${f2(r.bounds.min[0])}…${f2(r.bounds.max[0])} m, z ${f2(r.bounds.min[2])}…${f2(r.bounds.max[2])} m, erlaubt ±${f2(fp[0] / 2)} / ±${f2(fp[1] / 2)} m)`);
    }

    // Höhe
    const cut = p.cut > 0, worn = STATE_PARAMS.some((k) => k !== 'open' && k !== 'state' && p[k] > 0) || (!!rule.door && doorOpen(kind, p));
    const H = r.heightM;
    if (rule.h) {
      const want = cut ? rule.hCut : rule.h;
      if (worn ? H > want + EPS : Math.abs(H - want) > EPS) r.errors.push(`Höhe ${f2(H)} m, Soll ${worn ? '≤ ' : ''}${f2(want)} m (${cut ? 'geschnitten' : 'voll'})`);
      else if (worn && !(rule.door && doorOpen(kind, p)) && H < want * 0.75) r.warnings.push(`Höhe ${f2(H)} m bei Verfall deutlich unter ${f2(want)} m`);
    }
    const hMax = cut && rule.hCutMax ? rule.hCutMax : rule.hMax;
    if (hMax && H > hMax + EPS) r.errors.push(`Höhe ${f2(H)} m > ${f2(hMax)} m`);
    if (rule.hMin && !cut && !worn && H < rule.hMin - EPS) r.errors.push(`Höhe ${f2(H)} m < ${f2(rule.hMin)} m (volle Deckung)`);
    if (bb.min[1] < a[1] - 1) r.warnings.push(`reicht ${((a[1] - bb.min[1]) * s).toFixed(2)} m unter den Boden`);

    // Türöffnung: mittlere 2 Kacheln über die ganze Tiefe bis 2,2 m frei
    if (rule.door && doorOpen(kind, p)) {
      const hy = a[1] + Math.round(DOOR_CLEAR_M * vpm), x0 = a[0] - doorW * vpm / 2, x1 = a[0] + doorW * vpm / 2;
      const blockedCols = new Set();
      let n = 0, low = 0;
      const sill = a[1] + Math.round(0.5 * vpm);   // bis 0,5 m: Schwelle/Schutt im Durchgang → Warnung statt Fehler
      for (const v of g.values()) {
        if (v.y < a[1] || v.y >= hy || v.z < tile.min[2] || v.z >= tile.max[2]) continue;
        if (v.y >= sill) blockedCols.add(v.x);
        if (v.x >= x0 && v.x < x1) { if (v.y < sill) low++; else n++; }
      }
      // lichte Weite: freie Spalten um die Mitte
      let l = Math.floor(a[0]) - 1, rr = Math.floor(a[0]);
      while (!blockedCols.has(l) && l >= tile.min[0] - 1 && l > a[0] - 4 * vpm) l--;
      while (!blockedCols.has(rr) && rr < tile.max[0] + 1 && rr < a[0] + 4 * vpm) rr++;
      r.clearM = +(((rr - l - 1) * s)).toFixed(3);
      if (n) r.errors.push(`Türöffnung: ${n} Voxel in der Durchgangszone (${f2(doorW)} m × ${fp[1]} m, 0,5–2,2 m), lichte Weite ${f2(r.clearM)} m`);
      if (low) r.warnings.push(`Türöffnung: ${low} Voxel Schwelle/Schutt unter 0,5 m im Durchgang`);
    }

    // Anschlussnaht: je gesetztem conn-Bit lückenlos bis an die Kachelkante, passend zum Gegenstück
    if ('conn' in p && (model.params || {}).conn && !rule.noSeam) {
      const margin = Math.max(1, Math.round(0.25 * vpm));
      const tileI = { min: [Math.round(tile.min[0]), 0, Math.round(tile.min[2])], max: [Math.round(tile.max[0]), 0, Math.round(tile.max[2])] };
      for (const d of DIRS) {
        if (!(p.conn & d.bit)) continue;
        const layer = edgeCore(g, tileI, d, margin);
        if (!layer.size) { r.errors.push(`Naht ${d.name}: Wand erreicht die Kachelkante nicht`); continue; }
        const rows = new Set([...layer].map((k) => +k.split(',')[0]));
        const top = Math.max(...rows), gaps = [];
        for (let y = a[1]; y <= top; y++) if (!rows.has(y)) gaps.push(y);
        if (gaps.length) r.errors.push(`Naht ${d.name}: Lücke an der Kachelkante in ${gaps.length} Schicht(en) ab ${f2((gaps[0] - a[1]) * s)} m`);
        // Gegenstück: dieselben Parameter, conn = beide Bits dieser Achse → Gegenseite muss deckungsgleich sein
        const refP = { ...c.params, conn: d.bit | OPP[d.bit] };
        let ref;
        try { ref = build(refP); } catch { continue; }
        const other = edgeCore(ref.grid, tileI, DIRS.find((x) => x.bit === OPP[d.bit]), margin);
        const miss = setDiff(layer, other) + setDiff(other, layer);
        const moved = !!KACHELN[kind] && p.state > 0;   // bewegliche Teile (Klappe, Blatt) außerhalb des Startzustands
        if (miss && rule.seamMatch !== false) (worn || moved ? r.warnings : r.errors).push(`Naht ${d.name}: Querschnitt passt nicht zur Gegenseite (${miss} Voxel Versatz zu conn ${refP.conn})`);
      }
    }
  }
  if (report.modelErrors.length) report.errors += report.modelErrors.length;
  for (const c of report.cases) { report.errors += c.errors.length; report.warnings += c.warnings.length; }
  return report;
}

// ---------------------------------------------------------------------------------------------
// Bibliothek, Testdaten (--datei), Ausgabe
// ---------------------------------------------------------------------------------------------
/** Bibliothek; extra = { id: obj } Rezepte außerhalb von assets/ (werden über put() eingehängt). */
export async function prepareLibrary(extra = {}) {
  const lib = new Library(fsIO(root));
  for (const obj of Object.values(extra)) await lib.put('models', obj);
  return lib;
}

let OUT = path.join(root, 'shots', 'pruefbogen');   // --out <ordner>
const outFile = (id, ext) => path.join(OUT, ...id.split('/')) + ext;

export function printReport(rep, log = console.log) {
  const bad = rep.cases.filter((c) => c.errors.length), warn = rep.cases.filter((c) => c.warnings.length);
  const maxT = Math.max(0, ...rep.cases.map((c) => c.tris || 0));
  log(`  ${rep.errors ? '✗' : '✓'} ${rep.id}  [${rep.kind || 'ohne Kachelart'}]  ${rep.cases.length} Fälle, max ${maxT} Dreiecke (Budget ${rep.budget}), ${bad.length} Fälle mit Fehlern, ${warn.length} mit Warnungen`);
  for (const m of rep.modelErrors) log(`      ✗ ${m}`);
  // gleiche Meldungen (bis auf Zahlen) zusammenfassen
  for (const [field, sym] of [['errors', '✗'], ['warnings', '!']]) {
    const by = new Map();
    for (const c of rep.cases) for (const m of c[field]) {
      const k = m.replace(/[\d,.]+/g, '#');
      if (!by.has(k)) by.set(k, { first: m, cases: [] });
      by.get(k).cases.push(c);
    }
    for (const { first, cases: cs } of by.values()) {
      log(`      ${sym} ${first}  — ${cs.length} Fall/Fälle: ${cs.slice(0, 5).map((c) => `${c.row === 'variants' ? '' : c.row + ' '}${c.label}`).join('; ')}${cs.length > 5 ? ' …' : ''}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Rendern (Playwright, über editor/pruefbogen.html)
// ---------------------------------------------------------------------------------------------
const ping = (port) => new Promise((ok) => {
  const req = http.get({ host: 'localhost', port, path: '/api/index', timeout: 1500 }, (res) => { res.resume(); ok(res.statusCode === 200); });
  req.on('error', () => ok(false)); req.on('timeout', () => { req.destroy(); ok(false); });
});

async function withServer(port, fn) {
  let child = null;
  if (!(await ping(port))) {
    child = spawn(process.execPath, [path.join(root, 'server.js'), String(port)], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 50 && !(await ping(port)); i++) await new Promise((r) => setTimeout(r, 200));
    if (!(await ping(port))) { child.kill(); throw new Error(`Server auf Port ${port} startet nicht`); }
  }
  try { return await fn(); } finally { if (child) child.kill(); }
}

/** playwright-core liegt außerhalb des Projekts: PLAYWRIGHT_CORE=<pfad>, sonst die üblichen Ablageorte. */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = [process.env.PLAYWRIGHT_CORE, 'C:/tmp/pwtest/node_modules/playwright-core', 'C:/tmp/pw-test/node_modules/playwright-core', 'playwright-core'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch { /* nächster */ } }
  throw new Error(`playwright-core nicht gefunden (PLAYWRIGHT_CORE=<pfad> setzen; versucht: ${tries.join(', ')})`);
}

async function render(port, shots) {
  const { chromium } = loadPlaywright();
  const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let fails = 0;
  try {
    for (const { query, file, width = 1600 } of shots) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', (e) => { fails++; console.log('  [pageerror]', e.message); });
      // 404 auf assets/models/** = optionale Vorlagen-Kandidaten (use-Fallbacks) → kein Fehler; fehlt ein Pflichtmodell, steht das in #msg
      page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) { fails++; console.log('  [error]', m.text().slice(0, 300)); } });
      page.on('response', (r) => { if (r.status() >= 400 && !/\/assets\/models\/|favicon\.ico$/.test(r.url())) { fails++; console.log(`  [http ${r.status()}] ${r.url()}`); } });
      await page.goto(`http://localhost:${port}/editor/pruefbogen.html?${query}`);
      try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 }); }
      catch { fails++; console.log(`  ✗ ${query}: nicht bereit (${await page.textContent('#msg').catch(() => '')})`); await page.close(); continue; }
      const msg = (await page.textContent('#msg').catch(() => '')).trim();
      if (msg) { fails++; console.log(`  ✗ ${query}: ${msg}`); }
      await fs.mkdir(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  → ${path.relative(process.cwd(), file)}`);
      await page.close();
    }
  } finally { await browser.close(); }
  return fails;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, def) => { const i = argv.indexOf('--' + name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const flag = (name) => { const i = argv.indexOf('--' + name); if (i < 0) return false; argv.splice(i, 1); return true; };
  const port = +opt('port', process.env.PORT || 3433);
  const out = opt('out');
  if (out) OUT = path.resolve(process.cwd(), out);
  const outRel = path.relative(root, OUT).replace(/\\/g, '/');
  if (outRel.startsWith('..')) { console.log(`--out muss im Voxelwerk-Ordner liegen (der Server liefert den Bericht aus): ${OUT}`); process.exit(1); }
  const fixed = {};
  for (let v; (v = opt('params'));) for (const kv of v.split(',')) { const [k, x] = kv.split('='); fixed[k] = x !== '' && !isNaN(+x) ? +x : x; }
  const datei = [];
  for (let v; (v = opt('datei'));) datei.push(v);
  const silhouette = opt('silhouette'), pose = opt('pose', 'stand');
  const onlyCheck = flag('nur-pruefung'), allKit = flag('kit');

  if (silhouette) {
    const fails = await withServer(port, () => render(port, [{ query: `silhouette=${encodeURIComponent(silhouette)}&pose=${pose}`, file: outFile(`silhouette/${silhouette.replace(/\//g, '_')}`, '.png'), width: 1800 }]));
    process.exit(fails ? 2 : 0);
  }

  const extra = {}, extraFile = {};
  for (const f of datei) {
    const abs = path.resolve(process.cwd(), f), obj = JSON.parse(await fs.readFile(abs, 'utf8'));
    extra[obj.id] = obj; extraFile[obj.id] = path.relative(root, abs).replace(/\\/g, '/');
  }
  const lib = await prepareLibrary(extra);
  let ids = [...argv, ...Object.keys(extra)];
  if (allKit) {
    const idx = await listAssets(root);
    for (const id of idx.models) {
      if (argv.length && !argv.some((f) => id.includes(f))) continue;
      try { await lib.load('models', id); if (isKit(lib.get('models', id))) ids.push(id); } catch (e) { console.log(`  ✗ ${id}: ${e.message}`); }
    }
    ids = [...new Set(ids.filter((id) => lib.get('models', id) && isKit(lib.get('models', id))))];
  }
  if (!ids.length) { console.log('Modell-ID fehlt, z. B. node tools/pruefbogen.mjs lerche/kit/wall'); process.exit(1); }

  let errors = 0;
  const shots = [];
  console.log('\n== Prüfbogen');
  for (const id of ids) {
    try {
      if (!lib.get('models', id)) await lib.load('models', id);
      const rep = pruefeModell(lib, id, fixed);
      rep.datei = extraFile[id] || null;
      rep.erstellt = new Date().toISOString();
      errors += rep.errors;
      printReport(rep);
      const json = outFile(id, '.json');
      await fs.mkdir(path.dirname(json), { recursive: true });
      await fs.writeFile(json, JSON.stringify(rep, null, 1));
      const q = new URLSearchParams({ id });
      if (rep.datei) q.set('datei', rep.datei);
      if (outRel !== 'shots/pruefbogen') q.set('out', outRel);
      if (Object.keys(fixed).length) q.set('params', Object.entries(fixed).map(([k, v]) => `${k}=${v}`).join(','));
      shots.push({ query: q.toString(), file: outFile(id, '.png') });
      lib.buildCache.clear();
    } catch (e) { errors++; console.log(`  ✗ ${id}: ${e.message}`); }
  }
  let renderFails = 0;
  if (!onlyCheck && shots.length) renderFails = await withServer(port, () => render(port, shots));
  console.log(`\n${errors ? '✗' : '✓'} Prüfbogen: ${errors} Fehler${renderFails ? `, ${renderFails} Renderfehler` : ''}`);
  process.exit(errors ? 1 : renderFails ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
