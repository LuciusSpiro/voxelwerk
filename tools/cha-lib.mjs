// Gemeinsame Helfer für die Spielerfigur aus Schichten (cha/): Prüfregeln für npm run check und tools/test-cha.mjs,
// dazu ein Zusammenbau von Figuren in Node (ohne three.js) für Tests und Bilder.
// Die Prüfregeln sind reine Funktionen über "get(id)" (Modell-JSON) und die Liste der Modell-IDs, damit Tests sie mit
// manipulierten Modellen aufrufen können. Rückgabe: Liste { id, msg } (leer = in Ordnung).
import { VoxelGrid } from '../core/grid.js';
import { meshGrid } from '../core/mesher.js';
import { PASS_ZUSTAENDE, poseWerte, gelenkMatrizen, posiere } from './cha-pose.mjs';

/** Rollen, die ausschließlich die Figur (colors) setzt. Kein use in cha/ darf sie umlegen oder per Palette ersetzen. */
export const FIGURFARBEN = ['skin', 'skin_shadow', 'hair'];
/**
 * Ausnahme zu FIGURFARBEN: Plätze, deren Teile eine Figurrolle für ihre eigene Zier festnageln dürfen (colors am use).
 * Der Fellumhang färbt Fellflecken mit hair; ohne Festnageln würde die Haarfarbe des Spielers den Umhang färben.
 */
export const PINNEN = { umhang: ['hair'] };
/**
 * Zusätzliche Toleranzen für den 8er-Kopf (CHA-02 A1): Der Rig bleibt unverändert (Rig und Posen gehören nicht zu A1), seine Kopfbereiche
 * und Toleranzen stammen vom 4/6 breiten Bestandskopf. Der neue Kopf (Schädel x -4..3, y 26..32, z -4..3, Hals y 25) liegt über dem Bereich head
 * (y bis 30, z ab -3); die Frisur ragt dazu nach hinten und oben. Gilt zusätzlich zu rig.toleranzen: je Platz, Gattung und Richtung der größere Wert.
 */
export const CHA_TOLERANZEN = {
  koerper: { head: { min: [0, 0, 1], max: [0, 2, 0] } },
  frisur: { head: { min: [1, 5, 3], max: [1, 4, 1] } },
  // CHA-02 D2: Lorica. Schulterpanzer am Rumpf (x 5..10 und gespiegelt -11..-6, y bis 24)
  oberteil: { torso: { min: [6, 0, 0], max: [6, 0, 0] } },   // B2: Zöpfe vor der Brust (y 20, z 4), Locken und Perle neben dem Kopf (x -5 und 4, oberhalb der Schultern)
};
/**
 * CHA-02 D1: zusätzliche Toleranzen für die recycelten Teile (Robe: Rock bis y 8, Taschen hinter der Hüfte, weite Stulpen; Einsatzanzug: Tornister bei z -6, Armgerät bei x 7;
 * Anzughose: Beintasche bei x 4, Knieschoner bis y 7). Eigene Konstante, damit sie neben CHA_TOLERANZEN stehen kann; beide gelten (je Wert das Maximum).
 */
export const CHA_TOLERANZEN_D1 = {
  hose: { thigh: { min: [1, 0, 0], max: [1, 0, 0] }, shin: { min: [0, 0, 0], max: [0, 1, 0] } },
  oberteil: { lowerArm: { min: [1, 0, 0], max: [1, 0, 0] }, torso: { min: [0, 0, 4], max: [0, 0, 1] }, hips: { min: [1, 5, 4], max: [1, 0, 2] } },
};
/** Toleranzen des Rigs plus CHA_TOLERANZEN und CHA_TOLERANZEN_D1 (je Wert das Maximum). */
export function toleranzenVon(rig) {
  const out = structuredClone(rig.toleranzen || {});
  for (const [platz, gat] of [...Object.entries(CHA_TOLERANZEN), ...Object.entries(CHA_TOLERANZEN_D1)]) for (const [g, t] of Object.entries(gat)) {
    const alt = (out[platz] ||= {})[g];
    out[platz][g] = alt ? { min: alt.min.map((v, i) => Math.max(v, t.min[i])), max: alt.max.map((v, i) => Math.max(v, t.max[i])) } : structuredClone(t);
  }
  return out;
}

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
export function pruefeBereiche(ids, get, build, rig, tol = toleranzenVon(rig)) {
  const fehler = [];
  const bereiche = rig.bereiche;
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
  for (const jn of Object.keys(fig.parts || {})) {
    pro[jn] = baueGelenk(lib, fig, jn, params, colors);
    for (const v of pro[jn]) grid.set(v.x, v.y, v.z, v.c, v.e);
  }
  return { grid, pro };
}
/** Voxel eines Gelenks der Figur (Figur-Koordinaten, Spiegelteile gespiegelt): [{ x, y, z, c, e }]. params und colors sind die fertig gemischten Werte der Figur. */
export function baueGelenk(lib, fig, jn, params, colors) {
  const part = fig.parts[jn];
  const b = lib.build(part.model, { params: lib.partParams(part.model, params, part.params), palette: part.palette || fig.palette, colors });
  const a = b.anchor, out = [];
  for (const v of b.grid.values()) out.push({ x: part.mirror ? -(v.x - a[0]) - 1 : v.x - a[0], y: v.y - a[1], z: v.z - a[2], c: v.c, e: v.e });
  return out;
}

/**
 * CHA-02 D1: Ausnahmen der Passprobe (siehe pruefePassung, opts.ausnahmen). Das Teil stammt von einer Bestandsfigur, deren Durchdringungen die Schwelle für Kombinationen mit diesem Teil mitbestimmen.
 *  robe: Ivos Gewand (weiter Rock, breite Stulpen); die Beine der Kombination sind andere als Ivos, deshalb 10 Voxel Spielraum (gemessen: höchstens +10 über der normalen Schwelle, nur Pose crouch).
 *  einsatzanzug: Tornister bei z -4..-6; mit langem Haar und einem Umhang schiebt sich der Kopf in der Pose crouch 4 bis 10 Voxel tiefer hinein (nova selbst trägt einen Helm ohne Haar).
 */
export const PASS_AUSNAHMEN_D1 = [
  { wenn: { oberteil: 'robe' }, bestand: ['lerche/ivo'], spielraum: 10 },
  { wenn: { oberteil: 'einsatzanzug' }, bestand: ['crew/nova'], spielraum: 10 },
];
/** Namen der leeren Werte: kein Modell nötig, Fallback cha/leer. */
export const LEERE_WERTE = ['keine', 'keiner'];
/** Plätze der Katalogversion 1, die seit Version 2 entfallen (festes Gesicht, Bart in der Frisur). */
export const PLATZ_ENTFALLEN = ['gesicht', 'bart'];
/** Anzahl Hauttöne und Haarfarben im Katalog (Version 2). */
export const ANZAHL_HAUT = 6, ANZAHL_HAAR = 8;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Regel (d), Katalog (assets/katalog/charakter.json) gegen Modelle und Figur:
 *  - Plätze: Reihenfolge und Standardwerte wie die Figur-params (ohne koerper, der steht oben im Katalog), Gruppe charakter oder outfit
 *  - Teile: id = <platz>/<name>, Platz und Gruppe stimmen, Anzeigename, Outfit mit herkunft; jedes Teil hat ein Modell (cha/<platz>/<name>/…),
 *    ausgenommen die leeren Werte keine/keiner
 *  - jede options-Ausprägung der Sammelmodelle steht im Katalog und umgekehrt jedes Teil des Katalogs in den options
 *  - vorschau: Pfad des Kachelbilds relativ zu assets/sprites/ (cha/vorschau/<platz>/<name>.png; Dateien prüft tools/test-cha.mjs)
 *  - Version 2: Plätze gesicht und bart entfallen (Katalog, Teile, Figur-params)
 *  - Farben: je 6 Hauttöne (skin + skin_shadow) und 8 Haarfarben, Index 0 = Farben der Figur
 * optionen = { platz: [werte] } aus platzOptionen(). Rückgabe: Liste { id, msg }.
 */
export function pruefeKatalog(katalog, { modelIds, optionen, figur }) {
  const fehler = [], f = (id, msg) => fehler.push({ id, msg });
  if (katalog.version !== 2) f('katalog', `version ${katalog.version} (erwartet 2)`);
  for (const platz of PLATZ_ENTFALLEN) {
    if ((katalog.plaetze || []).some((p) => p.id === platz)) f('katalog', `Platz "${platz}" ist seit Version 2 kein Platz mehr (festes Gesicht, Bart steckt in der Frisur)`);
    if ((katalog.teile || []).some((t) => String(t.id).startsWith(platz + '/'))) f('katalog', `Teile von "${platz}" gibt es seit Version 2 nicht mehr`);
    if (platz in (figur.params || {})) f('katalog', `Figur-params enthalten den entfallenen Platz "${platz}"`);
  }
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
    if (t.vorschau !== `cha/vorschau/${platz}/${name}.png`) f(t.id, `vorschau "${t.vorschau}" ist nicht cha/vorschau/${platz}/${name}.png`);
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
  if (!Array.isArray(haut) || haut.length !== ANZAHL_HAUT) f('farben', `haut: ${haut?.length} Einträge (erwartet ${ANZAHL_HAUT})`);
  else for (const [i, h] of haut.entries()) if (!HEX.test(h.skin) || !HEX.test(h.skin_shadow)) f('farben', `haut[${i}]: skin und skin_shadow müssen Hexwerte sein`);
  if (!Array.isArray(haar) || haar.length !== ANZAHL_HAAR) f('farben', `haar: ${haar?.length} Einträge (erwartet ${ANZAHL_HAAR})`);
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

/** Maße des 8er-Kopfes (CHA-02): Schädel x -4..3, y 26..32, z -4..3, Hals bei y 25. */
export const KOPF_MASS = { breite: 8, hoehe: 7, tiefe: 8, halsY: 25 };
/**
 * Regel (e), Kopf: Der nackte Kopf (Frisur "keine", keine Kopfbedeckung) der Figur ist 8 breit, 7 hoch (ab y 26) und 8 tief, mit Hals bei y 25.
 * Prüft die Hülle der Kopf-Voxel, damit ein schmalerer Kopf (der alte 6er-Kopf der Lerche) rot wird. Rückgabe Liste { id, msg }.
 */
export function pruefeKopf(lib, figId, ids) {
  const fehler = [], opt = platzOptionen(lib, ids);
  const leer = (p) => LEERE_WERTE.find((w) => opt[p]?.includes(w));
  let b;
  try { b = baueFigur(lib, figId, { params: { frisur: leer('frisur'), kopf: leer('kopf') } }); }
  catch (e) { return [{ id: figId, msg: `Kopf baut nicht: ${e.message}` }]; }
  const vs = (b.pro.head || []).filter((v) => v.y >= KOPF_MASS.halsY + 1);
  if (!vs.length) return [{ id: figId, msg: 'Kopf ohne Schädelvoxel' }];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const v of vs) for (const [i, w] of [[0, v.x], [1, v.y], [2, v.z]]) { if (w < mn[i]) mn[i] = w; if (w > mx[i]) mx[i] = w; }
  const mass = { breite: mx[0] - mn[0] + 1, hoehe: mx[1] - mn[1] + 1, tiefe: mx[2] - mn[2] + 1 };
  for (const k of Object.keys(mass)) if (mass[k] !== KOPF_MASS[k]) fehler.push({ id: figId, msg: `Kopf ${k} ${mass[k]} (erwartet ${KOPF_MASS[k]})` });
  if (!(b.pro.head || []).some((v) => v.y === KOPF_MASS.halsY)) fehler.push({ id: figId, msg: `Kopf ohne Hals bei y ${KOPF_MASS.halsY} (der Hals gehört zum Kopfteil)` });
  return fehler;
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

// =============================================================================================
// A3: Passprobe (alle Teilekombinationen × Posen)
// =============================================================================================
/** Marker für Haar: die Passprobe baut mit hair = reines Grün; Haar ist an der Farbe zu erkennen (der Mesher tönt Flächen leicht ab, deshalb Schwellen statt Gleichheit). */
const HAAR_HEX = '#00FF00';
const istHaar = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > 150 && r < 90 && b < 90; };
/** Gesichtsöffnung des Bordhelms auf dem 8er-Kopf (Figur-Koordinaten, Voxelindizes): nur hier darf Haar der Frisur (Stirnfransen) sichtbar bleiben. */
export const OEFFNUNG = { xMin: -3, xMax: 2, yMin: 22, yMax: 30, zMin: 3 };   // yMin 22: der Bart reicht unter das Kinn (B2)
/** Radius (Voxel), unter dem zwei Voxelmitten verschiedener Gelenke als durchdrungen gelten (Würfel mit Kantenlänge 1 überlappen dann über die halbe Kante). */
export const DURCHDRINGUNG_RADIUS = 0.7;
const KOERPER_GELENKE = ['hips', 'torso', 'head', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 'thighL', 'thighR', 'shinL', 'shinR'];
const SPIEGEL = (n) => (n.endsWith('L') ? n.slice(0, -1) + 'R' : n.endsWith('R') ? n.slice(0, -1) + 'L' : n);
const NACH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Lädt eine Figur samt aller Modelle (Teile und Anbauten) in die Bibliothek. */
export async function ladeFigur(lib, figId) {
  const f = await lib.load('figures', figId);
  for (const p of [...Object.values(f.parts || {}), ...Object.values(f.attach || {})]) await lib.load('models', p.model);
  return f;
}

/** Bestandsfigur wie baueFigur, dazu der Anbau am Gelenk "back" (Fellumhang der Germanen); er hängt am Rumpf und bewegt sich mit ihm → pro.torso. */
export function baueBestandFigur(lib, figId, rig) {
  const r = baueFigur(lib, figId), fig = lib.get('figures', figId), back = fig.attach?.back;
  if (back) {
    const b = lib.build(back.model, { params: lib.partParams(back.model, fig.params || {}, back.params), palette: back.palette || fig.palette, colors: fig.colors });
    const at = rig.joints.back.at, a = b.anchor;
    for (const v of b.grid.values()) r.pro.torso.push({ x: v.x - a[0] + at[0], y: v.y - a[1] + at[1], z: v.z - a[2] + at[2], c: v.c, e: v.e });
  }
  return r;
}

/** Box der Voxel (Zellindizes) oder null. */
function boxVon(vox) {
  if (!vox.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of vox) for (const [i, w] of [[0, v.x], [1, v.y], [2, v.z]]) { if (w < min[i]) min[i] = w; if (w > max[i]) max[i] = w; }
  return { min, max };
}

/** Sichtbare Haarvoxel des Kopfes (Haarmarker) außerhalb der Gesichtsöffnung: Haar, das durch die Kopfbedeckung sticht (nur Voxel mit mindestens einer freien Seite). */
export function haarAussen(headVox) {
  const s = new Set(headVox.map((v) => `${v.x},${v.y},${v.z}`)), o = OEFFNUNG;
  const frei = (v) => NACH6.some(([a, b, c]) => !s.has(`${v.x + a},${v.y + b},${v.z + c}`));
  return headVox.filter((v) => v.y >= 24 && istHaar(v.c) && frei(v) && !(v.z >= o.zMin && v.x >= o.xMin && v.x <= o.xMax && v.y >= o.yMin && v.y <= o.yMax));
}

const gattungVon = (modell) => modell.split('/').pop();

/**
 * Passprobe: baut jede Teilekombination der Figur (Produkt der options aller Plätze) und prüft
 *  1. Baufehler (Bauen wirft, Figur leer)
 *  2. Bereiche: Voxel je Gelenk außerhalb von Rig-bereiche + Toleranz der getragenen Teile (vor der Pose)
 *  3. Haar durch Kopfbedeckung: sichtbares Haar außerhalb der Gesichtsöffnung, wenn eine Kopfbedeckung getragen wird (Bart steckt seit Katalog 2 in der Frisur)
 *  4. Durchdringung in Pose: je Posenzustand und Gelenkpaar die Zahl der Voxel, die einem Voxel des anderen Gelenks näher als
 *     DURCHDRINGUNG_RADIUS kommen; rot, wenn mehr als die Schwelle (Maximum der Bestandsfiguren für dasselbe Paar über alle Posenzustände + spielraum; die Messung zeigt zusätzlich den Bestandswert je Pose)
 * Rechenzeit: jedes Gelenk wird je Wertekombination seiner Plätze (Schlüssel) nur einmal posiert, jedes Paar je Schlüsselpaar nur einmal gemessen.
 * opts: { zustaende (Standard PASS_ZUSTAENDE), bestand: [Figur-IDs], spielraum: 0, ausnahmen: [{ wenn: { platz: wert }, bestand: [Figur-IDs], spielraum: 0 }] }
 *   ausnahmen (CHA-02 D1): Für Kombinationen mit dem Teil (alle Einträge von wenn treffen zu) gilt als Schwelle das Maximum aus der normalen Schwelle und den Bestandsfiguren der Ausnahme, plus ihr Spielraum.
 *   Beispiel: die Robe stammt von lerche/ivo; ihr weiter Rock und die Stulpen durchdringen in Posen mehr als jede andere Ausrüstung, so wie am Bestand Ivo.
 * opts.nur: { platz: [werte] } beschränkt die Kombinationen auf diese Werte (Mutationsproben, schnelle Läufe).
 * Jedes Gelenk wird je Schlüssel (Werte seiner Plätze) nur einmal gebaut, die Kombinationen kosten danach nur die gecachten Paarmessungen (16 200 Kombinationen in rund 15 s).
 * Rückgabe { fehler: [{id, msg}], kombinationen, messung: { zustand: [{ paar, max, kombi, bestand, schwelle }] }, sekunden }
 */
export function pruefePassung(lib, figId, ids, opts = {}) {
  const t0 = Date.now();
  const fehler = [], f = (id, msg) => fehler.push({ id, msg });
  const leer = (msg, id = figId) => ({ fehler: [{ id, msg }], kombinationen: 0, messung: {}, sekunden: 0 });
  const fig = lib.get('figures', figId);
  if (!fig) return leer('Figur fehlt');
  const rig = lib.get('rigs', fig.rig), posen = lib.get('poses', rig.poses), zustaende = opts.zustaende || PASS_ZUSTAENDE;
  const tol = opts.toleranzen || toleranzenVon(rig), bereiche = rig.bereiche;
  if (!bereiche) return leer('Feld "bereiche" fehlt', `rig ${rig.id}`);
  const optionen = platzOptionen(lib, ids), PLAETZE = Object.keys(fig.params);
  const werte = PLAETZE.map((p) => (opts.nur?.[p] ? (optionen[p] || [fig.params[p]]).filter((w) => opts.nur[p].includes(w)) : optionen[p] || [fig.params[p]]));
  // Schlüssel eines Gelenks = Werte der Plätze seines Sammelmodells (nur diese bestimmen seine Voxel)
  const slots = {};
  for (const jn of KOERPER_GELENKE) {
    const part = fig.parts?.[jn];
    slots[jn] = part ? Object.entries(lib.get('models', part.model)?.params || {}).filter(([, p]) => p.options).map(([k]) => k) : [];
  }
  const werteZ = zustaende.map((z) => poseWerte(posen, z.pose, z.phi));
  const ruheZ = werteZ.length;   // zusätzlicher Zustand hinter den Posen: Ruhepose (alle Winkel 0)
  werteZ.push({ joints: {}, lift: 0 });
  const matrizen = werteZ.map((w) => gelenkMatrizen(rig, w));

  // Einträge je (Gelenk, Schlüssel); Posieren und Paarmessung werden je Eintrag bzw. Eintragspaar gecacht
  const eintraege = new Map();
  let nextId = 0;
  const holeEintrag = (jn, key, vox) => {
    const k = jn + '|' + key; let e = eintraege.get(k);
    if (!e) { e = { id: nextId++, jn, key, vox, welt: [], hash: [] }; eintraege.set(k, e); }
    return e;
  };
  const weltVon = (e, z) => (e.welt[z] ||= posiere(rig, { [e.jn]: e.vox }, werteZ[z], matrizen[z])[e.jn]);
  const zelle = (x, y, z) => Math.floor(x) * 1e6 + Math.floor(y) * 1e3 + Math.floor(z);
  const hashVon = (e, z) => {
    if (!e.hash[z]) {
      const w = weltVon(e, z), h = new Map(), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < w.length; i += 3) {
        const k = zelle(w[i], w[i + 1], w[i + 2]);
        let l = h.get(k); if (!l) h.set(k, (l = [])); l.push(i);
        for (let a = 0; a < 3; a++) { if (w[i + a] < min[a]) min[a] = w[i + a]; if (w[i + a] > max[a]) max[a] = w[i + a]; }
      }
      e.hash[z] = { h, min, max };
    }
    return e.hash[z];
  };
  const r = DURCHDRINGUNG_RADIUS, R2 = r * r, trefferCache = [], zaehlCache = [];
  /** Voxelindizes beider Seiten, die in Zustand z einem Voxel der anderen Seite näher als r kommen: { a: Set, b: Set }. */
  const treffer = (A, B, z) => {
    const ck = A.id * 100000 + B.id, cz = (trefferCache[z] ||= new Map()), c = cz.get(ck);
    if (c) return c;
    const ha = hashVon(A, z), hb = hashVon(B, z), res = { a: new Set(), b: new Set() };
    if (![0, 1, 2].some((k) => ha.min[k] > hb.max[k] + r || hb.min[k] > ha.max[k] + r)) {
      const wa = weltVon(A, z), wb = weltVon(B, z);
      for (let i = 0; i < wa.length; i += 3) {
        const cx = Math.floor(wa[i]), cy = Math.floor(wa[i + 1]), cq = Math.floor(wa[i + 2]);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const l = hb.h.get(zelle(cx + dx, cy + dy, cq + dz));
          if (!l) continue;
          for (const j of l) {
            const x = wa[i] - wb[j], y = wa[i + 1] - wb[j + 1], q = wa[i + 2] - wb[j + 2];
            if (x * x + y * y + q * q < R2) { res.a.add(i); res.b.add(j); }
          }
        }
      }
    }
    cz.set(ck, res);
    return res;
  };
  /** Durchdringung in Pose = Voxel (beider Seiten), die in der Pose durchdrungen sind, in der Ruhepose aber nicht (die Ruhe-Überlappung der Teile prüft A2). */
  const durchdringung = (A, B, z) => {
    const ck = A.id * 100000 + B.id, cz = (zaehlCache[z] ||= new Map()), c = cz.get(ck);
    if (c !== undefined) return c;
    const ruhe = treffer(A, B, ruheZ), pose = treffer(A, B, z);
    let n = 0;
    for (const i of pose.a) if (!ruhe.a.has(i)) n++;
    for (const j of pose.b) if (!ruhe.b.has(j)) n++;
    cz.set(ck, n);
    return n;
  };
  const paarName = (a, b) => { const k1 = [a, b].sort().join('|'), k2 = [SPIEGEL(a), SPIEGEL(b)].sort().join('|'); return k1 < k2 ? k1 : k2; };
  const paare = [];
  for (let i = 0; i < KOERPER_GELENKE.length; i++) for (let j = i + 1; j < KOERPER_GELENKE.length; j++) paare.push([KOERPER_GELENKE[i], KOERPER_GELENKE[j]]);

  // Bestand: dieselbe Messung an Bestandsfiguren, je Zustand und (gespiegeltem) Paar das Maximum
  const bestand = zustaende.map(() => ({}));
  for (const bid of opts.bestand || []) {
    let b;
    try { b = baueBestandFigur(lib, bid, rig); } catch (e) { f(bid, `Bestandsfigur baut nicht: ${e.message}`); continue; }
    const E = {};
    for (const jn of KOERPER_GELENKE) if (b.pro[jn]) E[jn] = holeEintrag(jn, `bestand:${bid}`, b.pro[jn]);
    for (let z = 0; z < zustaende.length; z++) for (const [a, c] of paare) {
      if (!E[a] || !E[c]) continue;
      const n = durchdringung(E[a], E[c], z), pn = paarName(a, c), cur = bestand[z][pn];
      if (!cur || n > cur.max) bestand[z][pn] = { max: n, von: bid };
    }
  }
  // Schwelle je Paar: das Schlimmste, was dasselbe Paar heute in irgendeiner Pose zeigt (plus spielraum). Je Pose steht der Bestandswert nur als Vergleich in der Messung.
  const paarMax = {};
  for (const b of bestand) for (const [pn, v] of Object.entries(b)) paarMax[pn] = Math.max(paarMax[pn] ?? 0, v.max);
  // Ausnahmen (CHA-02 D1): Bestand je Teil
  const ausPaarMax = (opts.ausnahmen || []).map((a) => {
    const pm = {};
    for (const bid of a.bestand || []) {
      let b;
      try { b = baueBestandFigur(lib, bid, rig); } catch (e) { f(bid, `Bestandsfigur baut nicht: ${e.message}`); continue; }
      const E = {};
      for (const jn of KOERPER_GELENKE) if (b.pro[jn]) E[jn] = holeEintrag(jn, `bestand:${bid}`, b.pro[jn]);
      for (let z = 0; z < zustaende.length; z++) for (const [x, c] of paare) { if (E[x] && E[c]) { const pn = paarName(x, c); pm[pn] = Math.max(pm[pn] ?? 0, durchdringung(E[x], E[c], z)); } }
    }
    return pm;
  });
  const schwelle = (z, pn, params) => {
    let t = paarMax[pn] ?? 0;
    (opts.ausnahmen || []).forEach((a, i) => { if (params && Object.entries(a.wenn).every(([p, w]) => params[p] === w)) t = Math.max(t, Math.max(paarMax[pn] ?? 0, ausPaarMax[i][pn] ?? 0) + (a.spielraum || 0)); });
    return t + (opts.spielraum || 0);
  };

  // Kombinationen
  const messung = zustaende.map(() => ({}));
  const gemeldet = new Map();
  const melde = (k, id, msg) => { const g = gemeldet.get(k); if (g) g.n++; else gemeldet.set(k, { id, msg, n: 1 }); };
  const haarGeprueft = new Set(), bereichGeprueft = new Set(), paarGesehen = new Set();
  const wahl = new Array(PLAETZE.length).fill(0), gesamt = werte.reduce((n, w) => n * w.length, 1);
  for (let ci = 0; ci < gesamt; ci++) {
    let rest = ci;
    for (let i = PLAETZE.length - 1; i >= 0; i--) { wahl[i] = rest % werte[i].length; rest = Math.floor(rest / werte[i].length); }
    const params = {}; PLAETZE.forEach((p, i) => { params[p] = werte[i][wahl[i]]; });
    const kombi = PLAETZE.map((p) => params[p]).join('/');
    const E = {};
    let kaputt = false;
    const farben = { ...(fig.colors || {}), hair: HAAR_HEX };
    for (const jn of KOERPER_GELENKE) {
      if (!fig.parts?.[jn]) continue;
      const key = slots[jn].map((s) => params[s]).join('/');
      let e = eintraege.get(jn + '|' + key);
      if (!e) {
        let vox;
        try { vox = baueGelenk(lib, fig, jn, params, farben); }
        catch (err) { melde('bau|' + err.message, kombi, `Baufehler: ${err.message}`); kaputt = true; break; }
        e = holeEintrag(jn, key, vox);
      }
      E[jn] = e;
    }
    if (kaputt) continue;
    if (!Object.values(E).some((e) => e.vox.length)) { melde('leer|' + kombi, kombi, 'Figur ist leer'); continue; }
    for (const jn of KOERPER_GELENKE) {
      const e = E[jn];
      if (!e) continue;
      if (bereichGeprueft.has(e.id)) continue;   // 2. Bereich, einmal je Gelenk und Schlüssel
      bereichGeprueft.add(e.id);
      const box = boxVon(e.vox), gat = gattungVon(fig.parts[jn].model), bl = bereiche[jn];
      if (!box) continue;
      if (!bl) { melde(`bereich|${e.id}`, kombi, `Gelenk ${jn}: kein Bereich im Rig`); continue; }
      const lo = bl.min.slice(), hi = bl.max.slice(), spiegelt = jn.endsWith('R');
      for (const s of slots[jn]) {
        const t = LEERE_WERTE.includes(params[s]) ? null : tol[s]?.[gat];
        if (!t) continue;
        for (let i = 0; i < 3; i++) {
          const tmin = spiegelt && i === 0 ? t.max[0] : t.min[i], tmax = spiegelt && i === 0 ? t.min[0] : t.max[i];
          lo[i] = Math.min(lo[i], bl.min[i] - tmin); hi[i] = Math.max(hi[i], bl.max[i] + tmax);
        }
      }
      const ueber = [];
      for (let i = 0; i < 3; i++) {
        if (box.min[i] < lo[i]) ueber.push(`${'xyz'[i]} min ${box.min[i]} < ${lo[i]}`);
        if (box.max[i] > hi[i]) ueber.push(`${'xyz'[i]} max ${box.max[i]} > ${hi[i]}`);
      }
      if (ueber.length) {
        const aussen = e.vox.filter((v) => v.x < lo[0] || v.x > hi[0] || v.y < lo[1] || v.y > hi[1] || v.z < lo[2] || v.z > hi[2]).length;
        melde(`bereich|${e.id}`, kombi, `Gelenk ${jn}: ${aussen} Voxel außerhalb von Bereich + Toleranz (${ueber.join(', ')})`);
      }
    }
    // 3. Haar durch Kopfbedeckung (Frisur × Kopfbedeckung)
    if (params.kopf !== undefined && !LEERE_WERTE.includes(params.kopf)) {
      const hk = `${params.koerper}/${params.frisur}/${params.kopf}`;
      if (!haarGeprueft.has(hk)) {
        haarGeprueft.add(hk);
        let n = 0;
        n = haarAussen(E.head.vox).length;
        if (n) melde(`haar|${hk}`, kombi, `Gelenk head: ${n} sichtbare Haarvoxel außerhalb der Gesichtsöffnung (Haar sticht durch ${params.kopf})`);
      }
    }
    // 4. Durchdringung in Pose (je Eintragspaar und Ausnahme-Zugehörigkeit nur einmal: das Ergebnis hängt nur davon ab)
    const sig = (opts.ausnahmen || []).reduce((m, a, i) => m | (Object.entries(a.wenn).every(([p, w]) => params[p] === w) ? 1 << i : 0), 0);
    for (let pi = 0; pi < paare.length; pi++) {
      const [a, c] = paare[pi];
      if (!E[a] || !E[c]) continue;
      const sk = ((sig * 64 + pi) * 1e5 + E[a].id) * 1e5 + E[c].id;
      if (paarGesehen.has(sk)) continue;
      paarGesehen.add(sk);
      for (let z = 0; z < zustaende.length; z++) {
      const n = durchdringung(E[a], E[c], z), pn = paarName(a, c), m = messung[z][pn];
      const sw = n > 0 ? schwelle(z, pn, params) : 0;
      if (!m || n > m.max) messung[z][pn] = { max: n, kombi, schwelle: sw };
      if (n > sw) melde(`dd|${z}|${E[a].id}|${E[c].id}`, kombi, `Pose ${zustaende[z].id}, ${a}/${c}: ${n} Voxel durchdringen sich (Schwelle ${sw}, Bestand in dieser Pose ${bestand[z][pn]?.max ?? 0})`);
      }
    }
  }
  for (const { id, msg, n } of gemeldet.values()) f(id, n > 1 ? `${msg} [${n} Wertekombinationen]` : msg);
  const ausgabe = {};
  zustaende.forEach((zs, z) => {
    ausgabe[zs.id] = Object.entries(messung[z]).map(([paar, m]) => ({ paar, max: m.max, kombi: m.kombi, bestand: bestand[z][paar]?.max ?? 0, schwelle: Math.max(m.schwelle, schwelle(z, paar)) })).sort((x, y) => y.max - x.max);
  });
  return { fehler, kombinationen: gesamt, messung: ausgabe, sekunden: (Date.now() - t0) / 1000 };
}

/**
 * Figur mit Anbauten, die am Körper hängen (Aufsätze head_top → Gelenk head, shoulder → torso, back → torso); Anbauten an Händen (Waffen) fehlen.
 * Alle Anbauten sind in Figur-Koordinaten modelliert, ihr anchor ist die Gelenkposition. Wie baueFigur, dazu pro.<gelenk> und grid um die Anbauten ergänzt.
 * Für Bestandsfiguren (A2): Passprobe und Bilder über alle Figuren, nicht nur den Katalog. opts wie baueFigur.
 */
export function baueFigurMitAnbauten(lib, figId, opts = {}) {
  const r = baueFigur(lib, figId, opts), fig = lib.get('figures', figId), rig = lib.get('rigs', fig.rig);
  const params = { ...(fig.params || {}), ...(opts.params || {}) }, colors = { ...(fig.colors || {}), ...(opts.colors || {}) };
  for (const [g, a] of Object.entries(fig.attach || {})) {
    const jn = g === 'back' ? 'torso' : g;
    if (!r.pro[jn]) continue;   // Hände (Waffen) und fehlende Gelenke
    const b = lib.build(a.model, { params: lib.partParams(a.model, params, a.params), palette: a.palette || fig.palette, colors });
    const at = rig.joints[g].at, an = b.anchor;
    for (const v of b.grid.values()) {
      const p = { x: v.x - an[0] + at[0], y: v.y - an[1] + at[1], z: v.z - an[2] + at[2], c: v.c, e: v.e };
      r.pro[jn].push(p); r.grid.set(p.x, p.y, p.z, p.c, p.e);
    }
  }
  return r;
}

/** Alle Modell-IDs, die ein Modell über use-Schritte erreicht (Vorlagen {x} → alle passenden IDs), samt dem Modell selbst. */
function modellHuelle(lib, id, ids, seen = new Set()) {
  if (seen.has(id)) return seen;
  seen.add(id);
  const m = lib.get('models', id);
  if (m) for (const u of alleUse(m.ops)) for (const k of kandidaten(u, ids)) modellHuelle(lib, k, ids, seen);
  return seen;
}

/**
 * Regel (f), Kopf jeder Figur (CHA-02 A2): Das Kopfteil (Gelenk head, ohne Anbauten) jeder Figur
 *  1. trägt den 8er-Schädel: sein use-Baum enthält fig/basis/kopf oder den Körper-Kopf cha/koerper/…/head (der nackte Kopf liegt unter Helm und Haar),
 *  2. hat über der Halslinie (y >= 26) eine Hülle von mindestens 8 × 7 × 8 Voxeln (Helm und Haar dürfen größer sein),
 *  3. hat den Hals 4 × 4 bei y 25.
 * Rückgabe Liste { id, msg } (leer = in Ordnung).
 */
export function pruefeFigurKopf(lib, figId, ids) {
  const fehler = [], fig = lib.get('figures', figId), part = fig?.parts?.head;
  if (!part) return [{ id: figId, msg: 'Figur ohne Kopfteil (parts.head)' }];
  const huelle = modellHuelle(lib, part.model, ids);
  if (![...huelle].some((m) => m === 'fig/basis/kopf' || m.startsWith('cha/koerper/'))) fehler.push({ id: figId, msg: `Kopfteil ${part.model} enthält nicht den 8er-Schädel (fig/basis/kopf bzw. cha/koerper/…/head)` });
  let b;
  try { b = baueFigur(lib, figId); } catch (e) { return [...fehler, { id: figId, msg: `Kopf baut nicht: ${e.message}` }]; }
  const vs = (b.pro.head || []).filter((v) => v.y >= KOPF_MASS.halsY + 1);
  if (!vs.length) return [...fehler, { id: figId, msg: 'Kopf ohne Voxel über y 25' }];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const v of vs) for (const [i, w] of [[0, v.x], [1, v.y], [2, v.z]]) { if (w < mn[i]) mn[i] = w; if (w > mx[i]) mx[i] = w; }
  const mass = { breite: mx[0] - mn[0] + 1, hoehe: mx[1] - mn[1] + 1, tiefe: mx[2] - mn[2] + 1 };
  for (const k of Object.keys(mass)) if (mass[k] < KOPF_MASS[k]) fehler.push({ id: figId, msg: `Kopfhülle ${k} ${mass[k]} (mindestens ${KOPF_MASS[k]})` });
  const hals = new Set((b.pro.head || []).filter((v) => v.y === KOPF_MASS.halsY).map((v) => `${v.x},${v.z}`));
  for (const x of [-2, -1, 0, 1]) for (const z of [-2, -1, 0, 1]) if (!hals.has(`${x},${z}`)) { fehler.push({ id: figId, msg: `Hals bei y ${KOPF_MASS.halsY} unvollständig (4 × 4 fehlt bei x ${x}, z ${z})` }); return fehler; }
  return fehler;
}

// =============================================================================================
// CHA-02 D1: paarweise Abdeckung, Dreiecke
// =============================================================================================
/**
 * Paarweise (all-pairs) Abdeckung: werte = Liste von Wertelisten (je Faktor, z. B. je Platz der Figur). Rückgabe: Liste von Kombinationen (je ein Wert je Faktor), in denen
 * jedes Wertepaar zweier verschiedener Faktoren mindestens einmal vorkommt. Gierig und deterministisch (erstes offenes Paar, dann je Faktor der Wert mit den meisten neu gedeckten Paaren).
 * Für Tests, deren volles Produkt zu teuer ist (ab 16 000 Kombinationen kostet das Bauen jeder Figur Minuten); die Passprobe selbst läuft über das volle Produkt.
 */
export function paarweise(werte) {
  const n = werte.length, offen = new Map(), key = (i, a, j, b) => `${i}\u0000${a}\u0000${j}\u0000${b}`;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (const a of werte[i]) for (const b of werte[j]) offen.set(key(i, a, j, b), [i, a, j, b]);
  const out = [];
  while (offen.size) {
    const [i0, a0, j0, b0] = offen.values().next().value, wahl = new Array(n).fill(undefined);
    wahl[i0] = a0; wahl[j0] = b0;
    for (let k = 0; k < n; k++) {
      if (wahl[k] !== undefined) continue;
      let best = werte[k][0], bestN = -1;
      for (const v of werte[k]) {
        let c = 0;
        for (let f = 0; f < n; f++) { if (f === k || wahl[f] === undefined) continue; if (offen.has(f < k ? key(f, wahl[f], k, v) : key(k, v, f, wahl[f]))) c++; }
        if (c > bestN) { bestN = c; best = v; }
      }
      wahl[k] = best;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) offen.delete(key(i, wahl[i], j, wahl[j]));
    out.push(wahl);
  }
  return out;
}

/**
 * Voxel und Dreiecke einer Figur (Gelenke einzeln gebaut und vernetzt wie in tools/cha-mess.mjs: core/mesher.js mit AO und Greedy; Dreiecke = Indizes / 3 der beleuchteten und leuchtenden Netze;
 * Spiegelteile zählen einzeln). Ohne Anbauten (die Waffe baut das Spiel an). opts { params, colors } wie baueFigur.
 */
export function dreieckeVon(lib, figId, opts = {}) {
  const fig = lib.get('figures', figId);
  const params = { ...(fig.params || {}), ...(opts.params || {}) }, colors = { ...(fig.colors || {}), ...(opts.colors || {}) };
  let voxel = 0, dreiecke = 0;
  for (const part of Object.values(fig.parts || {})) {
    const b = lib.build(part.model, { params: lib.partParams(part.model, params, part.params), palette: part.palette || fig.palette, colors });
    const m = meshGrid(b.grid);
    voxel += b.grid.size; dreiecke += (m.lit.indices.length + m.emit.indices.length) / 3;
  }
  return { voxel, dreiecke: Math.round(dreiecke) };
}
