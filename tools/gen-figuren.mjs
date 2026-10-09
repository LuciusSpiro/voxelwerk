// Figurenbaukasten: Rolle × Fraktion → Figur.
// Liest assets/baukasten/fraktionen/*.json und assets/baukasten/rollen/*.json und schreibt
// assets/figures/fig/<fraktion>/<rolle>.json mit "generated": true. Erzeugte Dateien nie von Hand bearbeiten.
//
// Aufruf: node tools/gen-figuren.mjs [--fraktion <id>] [--rolle <id>] [--check]
//   --fraktion / --rolle   nur diese Kombinationen erzeugen (ohne Filter: alle, verwaiste Erzeugnisse werden gelöscht)
//   --check                nichts schreiben; Exit 1, wenn eine Datei fehlt oder veraltet ist
//
// Deterministisch: gleiche Eingaben → byte-gleiche Dateien (keine Zeitstempel, feste Schlüsselreihenfolge).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (...p) => path.join(root, 'assets', ...p);

// Gattungsnamen der Fraktionsteile → Gelenke. Linke Teile normal, rechte gespiegelt (Konvention: Teile links modellieren).
const TEILE = {
  hips: ['hips'], torso: ['torso'], head: ['head'],
  upperArm: ['upperArmL', 'upperArmR'], lowerArm: ['lowerArmL', 'lowerArmR'],
  thigh: ['thighL', 'thighR'], shin: ['shinL', 'shinR'],
};
const GELENKE = Object.values(TEILE).flat();                     // feste Reihenfolge der Ausgabe
// Aufsatz-Steckplatz → Gelenk des Rigs. Aufsätze werden in Figur-Koordinaten modelliert, anchor = Gelenkposition.
const AUFSATZ = { back: 'back', head_top: 'head', shoulder: 'torso' };
const MANTEL_GELENK = 'back';
const WAFFEN_HAND = 'handR';

// ---------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const onlyF = opt('fraktion'), onlyR = opt('rolle'), checkOnly = args.includes('--check');

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warnings++; console.log('  ! ' + m); };

const exists = (p) => fs.access(p).then(() => true, () => false);
const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const modelCache = new Map();
async function model(id) {
  if (!modelCache.has(id)) modelCache.set(id, await readJson(A('models', id + '.json')).catch(() => null));
  return modelCache.get(id);
}
async function dir(sub) {
  const ents = await fs.readdir(A('baukasten', sub)).catch(() => []);
  const out = [];
  for (const f of ents.filter((f) => f.endsWith('.json')).sort()) {
    const id = f.slice(0, -5), file = `baukasten/${sub}/${f}`;
    try {
      const d = await readJson(A('baukasten', sub, f));
      if (d.id !== id) err(`${file}: Feld "id" ("${d.id}") passt nicht zum Dateinamen`);
      else out.push(d);
    } catch (e) { err(`${file}: ${e.message}`); }
  }
  return out;
}

/** "id" oder { model, params, palette } → { model, params?, palette? } */
const norm = (v) => (v == null ? null : typeof v === 'string' ? { model: v } : { ...v });

/** Teil-/Anbau-Eintrag in fester Schlüsselreihenfolge. */
function entry(src, extra = {}) {
  const o = { model: src.model };
  if (src.params && Object.keys(src.params).length) o.params = src.params;
  if (src.palette) o.palette = src.palette;
  if (extra.mirror) o.mirror = true;
  for (const k of ['rot', 'offset']) if (src[k]) o[k] = src[k];
  return o;
}

async function needModel(where, ref) {
  if (!ref) return true;
  if (!ref.model) { err(`${where}: Eintrag ohne "model"`); return false; }
  if (!(await model(ref.model))) { err(`${where}: Modell "${ref.model}" gibt es nicht (assets/models/${ref.model}.json)`); return false; }
  return true;
}

// ---------------------------------------------------------------------------------------------
async function buildFigure(fr, ro, rig, poses) {
  const tag = `${fr.id} × ${ro.id}`;
  const parts = {};
  // 1. Fraktionsteile
  for (const [gattung, gelenke] of Object.entries(TEILE)) {
    const t = norm(fr.teile?.[gattung]);
    if (!t) { err(`Fraktion ${fr.id}: teile.${gattung} fehlt`); continue; }
    gelenke.forEach((g, i) => { parts[g] = { src: t, mirror: i === 1 }; });
  }
  // 2. Kopfvariante der Rolle
  if (ro.kopf) {
    const k = norm(fr.kopf_varianten?.[ro.kopf]);
    if (k) parts.head = { src: k, mirror: false };
    else warn(`${tag}: Fraktion hat keine kopf_varianten.${ro.kopf} – Standardkopf`);
  }
  // 3. Rollenteile ersetzen (erst Gattung, dann einzelnes Gelenk; R immer gespiegelt)
  const ers = ro.ersetzt || {};
  const keys = Object.keys(ers).sort((a, b) => (a in TEILE ? 0 : 1) - (b in TEILE ? 0 : 1) || (a < b ? -1 : a > b ? 1 : 0));
  for (const k of keys) {
    const gelenke = TEILE[k] || (GELENKE.includes(k) ? [k] : null);
    if (!gelenke) { err(`Rolle ${ro.id}: ersetzt.${k} ist weder Teilgattung (${Object.keys(TEILE).join(', ')}) noch Gelenk`); continue; }
    const v = norm(ers[k]);
    for (const g of gelenke) parts[g] = v ? { src: v, mirror: g.endsWith('R') } : null;
  }
  const outParts = {};
  for (const g of GELENKE) {
    const p = parts[g];
    if (!p) continue;
    if (!rig.joints[g]) { err(`${tag}: Gelenk ${g} fehlt im Rig ${rig.id}`); continue; }
    if (await needModel(`${tag} ${g}`, p.src)) outParts[g] = entry(p.src, { mirror: p.mirror });
  }

  // 4. Anbauten: Waffe, Mantel, Aufsätze
  const attach = {};
  let waffe = null;
  if (ro.waffe) {
    const echt = `item/waffe/${ro.waffe}`, m = await model(echt);
    const ref = m ? { model: echt } : ro.waffe_platzhalter ? norm(ro.waffe_platzhalter) : null;
    if (!ref) err(`${tag}: Waffe ${echt} gibt es noch nicht und die Rolle nennt keinen waffe_platzhalter`);
    else if (await needModel(`${tag} waffe`, ref)) {
      const decl = (await model(ref.model))?.params || {};
      if (m && 'bauweise' in decl && fr.waffen_bauweise) ref.params = { bauweise: fr.waffen_bauweise, ...(ref.params || {}) };
      attach[WAFFEN_HAND] = entry(ref);
      waffe = { typ: ro.waffe, bauweise: fr.waffen_bauweise || null, platzhalter: !m };
      if (!m) console.log(`  · ${tag}: Waffe ${ro.waffe} als Platzhalter ${ref.model}`);
    }
  }
  const aufs = ro.aufsatz || {};
  for (const slot of Object.keys(aufs).sort()) {
    const g = AUFSATZ[slot];
    if (!g) { err(`Rolle ${ro.id}: aufsatz.${slot} unbekannt (erlaubt: ${Object.keys(AUFSATZ).join(', ')})`); continue; }
    const v = norm(aufs[slot]);
    if (v && (await needModel(`${tag} aufsatz.${slot}`, v))) attach[g] = entry(v);
  }
  if (ro.mantel) {
    const m = norm(fr.mantel);
    if (!m) warn(`${tag}: Rolle will mantel, Fraktion hat kein "mantel"-Teil`);
    else if (attach[MANTEL_GELENK]) err(`${tag}: mantel und aufsatz.back belegen beide den Rücken`);
    else if (await needModel(`${tag} mantel`, m)) attach[MANTEL_GELENK] = entry(m);
  }
  for (const g of Object.keys(attach)) if (!rig.joints[g]) err(`${tag}: Anbaupunkt ${g} fehlt im Rig ${rig.id}`);

  // 5. Posen (nur Hinweis: ART-POSEN liefert neue Posen parallel)
  for (const k of ['pose_ruhe', 'pose_ziel']) if (ro[k] && !poses[ro[k]]) warn(`${tag}: ${k} "${ro[k]}" gibt es (noch) nicht in poses/${rig.poses}`);

  const groesse = ro.groesse ?? 1;
  if (typeof groesse !== 'number' || groesse < 0.5 || groesse > 1.5) err(`Rolle ${ro.id}: groesse ${groesse} außerhalb 0.5–1.5`);

  // Ausgabe in fester Reihenfolge
  const fig = {
    id: `fig/${fr.id}/${ro.id}`,
    name: `${fr.name || fr.id}: ${ro.name || ro.id}`,
    generated: true,
    quelle: { fraktion: `baukasten/fraktionen/${fr.id}.json`, rolle: `baukasten/rollen/${ro.id}.json`, generator: 'tools/gen-figuren.mjs' },
    rig: fr.rig || 'human',
    palette: fr.palette,
    tags: ['figur', 'baukasten', fr.id, ro.id],
  };
  if (groesse !== 1) fig.scale = groesse;
  const posen = {};
  if (ro.pose_ruhe) posen.ruhe = ro.pose_ruhe;
  if (ro.pose_ziel) posen.ziel = ro.pose_ziel;
  if (Object.keys(posen).length) fig.posen = posen;
  if (waffe) fig.waffe = waffe;
  const params = { ...(fr.params || {}), ...(ro.params || {}) };
  if (Object.keys(params).length) fig.params = params;
  const colors = { ...(fr.colors || {}), ...(ro.colors || {}) };
  if (Object.keys(colors).length) fig.colors = colors;
  fig.parts = outParts;
  if (Object.keys(attach).length) fig.attach = Object.fromEntries(Object.keys(attach).sort().map((k) => [k, attach[k]]));
  return fig;
}

/** JSON mit 2er-Einzug; nur parts/attach mehrzeilig, ihre Einträge und alles andere einzeilig. */
const MEHRZEILIG = new Set(['parts', 'attach']);
function format(v, depth = 0, key = '') {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const pad = '  '.repeat(depth + 1), end = '  '.repeat(depth);
  if (Array.isArray(v)) return depth >= 1 ? JSON.stringify(v).replace(/,/g, ', ') : '[\n' + v.map((x) => pad + format(x, depth + 1)).join(',\n') + '\n' + end + ']';
  const ents = Object.entries(v);
  if (!ents.length) return '{}';
  if (depth >= 2 || (depth === 1 && !MEHRZEILIG.has(key))) return '{ ' + ents.map(([k, x]) => JSON.stringify(k) + ': ' + format(x, depth + 1)).join(', ') + ' }';
  return '{\n' + ents.map(([k, x]) => pad + JSON.stringify(k) + ': ' + format(x, depth + 1, k)).join(',\n') + '\n' + end + '}';
}

// ---------------------------------------------------------------------------------------------
const fraktionen = (await dir('fraktionen')).filter((f) => !onlyF || f.id === onlyF);
const rollen = (await dir('rollen')).filter((r) => !onlyR || r.id === onlyR);
if (onlyF && !fraktionen.length) err(`Fraktion "${onlyF}" nicht gefunden`);
if (onlyR && !rollen.length) err(`Rolle "${onlyR}" nicht gefunden`);

const written = new Set();
let changed = 0, same = 0;
for (const fr of fraktionen) {
  console.log(`\n== Fraktion ${fr.id}`);
  const rigId = fr.rig || 'human';
  const rig = await readJson(A('rigs', rigId + '.json')).catch(() => null);
  if (!rig) { err(`Fraktion ${fr.id}: Rig "${rigId}" fehlt`); continue; }
  if (!fr.palette || !(await exists(A('palettes', fr.palette + '.json')))) { err(`Fraktion ${fr.id}: Palette "${fr.palette}" fehlt`); continue; }
  const poses = rig.poses ? (await readJson(A('poses', rig.poses + '.json')).catch(() => ({}))).poses || {} : {};
  for (const ro of rollen) {
    if (ro.fraktionen && !ro.fraktionen.includes(fr.id)) continue;
    const before = errors;
    const fig = await buildFigure(fr, ro, rig, poses);
    if (errors > before) { console.log(`  ✗ ${fig.id} nicht geschrieben`); continue; }
    const rel = `figures/${fig.id}.json`, file = A(rel), text = format(fig) + '\n';
    written.add(path.normalize(file));
    const old = await fs.readFile(file, 'utf8').catch(() => null);
    if (old === text) { same++; console.log(`  = ${fig.id}`); continue; }
    changed++;
    if (checkOnly) { err(`${rel} ${old === null ? 'fehlt' : 'ist veraltet'} – node tools/gen-figuren.mjs ausführen`); continue; }
    if (old !== null && !JSON.parse(old).generated) { err(`${rel} existiert und ist nicht "generated" – wird nicht überschrieben`); continue; }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
    console.log(`  ✓ ${fig.id} ${old === null ? 'neu' : 'aktualisiert'}`);
  }
}

// Verwaiste Erzeugnisse (Rolle/Fraktion gelöscht) nur beim Vollauf entfernen, und nur Dateien mit "generated": true
if (!onlyF && !onlyR) {
  const base = A('figures', 'fig');
  for (const fdir of await fs.readdir(base, { withFileTypes: true }).catch(() => [])) {
    if (!fdir.isDirectory()) continue;
    for (const f of await fs.readdir(path.join(base, fdir.name)).catch(() => [])) {
      const file = path.normalize(path.join(base, fdir.name, f));
      if (!f.endsWith('.json') || written.has(file)) continue;
      const d = await readJson(file).catch(() => null);
      if (!d?.generated) continue;
      if (checkOnly) { err(`figures/fig/${fdir.name}/${f} ist verwaist`); continue; }
      await fs.rm(file); console.log(`  − fig/${fdir.name}/${f.slice(0, -5)} entfernt (keine Quelle mehr)`);
    }
  }
}

console.log(`\n${errors ? '✗' : '✓'} ${errors} Fehler, ${warnings} Warnungen · ${changed} ${checkOnly ? 'abweichend' : 'geschrieben'}, ${same} unverändert`);
process.exit(errors ? 1 : 0);
