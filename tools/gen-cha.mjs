// Spielerfigur aus Schichten (cha/): Platz → Teile → Schicht-Modelle je Gelenk-Gattung → Sammelmodelle → Figur.
// Liest die Bestandsteile (assets/models/fig/**, unverändert) und schreibt
//   assets/models/cha/**          Schicht-Wrapper (use + colors + carve/paint), Sammelmodelle cha/joint/<gattung>
//   assets/palettes/cha.json      Platzrollen (Standardfarben aus den Bestandspaletten)
//   assets/figures/cha/spieler.json
// Erzeugte Dateien nie von Hand bearbeiten: Teile ergänzt man in TEILE unten (siehe AUTHORING.md, "Spielerfigur aus Schichten").
//
// Aufruf: node tools/gen-cha.mjs [--check]
//   --check   nichts schreiben; Exit 1, wenn eine Datei fehlt, veraltet oder überzählig ist
//
// Deterministisch: gleiche Eingaben → byte-gleiche Dateien (keine Zeitstempel, feste Reihenfolgen).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Library } from '../core/library.js';
import { fsIO } from './fs-io.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (...p) => path.join(root, 'assets', ...p);
const checkOnly = process.argv.includes('--check');

// =============================================================================================
// DATEN
// =============================================================================================

/** Gattung → Gelenke der Figur (links normal, rechts gespiegelt). */
const GELENKE = {
  hips: ['hips'], torso: ['torso'], head: ['head'], upperArm: ['upperArmL', 'upperArmR'],
  lowerArm: ['lowerArmL', 'lowerArmR'], thigh: ['thighL', 'thighR'], shin: ['shinL', 'shinR'],
};
/** Schichtfolge je Gattung = Reihenfolge der use-Schritte (unten liegt zuerst). Am Kopf: Bart vor Gesicht (Bartschatten malt sonst über die Lippen). */
const FOLGE = {
  koerper_gelenk: ['koerper', 'hose', 'schuhe', 'oberteil', 'haende', 'umhang'],
  head: ['koerper', 'bart', 'gesicht', 'frisur', 'kopf'],
};
const SCHICHT_NAME = { koerper: 'Körper', hose: 'Hose', schuhe: 'Schuhe', oberteil: 'Oberteil', haende: 'Handschuhe', umhang: 'Umhang', bart: 'Bart', gesicht: 'Gesicht', frisur: 'Frisur', kopf: 'Kopfbedeckung' };

/** Plätze in fester Reihenfolge (Schnittstelle Voxelwerk ↔ Spiel). `keine` = Name des leeren Werts (ohne Datei, Fallback cha/leer). */
const PLAETZE = [
  { id: 'koerper', gruppe: 'koerper', standard: 'standard' },
  { id: 'gesicht', gruppe: 'charakter', standard: 'lerche', keine: 'keine' },
  { id: 'frisur', gruppe: 'charakter', standard: 'dutt', keine: 'keine' },
  { id: 'bart', gruppe: 'charakter', standard: 'keiner', keine: 'keiner' },
  { id: 'kopf', gruppe: 'outfit', standard: 'keine', keine: 'keine' },
  { id: 'oberteil', gruppe: 'outfit', standard: 'bordtunika', keine: 'keine' },
  { id: 'hose', gruppe: 'outfit', standard: 'bordhose', keine: 'keine' },
  { id: 'schuhe', gruppe: 'outfit', standard: 'bordstiefel', keine: 'keine' },
  { id: 'haende', gruppe: 'outfit', standard: 'keine', keine: 'keine' },
  { id: 'umhang', gruppe: 'outfit', standard: 'keiner', keine: 'keiner' },
];

/** Gelenk- und Hautfarben liegen bei der Figur (colors), nie in einem Teil. */
const FIGURFARBEN = ['skin', 'skin_shadow', 'hair'];
const FIGUR_STANDARD_COLORS = { skin: '#C68E68', skin_shadow: '#A06E4E', hair: '#3B2416' };

// Hilfen für die Daten
const carve = (name, at, size) => ({ name, op: 'box', at, size, mode: 'carve' });

/**
 * Teile. Je Teil und Gattung ein Eintrag:
 *   quelle   Bestandsteil, das per use eingesetzt wird (unverändert)
 *   farben   Bestandsrolle → Platzrolle (per colors am use); nie mit skin/skin_shadow/hair als Schlüssel
 *   params   feste Parameter am use                  decl  an der Schicht deklarierte, durchgereichte Parameter
 *   schnitte carve-Boxen nach dem use (nur Boxen: Teil von Körper/Kleidung trennen)
 *   at       Versatz am use (Anbaupunkt-Teile wie der Fellumhang: Anker des Bestandsteils)
 *   ops      statt quelle: Ops aus einem Bestandsteil herauslösen { quelle, namen | ohneBedingung, paintZuAdd }
 * palette = Bestandspalette, aus der die Standardfarben der Platzrollen stammen. rollen = feste Werte statt Bestandswert.
 */
const TEILE = [
  { platz: 'koerper', name: 'standard', palette: 'base', rollen: { unter: '#8C949E', unter_2: '#3B3F46' }, gattungen: {
    hips: { quelle: 'fig/basis/huefte', farben: { cloth: 'unter', leather: 'unter_2' } },
    torso: { quelle: 'fig/basis/rumpf', farben: { cloth: 'unter' } },
    thigh: { quelle: 'fig/basis/oberschenkel', farben: { cloth: 'unter' } },
    shin: { quelle: 'fig/basis/unterschenkel', params: { bootH: 2 }, farben: { cloth: 'unter', metal_dark: 'skin_shadow', rubber: 'skin_shadow' } },
    upperArm: { quelle: 'fig/basis/oberarm', farben: { cloth: 'unter' } },
    lowerArm: { quelle: 'fig/basis/unterarm', params: { glove: 0 }, farben: { cloth: 'unter', metal_dark: 'skin_shadow' } },
    head: { ops: { quelle: 'fig/lerche/head', ohneBedingung: true }, palette: 'lerche_rom', farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },
  { platz: 'gesicht', name: 'lerche', palette: 'lerche_rom', gattungen: {
    head: { ops: { quelle: 'fig/lerche/head', namen: ['0 Brauen', '0 Ohrring'], paintZuAdd: ['0 Brauen'] }, farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },
  { platz: 'frisur', name: 'dutt', palette: 'lerche_rom', gattungen: {
    head: { ops: { quelle: 'fig/lerche/head', namen: ['0 Haarkranz', '0 Haar oben', '0 Scheitel', '0 Haar hinten', '0 Haar Seiten', '0 Strähne', '0 Haarband', '0 Dutt', '0 Dutt Spitze'] }, farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },
  { platz: 'oberteil', name: 'bordtunika', palette: 'lerche_rom', gattungen: {
    torso: { quelle: 'fig/lerche/tunic_torso', farben: { cloth2: 'top', trim: 'top_zier' } },
    hips: { quelle: 'fig/lerche/tunic_hips', farben: { cloth2: 'top', leather: 'top_leder', trim: 'top_zier' } },
    upperArm: { quelle: 'fig/lerche/sleeve_upper', decl: { plate: { default: 1, min: 0, max: 1, step: 1, label: 'Schulterplatte (1 links, 0 rechts)' } }, farben: { cloth2: 'top', secondary: 'top_unter', trim: 'top_zier' } },
    lowerArm: { quelle: 'fig/lerche/sleeve_lower', farben: { leather: 'top_leder', secondary: 'top_unter', trim: 'top_zier' } },
  } },
  { platz: 'hose', name: 'bordhose', palette: 'lerche_rom', gattungen: {
    thigh: { quelle: 'fig/lerche/leg_upper', params: { style: 0 }, farben: { cloth2: 'hose_zier', secondary: 'hose' } },
    shin: { quelle: 'fig/lerche/leg_lower', params: { style: 0 }, farben: { secondary: 'hose', leather: 'schuh', metal_dark: 'schuh_2', trim: 'schuh_zier' },
      schnitte: [carve('Stiefel abschneiden (y 0..5)', [1, 0, -1], [3, 6, 5])] },
  } },
  { platz: 'schuhe', name: 'bordstiefel', palette: 'lerche_rom', gattungen: {
    shin: { quelle: 'fig/lerche/leg_lower', params: { style: 0 }, farben: { secondary: 'hose', leather: 'schuh', metal_dark: 'schuh_2', trim: 'schuh_zier' },
      schnitte: [carve('Hosenrest abschneiden (y 6..7)', [1, 6, -1], [3, 2, 3])] },
  } },
];

/** Platzrollen ohne Bestandsquelle. `spieler` ist für die Namensmarke reserviert: kein Teil benutzt sie. */
const FESTE_ROLLEN = { spieler: '#56B4E9' };

// =============================================================================================
// ERZEUGUNG
// =============================================================================================
const lib = new Library(fsIO(root));
const bestand = (id) => JSON.parse(fs.readFileSync(A('models', id + '.json'), 'utf8'));
const clean = (o) => JSON.parse(JSON.stringify(o));
const stripIf = (o) => { const { if: _i, ...r } = o; return r; };
const paintToAdd = (o) => { if (o.mode !== 'paint') return o; const { mode: _m, ...r } = o; return r; };   // paint wirkt nur im eigenen Gitter: ohne Untergrund unsichtbar

const files = new Map();   // Pfad (relativ zu root, /) → Text
const put = (rel, obj) => files.set(rel, JSON.stringify(obj, null, 2) + '\n');
const putModel = (id, obj) => put(`assets/models/${id}.json`, { id, tier: 'detail', palette: 'cha', anchor: [0, 0, 0], generated: true, ...obj });

const useOp = (model, o = {}) => ({ op: 'use', model, ...o });
const leerOp = (name, model, o = {}) => ({ name, ...useOp(model, { fallback: ['cha/leer'], ...o }) });

putModel('cha/leer', { name: 'Leer (kein Teil)', tags: ['cha', 'leer'], notes: 'Fallback für keine/keiner. Darf als einziges Modell leer sein.', ops: [] });

for (const p of new Set(TEILE.flatMap((t) => [t.palette, ...Object.values(t.gattungen).map((g) => g.palette).filter(Boolean)]))) await lib.load('palettes', p);
const hex = (c) => '#' + c.toString(16).padStart(6, '0').toUpperCase();
/** Wert einer Platzrolle: fester Wert oder { palette, role } aus einer Bestandspalette. */
const aufloesen = (w) => {
  if (typeof w === 'string') return w;
  const r = lib.palette(w.palette).roles[w.role];
  if (!r) throw new Error(`Rolle ${w.role} fehlt in Palette ${w.palette}`);
  return r.e > 0 ? { color: hex(r.c), emit: r.e } : hex(r.c);
};
const rolesBySource = new Map();   // Platzrolle → { wert, von }
const rolle = (ziel, w, von) => {
  const wert = aufloesen(w);
  const alt = rolesBySource.get(ziel);
  if (alt && JSON.stringify(alt.wert) !== JSON.stringify(wert)) throw new Error(`Platzrolle ${ziel}: ${von} (${JSON.stringify(wert)}) widerspricht ${alt.von} (${JSON.stringify(alt.wert)}); Wert festlegen mit "rollen"`);
  rolesBySource.set(ziel, { wert, von });
};

for (const t of TEILE) {
  const platz = PLAETZE.find((p) => p.id === t.platz);
  if (!platz) throw new Error(`Teil ${t.platz}/${t.name}: unbekannter Platz`);
  for (const [ziel, w] of Object.entries(t.rollen || {})) rolle(ziel, w, `${t.platz}/${t.name} (fest)`);
  for (const [gattung, g] of Object.entries(t.gattungen)) {
    if (!GELENKE[gattung]) throw new Error(`Teil ${t.platz}/${t.name}: unbekannte Gattung ${gattung}`);
    const id = `cha/${t.platz}/${t.name}/${gattung}`;
    for (const k of Object.keys(g.farben || {})) if (FIGURFARBEN.includes(k)) throw new Error(`${id}: Rolle ${k} gehört der Figur (colors), darf am use nicht umgelegt werden`);
    // Standardfarben der Platzrollen aus der Bestandspalette (nicht für Rollen, die ein Teil fest vorgibt oder die Figur setzt)
    const palId = g.palette || t.palette;
    for (const [von, ziel] of Object.entries(g.farben || {})) {
      if (FIGURFARBEN.includes(ziel) || (t.rollen && ziel in t.rollen)) continue;
      rolle(ziel, { palette: palId, role: von }, `${id} (${von})`);
    }
    const params = g.params, decl = g.decl;
    const layer = { name: `${platz.id} ${t.name} (${gattung})`, tags: ['cha', 'schicht', platz.id], ...(decl ? { params: decl } : {}) };
    if (g.quelle) {
      const pass = decl ? Object.fromEntries(Object.keys(decl).map((k) => [k, k])) : undefined;
      const p = { ...(params || {}), ...(pass || {}) };
      putModel(id, { ...layer, notes: `Schicht aus ${g.quelle}, Bestandsteil unverändert per use.`, ops: [useOp(g.quelle, { ...(g.at ? { at: g.at } : {}), ...(Object.keys(p).length ? { params: p } : {}), colors: g.farben }), ...clean(g.schnitte || [])] });
    } else {
      // Ops herauslösen: eigenes Modell mit den kopierten Ops, Wrapper legt die Rollen um
      const o = g.ops, src = bestand(o.quelle);
      const sel = o.ohneBedingung ? src.ops.filter((x) => x.if === undefined) : o.namen.map((n) => { const x = src.ops.find((y) => y.name === n); if (!x) throw new Error(`${id}: Op "${n}" fehlt in ${o.quelle}`); return x; });
      const ops = sel.map((x) => { const c = stripIf(clean(x)); return (o.paintZuAdd || []).includes(x.name) ? paintToAdd(c) : c; });
      putModel(id + '_ops', { name: `${layer.name}: herausgelöste Ops`, tags: ['cha', 'ops'], notes: `Ops aus ${o.quelle}${o.ohneBedingung ? ' (ohne Bedingung)' : ''}, Reihenfolge wie im Bestand.`, ops });
      putModel(id, { ...layer, notes: `Schicht aus ${o.quelle}, herausgelöst.`, ops: [useOp(id + '_ops', { colors: g.farben })] });
    }
  }
}

// Sammelmodelle je Gattung -------------------------------------------------------------------
const hatTeil = (platz, gattung) => TEILE.some((t) => t.platz === platz && t.gattungen[gattung]);
const werte = (p) => [p.standard, ...(p.keine && p.keine !== p.standard ? [p.keine] : [])];
const platzOf = (id) => PLAETZE.find((p) => p.id === id);
/** Parameter-Deklarationen der Teile-Schichten, die das Sammelmodell durchreichen muss. */
const declOf = (platz, gattung) => Object.assign({}, ...TEILE.filter((t) => t.platz === platz && t.gattungen[gattung]?.decl).map((t) => t.gattungen[gattung].decl));

for (const gattung of Object.keys(GELENKE)) {
  const folge = gattung === 'head' ? FOLGE.head : FOLGE.koerper_gelenk;
  const slots = folge.filter((p) => hatTeil(p, gattung));
  if (gattung === 'head') slots.splice(0, slots.length, ...FOLGE.head);   // Kopf: alle Kopfplätze, auch wenn A1 für kopf nur "keine" kennt
  const params = {}, ops = [];
  for (const s of slots) { const p = platzOf(s); params[s] = { default: p.standard, options: werte(p), label: SCHICHT_NAME[s] }; }
  for (const s of slots) Object.assign(params, declOf(s, gattung));
  const pass = (s) => { const d = declOf(s, gattung); return Object.keys(d).length ? { params: Object.fromEntries(Object.keys(d).map((k) => [k, k])) } : {}; };
  if (gattung !== 'head') {
    for (const s of slots) ops.push(leerOp(SCHICHT_NAME[s], `cha/${s}/{${s}}/${gattung}`, pass(s)));
  } else {
    // Frisur als eigene Schicht in eigenem Gitter; die Hutmaske (cha/kopf/<name>/head_maske, ab A2) schneidet nur dieses Gitter
    putModel('cha/frisur_maskiert/head', { name: 'Frisur unter der Kopfbedeckung (Maske schneidet nur das Haar-Gitter)', tags: ['cha', 'schicht'],
      params: { frisur: { default: 'dutt', options: werte(platzOf('frisur')) }, kopf: { default: 'keine', options: werte(platzOf('kopf')) } },
      ops: [leerOp('Frisur', 'cha/frisur/{frisur}/head'), { name: 'Haarmaske (carve)', ...useOp('cha/kopf/{kopf}/head_maske', { fallback: ['cha/leer'], mode: 'carve' }) }] });
    for (const s of ['koerper', 'bart', 'gesicht']) ops.push(leerOp(SCHICHT_NAME[s], `cha/${s}/{${s}}/head`));
    ops.push({ name: 'Frisur (unter Hutmaske)', ...useOp('cha/frisur_maskiert/head', { params: { frisur: '{frisur}', kopf: '{kopf}' } }) });
    ops.push(leerOp(SCHICHT_NAME.kopf, 'cha/kopf/{kopf}/head'));
  }
  putModel(`cha/joint/${gattung}`, { name: `Sammelmodell ${gattung} (Schichten)`, tags: ['cha', 'joint'], notes: 'Schichtfolge = Reihenfolge der use-Schritte.', params, ops });
}

// Palette -----------------------------------------------------------------------------------
const roles = {};
for (const [ziel, { wert }] of [...rolesBySource.entries()].sort(([x], [y]) => x.localeCompare(y))) roles[ziel] = wert;
Object.assign(roles, FESTE_ROLLEN);
put('assets/palettes/cha.json', { id: 'cha', name: 'Spielerfigur (Platzrollen)', extends: 'base', generated: true,
  notes: 'Standardfarben der Platzrollen der Schichten (cha/). skin, skin_shadow, hair kommen ausschließlich von der Figur (colors). Keine Spielerfarbe in Kleidungsrollen.', roles });

// Figur -------------------------------------------------------------------------------------
const figParams = {};
for (const p of PLAETZE) figParams[p.id] = p.standard;
const part = (model, o = {}) => ({ model, ...o });
const parts = {
  head: part('cha/joint/head'), torso: part('cha/joint/torso'), hips: part('cha/joint/hips'),
  upperArmL: part('cha/joint/upperArm', { params: { plate: 1 } }), upperArmR: part('cha/joint/upperArm', { mirror: true, params: { plate: 0 } }),
  lowerArmL: part('cha/joint/lowerArm'), lowerArmR: part('cha/joint/lowerArm', { mirror: true }),
  thighL: part('cha/joint/thigh'), thighR: part('cha/joint/thigh', { mirror: true }),
  shinL: part('cha/joint/shin'), shinR: part('cha/joint/shin', { mirror: true }),
};
put('assets/figures/cha/spieler.json', { id: 'cha/spieler', name: 'Spielerfigur aus Schichten', rig: 'human', palette: 'cha', generated: true, tags: ['figur', 'cha'],
  notes: 'params = Teil je Platz (siehe tools/gen-cha.mjs, PLAETZE). colors: nur Haut und Haar; keine Spielerfarbe in der Kleidung.',
  colors: FIGUR_STANDARD_COLORS, params: figParams, parts });

// =============================================================================================
// SCHREIBEN / PRÜFEN
// =============================================================================================
const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const rel = (f) => path.relative(root, f).replace(/\\/g, '/');
const vorhanden = new Set([...walk(A('models', 'cha')), ...walk(A('figures', 'cha'))].map(rel).concat(fs.existsSync(A('palettes', 'cha.json')) ? ['assets/palettes/cha.json'] : []));

let bad = 0;
for (const [f, text] of files) {
  const abs = path.join(root, f), cur = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (cur !== null && cur.replaceAll('\r\n', '\n') === text) continue;   // Zeilenenden egal (autocrlf)
  if (checkOnly) { bad++; console.log(`  ✗ ${f}: ${cur === null ? 'fehlt' : 'veraltet'}`); continue; }
  fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, text);
}
for (const f of vorhanden) if (!files.has(f)) {
  if (checkOnly) { bad++; console.log(`  ✗ ${f}: überzählig`); continue; }
  fs.unlinkSync(path.join(root, f));
}
console.log(`${checkOnly ? (bad ? '✗' : '✓') : '✓'} cha: ${files.size} Dateien${checkOnly ? (bad ? `, ${bad} Abweichungen` : ' aktuell') : ' geschrieben'}`);
process.exit(bad ? 1 : 0);
