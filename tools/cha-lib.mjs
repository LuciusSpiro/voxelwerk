// Gemeinsame Helfer für die Spielerfigur aus Schichten (cha/): Prüfregeln für npm run check und tools/test-cha.mjs,
// dazu ein Zusammenbau von Figuren in Node (ohne three.js) für Tests und Bilder.
// Die Prüfregeln sind reine Funktionen über "get(id)" (Modell-JSON) und die Liste der Modell-IDs, damit Tests sie mit
// manipulierten Modellen aufrufen können. Rückgabe: Liste { id, msg } (leer = in Ordnung).
import { VoxelGrid } from '../core/grid.js';

/** Rollen, die ausschließlich die Figur (colors) setzt. Kein use in cha/ darf sie umlegen oder per Palette ersetzen. */
export const FIGURFARBEN = ['skin', 'skin_shadow', 'hair'];
/**
 * Ausnahme zu FIGURFARBEN: Plätze, deren Teile eine Figurrolle für ihre eigene Zier festnageln dürfen (colors am use).
 * Der Fellumhang färbt Fellflecken mit hair; ohne Festnageln würde die Haarfarbe des Spielers den Umhang färben.
 */
export const PINNEN = { umhang: ['hair'] };
/** Gattung → linkes bzw. mittiges Gelenk, an dem der Bereich gemessen wird (rechte Teile sind gespiegelte linke). */
export const GELENK_LINKS = { hips: 'hips', torso: 'torso', head: 'head', upperArm: 'upperArmL', lowerArm: 'lowerArmL', thigh: 'thighL', shin: 'shinL' };

const imCha = (id) => id.startsWith('cha/');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Alle Modelle, die ein use-Schritt meinen kann: fester Name oder Vorlage (Platzhalter {x} → beliebiges Segment), plus Fallbacks. */
function kandidaten(op, ids) {
  const out = new Set();
  for (const c of [op.model, ...[].concat(op.fallback ?? [])]) {
    if (!/\{[A-Za-z_]\w*\}/.test(c)) { if (ids.includes(c)) out.add(c); continue; }
    const re = new RegExp('^' + escRe(c).replace(/\\\{[A-Za-z_]\w*\\\}/g, '[^/]+') + '$');
    for (const id of ids) if (re.test(id)) out.add(id);
  }
  return [...out];
}
function* alleUse(ops = []) {
  for (const op of ops) {
    if (op.op === 'use') yield op;
    if (op.ops) yield* alleUse(op.ops);
  }
}
const gleich = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Regel (a), Anker: Jedes Modell unter cha/ legt `anchor` ausdrücklich fest (ohne Angabe berechnet der Kern einen Anker aus der
 * Gitterform und verschiebt das Teil). Jedes eingesetzte Teil hat ebenfalls einen `anchor`; ist er nicht [0,0,0] (Anbaupunkt-Teile
 * wie fig/germanen/fellumhang mit [0,20,-3]), muss das use denselben Wert als `at` tragen, sonst sitzt das Teil verschoben.
 */
export function pruefeAnker(ids, get) {
  const fehler = [];
  for (const id of ids.filter(imCha)) {
    const m = get(id);
    if (!m) continue;
    if (m.anchor === undefined) fehler.push({ id, msg: 'Modell ohne "anchor" (Schichten brauchen einen ausdrücklichen Anker, normalerweise [0,0,0])' });
    for (const op of alleUse(m.ops)) {
      for (const k of kandidaten(op, ids)) {
        const s = get(k);
        if (!s) continue;
        if (s.anchor === undefined) { fehler.push({ id, msg: `use "${op.name || op.model}": eingesetztes Teil ${k} hat keinen "anchor"` }); continue; }
        if (s.anchor.every((v) => typeof v === 'number') && !gleich(s.anchor, [0, 0, 0]) && !(Array.isArray(op.at) && gleich(op.at, s.anchor))) {
          fehler.push({ id, msg: `use "${op.name || op.model}": ${k} hat Anker [${s.anchor}], das use braucht "at": [${s.anchor}]` });
        }
      }
    }
  }
  return fehler;
}

/**
 * Regel (b), Rollen: Haut und Haar gehören der Figur. Ein use in cha/ darf skin, skin_shadow, hair weder in `colors` setzen
 * (das schlägt die Figurfarbe) noch per `palette` eine andere Palette einsetzen (die brächte eigene Werte dieser Rollen mit).
 * Ausnahme: PINNEN (Fellumhang nagelt hair fest, damit die Haarfarbe den Umhang nicht färbt).
 */
export function pruefeRollen(ids, get) {
  const fehler = [];
  for (const id of ids.filter(imCha)) {
    const m = get(id);
    if (!m) continue;
    for (const op of alleUse(m.ops)) {
      for (const k of Object.keys(op.colors || {})) if (FIGURFARBEN.includes(k) && !(PINNEN[id.split('/')[1]] || []).includes(k)) fehler.push({ id, msg: `use "${op.name || op.model}": colors setzt ${k}; Haut und Haar kommen nur von der Figur (colors der Figur)` });
      if (op.palette && op.palette !== m.palette) fehler.push({ id, msg: `use "${op.name || op.model}": palette "${op.palette}" ersetzt die Palette der Schicht und damit skin/skin_shadow/hair` });
    }
  }
  return fehler;
}

/** Bounding Box eines gebauten Modells in Figur-Koordinaten (Anker abgezogen) oder null (leer). */
export function boxOf(built) {
  if (!built.grid.size) return null;
  const b = built.grid.bounds(), a = built.anchor;
  return { min: b.min.map((v, i) => v - a[i]), max: b.max.map((v, i) => v - a[i]) };
}

/** Prüfung der Schichten gegen die Gelenkbereiche des Rigs plus Toleranz je Platz und Gattung. Schicht-ID: cha/<platz>/<teil>/<gattung>. */
export function pruefeBereiche(ids, get, build, rig) {
  const fehler = [];
  const bereiche = rig.bereiche, tol = rig.toleranzen || {};
  if (!bereiche) return [{ id: `rig ${rig.id}`, msg: 'Feld "bereiche" fehlt' }];
  for (const id of ids) {
    const m = id.match(/^cha\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!m || !(get(id)?.tags || []).includes('schicht')) continue;
    const [, platz, , gattung] = m;
    const bereich = bereiche[GELENK_LINKS[gattung]];
    if (!bereich) { fehler.push({ id, msg: `Gattung ${gattung} hat keinen Bereich im Rig (${GELENK_LINKS[gattung]})` }); continue; }
    const box = boxOf(build(id));
    if (!box) continue;
    const t = tol[platz]?.[gattung] || { min: [0, 0, 0], max: [0, 0, 0] };
    const ueber = [];
    for (let i = 0; i < 3; i++) {
      const lo = bereich.min[i] - t.min[i], hi = bereich.max[i] + t.max[i], ax = 'xyz'[i];
      if (box.min[i] < lo) ueber.push(`${ax} min ${box.min[i]} < ${lo}`);
      if (box.max[i] > hi) ueber.push(`${ax} max ${box.max[i]} > ${hi}`);
    }
    if (ueber.length) fehler.push({ id, msg: `außerhalb von Bereich ${GELENK_LINKS[gattung]} + Toleranz ${platz}: ${ueber.join(', ')}` });
  }
  return fehler;
}

// =============================================================================================
// Zusammenbau in Node
// =============================================================================================
/** Optionen je Platz aus den Sammelmodellen: { platz: [werte] } */
export function platzOptionen(lib, ids) {
  const out = {};
  for (const id of ids.filter((i) => i.startsWith('cha/joint/')))
    for (const [k, p] of Object.entries(lib.get('models', id)?.params || {})) if (p.options) out[k] = [...new Set([...(out[k] || []), ...p.options])];
  return out;
}

/**
 * Baut eine Figur wie figureObject (render/voxel-three.js) ohne three.js: alle Teile in Ruhepose zu einem Gitter.
 * opts: { params, colors } überschreiben die der Figur. Rückgabe { grid, pro: { gelenk: [Voxel] } }.
 */
export function baueFigur(lib, figId, opts = {}) {
  const fig = lib.get('figures', figId);
  const params = { ...(fig.params || {}), ...(opts.params || {}) }, colors = { ...(fig.colors || {}), ...(opts.colors || {}) };
  const grid = new VoxelGrid(), pro = {};
  for (const [jn, part] of Object.entries(fig.parts || {})) {
    const b = lib.build(part.model, { params: lib.partParams(part.model, params, part.params), palette: part.palette || fig.palette, colors });
    const a = b.anchor; pro[jn] = [];
    for (const v of b.grid.values()) {
      const x = part.mirror ? -(v.x - a[0]) - 1 : v.x - a[0], y = v.y - a[1], z = v.z - a[2];
      pro[jn].push({ x, y, z, c: v.c, e: v.e });
      grid.set(x, y, z, v.c, v.e);
    }
  }
  return { grid, pro };
}

/** Namen der leeren Werte: kein Modell nötig, Fallback cha/leer. */
export const LEERE_WERTE = ['keine', 'keiner'];
const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Regel (d), Katalog (assets/katalog/charakter.json) gegen Modelle und Figur:
 *  - Plätze: Reihenfolge und Standardwerte wie die Figur-params (ohne koerper, der steht oben im Katalog), Gruppe charakter oder outfit
 *  - Teile: id = <platz>/<name>, Platz und Gruppe stimmen, Anzeigename, Outfit mit herkunft; jedes Teil hat ein Modell (cha/<platz>/<name>/…),
 *    ausgenommen die leeren Werte keine/keiner
 *  - jede options-Ausprägung der Sammelmodelle steht im Katalog und umgekehrt jedes Teil des Katalogs in den options
 *  - Farben: je 4 Hauttöne (skin + skin_shadow) und 4 Haarfarben, Index 0 = Farben der Figur
 * optionen = { platz: [werte] } aus platzOptionen(). Rückgabe: Liste { id, msg }.
 */
export function pruefeKatalog(katalog, { modelIds, optionen, figur }) {
  const fehler = [], f = (id, msg) => fehler.push({ id, msg });
  if (katalog.version !== 1) f('katalog', `version ${katalog.version} (erwartet 1)`);
  if (katalog.figur !== figur.id) f('katalog', `figur "${katalog.figur}" ist nicht ${figur.id}`);
  const platzIds = Object.keys(figur.params).filter((k) => k !== 'koerper');
  const ids = (katalog.plaetze || []).map((p) => p.id);
  if (!gleich(ids, platzIds)) f('katalog', `plaetze [${ids}] stimmen nicht mit den Figur-params [${platzIds}] überein (Reihenfolge der Schnittstelle)`);
  const plaetze = new Map((katalog.plaetze || []).map((p) => [p.id, p]));
  for (const p of katalog.plaetze || []) {
    if (!['charakter', 'outfit'].includes(p.gruppe)) f(`platz ${p.id}`, `gruppe "${p.gruppe}" (charakter oder outfit)`);
    if (!p.name) f(`platz ${p.id}`, 'name fehlt');
    if (p.standard !== figur.params[p.id]) f(`platz ${p.id}`, `standard "${p.standard}" ist nicht der Figurwert "${figur.params[p.id]}"`);
  }
  const gesehen = new Set();
  for (const t of katalog.teile || []) {
    const [platz, name, ...rest] = String(t.id).split('/');
    if (!name || rest.length) { f(t.id, 'id muss <platz>/<name> sein'); continue; }
    if (gesehen.has(t.id)) f(t.id, 'doppelt im Katalog');
    gesehen.add(t.id);
    const p = plaetze.get(platz);
    if (!p) { f(t.id, `Platz "${platz}" fehlt in plaetze`); continue; }
    if (t.platz !== platz) f(t.id, `platz "${t.platz}" passt nicht zur id (${platz})`);
    if (t.gruppe !== p.gruppe) f(t.id, `gruppe "${t.gruppe}" ist nicht die Gruppe des Platzes (${p.gruppe})`);
    if (!t.name || typeof t.name !== 'string') f(t.id, 'Anzeigename fehlt');
    if (p.gruppe === 'outfit' && !['frei', 'haendler', 'fund'].includes(t.herkunft)) f(t.id, `herkunft "${t.herkunft}" (frei, haendler oder fund)`);
    if (!LEERE_WERTE.includes(name) && !modelIds.some((m) => m.startsWith(`cha/${platz}/${name}/`))) f(t.id, `kein Modell cha/${platz}/${name}/…`);
  }
  for (const p of katalog.plaetze || []) if (!gesehen.has(`${p.id}/${p.standard}`)) f(`platz ${p.id}`, `Standard ${p.id}/${p.standard} fehlt unter teile`);
  const imKatalog = (platz) => (katalog.teile || []).filter((t) => String(t.id).startsWith(platz + '/')).map((t) => String(t.id).split('/')[1]);
  for (const platz of platzIds) {
    const opt = optionen[platz] || [], kat = imKatalog(platz);
    for (const w of opt) if (!kat.includes(w)) f(`${platz}/${w}`, 'options-Ausprägung der Figur fehlt im Katalog');
    for (const w of kat) if (!opt.includes(w)) f(`${platz}/${w}`, 'Katalog-Teil ist keine options-Ausprägung der Figur');
  }
  const kk = (katalog.koerper || []).map((k) => k.id);
  for (const w of optionen.koerper || []) if (!kk.includes(w)) f(`koerper/${w}`, 'options-Ausprägung der Figur fehlt unter koerper');
  for (const w of kk) if (!(optionen.koerper || []).includes(w)) f(`koerper/${w}`, 'Katalog-Körper ist keine options-Ausprägung der Figur');
  const { haut, haar } = katalog.farben || {};
  if (!Array.isArray(haut) || haut.length !== 4) f('farben', `haut: ${haut?.length} Einträge (erwartet 4)`);
  else for (const [i, h] of haut.entries()) if (!HEX.test(h.skin) || !HEX.test(h.skin_shadow)) f('farben', `haut[${i}]: skin und skin_shadow müssen Hexwerte sein`);
  if (!Array.isArray(haar) || haar.length !== 4) f('farben', `haar: ${haar?.length} Einträge (erwartet 4)`);
  else for (const [i, h] of haar.entries()) if (!HEX.test(h)) f('farben', `haar[${i}] ist kein Hexwert`);
  if (Array.isArray(haut) && haut[0] && (haut[0].skin !== figur.colors.skin || haut[0].skin_shadow !== figur.colors.skin_shadow)) f('farben', 'haut[0] ist nicht der Hautton der Figur');
  if (Array.isArray(haar) && haar[0] !== figur.colors.hair) f('farben', 'haar[0] ist nicht die Haarfarbe der Figur');
  if (Array.isArray(haut) && new Set(haut.map((h) => h.skin)).size !== haut.length) f('farben', 'haut: Hauttöne sind nicht verschieden');
  if (Array.isArray(haar) && new Set(haar).size !== haar.length) f('farben', 'haar: Haarfarben sind nicht verschieden');
  return fehler;
}

/** Vergleich zweier Gitter: gleich (Position und Farbe), nurA, nurB, farbe (gleiche Position, andere Farbe). */
export function vergleiche(A, B) {
  let gleichV = 0, nurA = 0, nurB = 0, farbe = 0;
  for (const v of A.values()) { const w = B.get(v.x, v.y, v.z); if (!w) nurA++; else if (w.c !== v.c || w.e !== v.e) farbe++; else gleichV++; }
  for (const w of B.values()) if (!A.get(w.x, w.y, w.z)) nurB++;
  return { gleich: gleichV, nurA, nurB, farbe, a: A.size, b: B.size };
}

/** Regel (c): Figur baut mit Standardwerten und mit jedem einzelnen Teil je Platz. Rückgabe { fehler, gebaut }. */
export function pruefeFigur(lib, figId, ids) {
  const fehler = [];
  if (!lib.get('figures', figId)) return { fehler: [{ id: figId, msg: 'Figur fehlt' }], gebaut: 0 };
  let gebaut = 0;
  const versuch = (label, params) => {
    try { const r = baueFigur(lib, figId, { params }); if (!r.grid.size) fehler.push({ id: figId, msg: `${label}: leer` }); gebaut++; }
    catch (e) { fehler.push({ id: figId, msg: `${label}: ${e.message}` }); }
  };
  versuch('Standardwerte', {});
  for (const [platz, werte] of Object.entries(platzOptionen(lib, ids))) for (const w of werte) versuch(`${platz}=${w}`, { [platz]: w });
  return { fehler, gebaut };
}
