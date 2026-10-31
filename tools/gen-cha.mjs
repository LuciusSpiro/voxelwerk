// Spielerfigur aus Schichten (cha/): Platz → Teile → Schicht-Modelle je Gelenk-Gattung → Sammelmodelle → Figur.
// Liest die Bestandsteile (assets/models/fig/**, unverändert) und schreibt
//   assets/models/cha/**          Schicht-Wrapper (use + colors + carve/paint), Sammelmodelle cha/joint/<gattung>
//   assets/palettes/cha.json      Platzrollen (Standardfarben aus den Bestandspaletten, je Teil eigene Rollen)
//   assets/figures/cha/spieler.json
//   assets/katalog/charakter.json Katalog für das Spiel (Plätze, Teile, Hauttöne, Haarfarben)
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
import { PINNEN } from './cha-lib.mjs';

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

/**
 * Plätze in fester Reihenfolge (Schnittstelle Voxelwerk ↔ Spiel).
 * `keine` = Name des leeren Werts (ohne Datei, Fallback cha/leer), `keineName` = Anzeigename dazu. Ohne `keine` ist der Platz Pflicht.
 */
const PLAETZE = [
  { id: 'koerper', name: 'Körper', gruppe: 'koerper', standard: 'standard' },
  { id: 'gesicht', name: 'Gesicht', gruppe: 'charakter', standard: 'lerche' },   // Pflicht: ein Gesicht gibt es immer
  { id: 'frisur', name: 'Frisur', gruppe: 'charakter', standard: 'dutt', keine: 'keine', keineName: 'Kahl' },
  { id: 'bart', name: 'Bart', gruppe: 'charakter', standard: 'keiner', keine: 'keiner', keineName: 'Kein Bart' },
  { id: 'kopf', name: 'Kopfbedeckung', gruppe: 'outfit', standard: 'keine', keine: 'keine', keineName: 'Keine' },
  { id: 'oberteil', name: 'Oberteil', gruppe: 'outfit', standard: 'bordtunika', keine: 'keine', keineName: 'Unterzeug' },
  { id: 'hose', name: 'Hose', gruppe: 'outfit', standard: 'bordhose', keine: 'keine', keineName: 'Unterzeug' },
  { id: 'schuhe', name: 'Schuhe', gruppe: 'outfit', standard: 'bordstiefel', keine: 'keine', keineName: 'Barfuß' },
  { id: 'haende', name: 'Hände', gruppe: 'outfit', standard: 'keine', keine: 'keine', keineName: 'Keine' },
  { id: 'umhang', name: 'Umhang', gruppe: 'outfit', standard: 'keiner', keine: 'keiner', keineName: 'Keiner' },
];

/** Hautton (Paar skin + skin_shadow, Schatten ca. 0,78 der Hauptfarbe) und Haarfarbe. Index 0 = Standardfarben der Figur. */
const HAUT = [
  { skin: '#C68E68', skin_shadow: '#A06E4E' },   // 0 mittel (Standard)
  { skin: '#F0CDAE', skin_shadow: '#C9A589' },   // 1 hell
  { skin: '#9A6A48', skin_shadow: '#7A5238' },   // 2 braun
  { skin: '#5E3D2B', skin_shadow: '#472D20' },   // 3 dunkel
];
const HAAR = [
  '#3B2416',   // 0 braun (Standard)
  '#17130F',   // 1 schwarz
  '#D2AE5C',   // 2 blond
  '#A8431E',   // 3 rot
];

/** Gelenk- und Hautfarben liegen bei der Figur (colors), nie in einem Teil. */
const FIGURFARBEN = ['skin', 'skin_shadow', 'hair'];
const FIGUR_STANDARD_COLORS = { ...HAUT[0], hair: HAAR[0] };

// Hilfen für die Daten
const carve = (name, at, size) => ({ name, op: 'box', at, size, mode: 'carve' });
const SCHABLONE = '#808080';   // Farbe von Schablonenboxen (nur ihre Form zählt, sie schneiden per carve)

/**
 * Teile. Je Teil und Gattung ein Eintrag:
 *   quelle   Bestandsteil, das per use eingesetzt wird (unverändert)
 *   farben   Bestandsrolle → Platzrolle (per colors am use). Der Platzrollenname wird je Teil eindeutig gemacht (<name>_<teil>),
 *            jedes Teil behält so seine eigenen Bestandsfarben. Nie skin/skin_shadow/hair als Ziel; als Schlüssel nur laut PINNEN (cha-lib).
 *   params   feste Parameter am use                  decl  an der Schicht deklarierte, durchgereichte Parameter
 *   schnitte carve-Boxen nach dem use (nur Boxen: Teil von Körper/Kleidung trennen)
 *   danach   weitere Ops nach dem use (Boxen); color "@<Bestandsrolle>" = Platzrolle dieses Teils
 *   at       Versatz am use (Anbaupunkt-Teile wie der Fellumhang: Anker des Bestandsteils)
 *   ops      statt quelle: Ops aus Bestandsteilen herauslösen. Ein Objekt oder eine Liste von
 *              { quelle, namen | ohneBedingung | ohneNamen, paintZuAdd: [Namen], breit: [Namen] }
 *              paintZuAdd: paint wirkt nur im eigenen Gitter, ohne Untergrund also unsichtbar → als add
 *              breit: Box von 4 auf 6 Voxel Breite (x -3..2), Kopfmaß der Lerche
 *   schichten statt ops: mehrere herausgelöste Teilmodelle [{ name, ops, modus }], modus = Modus des use (z. B. paint)
 *   zusatz   weitere Modelle neben der Schicht: { <schluessel>: { name, ops } } → cha/<platz>/<teil>/<gattung>_<schluessel>
 * palette = Bestandspalette, aus der die Standardfarben der Platzrollen stammen. rollen = feste Werte statt Bestandswert.
 * anzeige = Name im Katalog, volk = Herkunft im Katalog (lerche, crew, germanen, rom).
 */
const TEILE = [
  { platz: 'koerper', name: 'standard', anzeige: 'Standard', palette: 'base', rollen: { unter: '#8C949E', unter_2: '#3B3F46' }, gattungen: {
    hips: { quelle: 'fig/basis/huefte', farben: { cloth: 'unter', leather: 'unter_2' } },
    torso: { quelle: 'fig/basis/rumpf', farben: { cloth: 'unter' } },
    thigh: { quelle: 'fig/basis/oberschenkel', farben: { cloth: 'unter' } },
    shin: { quelle: 'fig/basis/unterschenkel', params: { bootH: 2 }, farben: { cloth: 'unter', metal_dark: 'skin_shadow', rubber: 'skin_shadow' } },
    upperArm: { quelle: 'fig/basis/oberarm', farben: { cloth: 'unter' } },
    lowerArm: { quelle: 'fig/basis/unterarm', params: { glove: 0 }, farben: { cloth: 'unter', metal_dark: 'skin_shadow' } },
    head: { ops: { quelle: 'fig/lerche/head', ohneBedingung: true }, palette: 'lerche_rom', farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },

  // ---- Gesicht
  { platz: 'gesicht', name: 'lerche', anzeige: 'Lerche', volk: 'lerche', palette: 'lerche_rom', gattungen: {
    head: { ops: { quelle: 'fig/lerche/head', namen: ['0 Brauen', '0 Ohrring'], paintZuAdd: ['0 Brauen'] }, farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },
  { platz: 'gesicht', name: 'narbe', anzeige: 'Narbe', volk: 'lerche', palette: 'lerche_rom', gattungen: {
    head: { ops: { quelle: 'fig/lerche/head', namen: ['1 Lippen', '1 Brauen', '1 Brauenwulst', '1 Narbe'], paintZuAdd: ['1 Lippen', '1 Brauen', '1 Narbe'] }, farben: {} },
  } },

  // ---- Frisur
  { platz: 'frisur', name: 'dutt', anzeige: 'Dutt', volk: 'lerche', palette: 'lerche_rom', gattungen: {
    head: { ops: { quelle: 'fig/lerche/head', namen: ['0 Haarkranz', '0 Haar oben', '0 Scheitel', '0 Haar hinten', '0 Haar Seiten', '0 Strähne', '0 Haarband', '0 Dutt', '0 Dutt Spitze'] }, farben: { cloth2: 'haarband', trim: 'schmuck' } },
  } },
  { platz: 'frisur', name: 'zoepfe', anzeige: 'Zöpfe', volk: 'germanen', palette: 'nord', gattungen: {
    head: { ops: [
      { quelle: 'fig/basis/kopf', namen: ['Haar oben', 'Haar Stirn', 'Haar Krone', 'Haar hinten', 'Haar Seiten', 'Zopf', 'Zopf-Band'], breit: ['Haar oben', 'Haar Stirn', 'Haar Krone', 'Haar hinten'] },
      { quelle: 'fig/germanen/kopf', namen: ['Zopfringe', 'Schläfenrasur'] },
    ], farben: { primary: 'haarband', metal_light: 'metall_hell' } },
  } },

  // ---- Bart: Deckschicht malt per paint auf die Haut (use mode paint), der Bartzopf ist eine eigene Schicht und hängt am Kinn
  { platz: 'bart', name: 'vollbart', anzeige: 'Vollbart', volk: 'germanen', palette: 'nord', gattungen: {
    head: { schichten: [
      { name: 'deck', modus: 'paint', ops: { quelle: 'fig/basis/kopf', namen: ['Bart', 'Bart Nase frei'], paintZuAdd: ['Bart'], breit: ['Bart'] } },
      { name: 'zopf', ops: { quelle: 'fig/germanen/kopf', namen: ['Bartzopf', 'Bartperle'] } },
    ], farben: { metal_light: 'metall_hell' } },
  } },

  // ---- Kopfbedeckung: Helm ohne eingebauten Kopf als späte Schicht. Maske schneidet das Haar-Gitter (Schale und Haar außerhalb), Ohren werden abgedeckt
  // hut_zier fest: im Bestand ist primary der Spielerakzent des Helms (#56B4E9 = Spielerfarbe S1); die Spielerfigur trägt einen festen Crew-Akzent (Signalrot)
  { platz: 'kopf', name: 'bordhelm', anzeige: 'Bordhelm', volk: 'crew', palette: 'crew', rollen: { hut_zier: '#B3342B' }, gattungen: {
    head: { ops: { quelle: 'fig/crew/helm_offen', ohneNamen: ['Kopf'] },
      farben: { secondary: 'hut', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', primary: 'hut_zier', glow: 'licht' },
      zusatz: {
        maske: { name: 'Haarmaske (schneidet das Haar-Gitter)', ops: [
          { name: 'Schalenvolumen', op: 'box', at: [-3, 26, -4], size: [6, 6, 6], color: SCHABLONE },
          { name: 'Haar hinter der Schale (Dutt)', op: 'box', at: [-3, 26, -8], size: [6, 10, 4], color: SCHABLONE },
          { name: 'Haar über der Schale', op: 'box', at: [-3, 32, -4], size: [6, 4, 6], color: SCHABLONE },
          { name: 'Haar unter der Schale (Zöpfe)', op: 'box', at: [-3, 20, -8], size: [6, 6, 10], color: SCHABLONE },
        ] },
        ohren: { name: 'Ohrschablone (schneidet Ohren und Ohrring, die Schale deckt sie ab)', ops: [
          { name: 'Ohr und Ohrring', op: 'box', at: [3, 26, 0], size: [1, 3, 1], color: SCHABLONE, mirror: 'x', mirrorAt: 0 },
        ] },
      } },
  } },

  // ---- Oberteil
  { platz: 'oberteil', name: 'bordtunika', anzeige: 'Bordtunika', volk: 'crew', palette: 'lerche_rom', gattungen: {
    torso: { quelle: 'fig/lerche/tunic_torso', farben: { cloth2: 'top', trim: 'top_zier' } },
    hips: { quelle: 'fig/lerche/tunic_hips', farben: { cloth2: 'top', leather: 'top_leder', trim: 'top_zier' } },
    upperArm: { quelle: 'fig/lerche/sleeve_upper', decl: { plate: { default: 1, min: 0, max: 1, step: 1, label: 'Schulterplatte (1 links, 0 rechts)' } }, farben: { cloth2: 'top', secondary: 'top_unter', trim: 'top_zier' } },
    lowerArm: { quelle: 'fig/lerche/sleeve_lower', farben: { leather: 'top_leder', secondary: 'top_unter', trim: 'top_zier' } },
  } },
  { platz: 'oberteil', name: 'plankenweste', anzeige: 'Plankenweste', volk: 'germanen', palette: 'nord', gattungen: {
    torso: { quelle: 'fig/germanen/rumpf', farben: { cloth: 'unter', primary: 'top', trim: 'top_zier', leather: 'top_leder', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', glow: 'licht' } },
    hips: { quelle: 'fig/germanen/huefte', farben: { cloth: 'unter', leather: 'top_leder', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', primary: 'top', secondary: 'top_unter' } },
    upperArm: { quelle: 'fig/germanen/oberarm', farben: { leather: 'top_leder', metal_light: 'metall_hell', primary: 'top', trim: 'top_zier' } },
    lowerArm: { quelle: 'fig/germanen/unterarm', params: { glove: 0 }, farben: { leather: 'top_leder', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', primary: 'top' } },
  } },

  // ---- Hose und Schuhe (Unterschenkel per Schnitt getrennt)
  { platz: 'hose', name: 'bordhose', anzeige: 'Bordhose', volk: 'crew', palette: 'lerche_rom', gattungen: {
    thigh: { quelle: 'fig/lerche/leg_upper', params: { style: 0 }, farben: { cloth2: 'hose_zier', secondary: 'hose' } },
    shin: { quelle: 'fig/lerche/leg_lower', params: { style: 0 }, farben: { secondary: 'hose', leather: 'schuh', metal_dark: 'schuh_2', trim: 'schuh_zier' },
      schnitte: [carve('Stiefel abschneiden (y 0..5)', [1, 0, -1], [3, 6, 5])] },
  } },
  { platz: 'hose', name: 'germanenhose', anzeige: 'Germanenhose', volk: 'germanen', palette: 'nord', gattungen: {
    thigh: { quelle: 'fig/germanen/oberschenkel', farben: { leather: 'hose_leder', metal_light: 'metall_hell', primary: 'hose_zier', secondary: 'hose' } },
    shin: { quelle: 'fig/germanen/unterschenkel', farben: { leather: 'hose_leder', primary: 'hose_zier', metal_light: 'metall_hell' },
      schnitte: [carve('Stiefel abschneiden (y 0..2)', [1, 0, -2], [3, 3, 6])] },
  } },
  { platz: 'schuhe', name: 'bordstiefel', anzeige: 'Bordstiefel', volk: 'crew', palette: 'lerche_rom', gattungen: {
    shin: { quelle: 'fig/lerche/leg_lower', params: { style: 0 }, farben: { secondary: 'hose', leather: 'schuh', metal_dark: 'schuh_2', trim: 'schuh_zier' },
      schnitte: [carve('Hosenrest abschneiden (y 6..7)', [1, 6, -1], [3, 2, 3])] },
  } },
  { platz: 'schuhe', name: 'germanenstiefel', anzeige: 'Germanenstiefel', volk: 'germanen', palette: 'nord', gattungen: {
    shin: { quelle: 'fig/germanen/unterschenkel', farben: { metal_dark: 'schuh', metal: 'metall', metal_light: 'metall_hell', rubber: 'gummi' },
      schnitte: [carve('Gamasche und Schienbeinplanken abschneiden (y 3..7)', [1, 3, -2], [3, 5, 6])] },
  } },

  // ---- Hände
  { platz: 'haende', name: 'armschiene', anzeige: 'Armschiene', volk: 'rom', palette: 'rom', gattungen: {
    lowerArm: { quelle: 'fig/rom/armschiene', farben: { cloth: 'unter', metal_dark: 'handschuh', metal: 'metall', secondary: 'handschuh_2', glow: 'licht' } },
  } },

  // ---- Umhang: Fell. Das Bestandsteil färbt Fellflecken mit hair; das Teil nagelt hair auf einen festen Wert (PINNEN).
  // Die Kette zwischen den Spangen hängt im Bestand an der Halsberge des Germanen-Oberteils: zwei Kettenhalter (Boxen) hängen sie an den Kragen.
  { platz: 'umhang', name: 'fellumhang', anzeige: 'Fellumhang', volk: 'germanen', palette: 'nord', gattungen: {
    torso: { quelle: 'fig/germanen/fellumhang', at: [0, 20, -3], farben: { leather: 'umhang', hair: 'umhang_2', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell' },
      danach: [{ name: 'Kettenhalter (Kette am Kragen)', op: 'box', at: [3, 24, 3], size: [1, 1, 1], color: '@metal', mirror: 'x', mirrorAt: 0 }] },
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

/** Herausgelöste Ops: eine Auswahl aus einem Bestandsteil (siehe TEILE, ops). */
const waehle = (id, o) => {
  const src = bestand(o.quelle);
  const finde = (n) => { const x = src.ops.find((y) => y.name === n); if (!x) throw new Error(`${id}: Op "${n}" fehlt in ${o.quelle}`); return x; };
  for (const n of [...(o.paintZuAdd || []), ...(o.breit || []), ...(o.ohneNamen || [])]) finde(n);
  const sel = o.ohneBedingung ? src.ops.filter((x) => x.if === undefined)
    : o.ohneNamen ? src.ops.filter((x) => !o.ohneNamen.includes(x.name))
    : o.namen.map(finde);
  return sel.map((x) => {
    let c = stripIf(clean(x));
    if ((o.paintZuAdd || []).includes(x.name)) c = paintToAdd(c);
    if ((o.breit || []).includes(x.name)) {
      if (c.at[0] !== -2 || c.size[0] !== 4) throw new Error(`${id}: Op "${x.name}" ist nicht 4 breit bei x -2 (at ${c.at}, size ${c.size})`);
      c.at = [-3, c.at[1], c.at[2]]; c.size = [6, c.size[1], c.size[2]];
    }
    return c;
  });
};
const waehleAlle = (id, o) => [].concat(o).flatMap((x) => waehle(id, x));
const quellenText = (o) => [...new Set([].concat(o).map((x) => x.quelle))].join(', ');

for (const t of TEILE) {
  const platz = PLAETZE.find((p) => p.id === t.platz);
  if (!platz) throw new Error(`Teil ${t.platz}/${t.name}: unbekannter Platz`);
  if (!t.anzeige) throw new Error(`Teil ${t.platz}/${t.name}: anzeige fehlt (Name im Katalog)`);
  /** Platzrolle eines Teils: je Teil eigener Name, damit jedes Teil seine Bestandsfarben behält. Figurrollen bleiben unverändert. */
  const R = (z) => (FIGURFARBEN.includes(z) ? z : `${z}_${t.name}`);
  for (const [ziel, w] of Object.entries(t.rollen || {})) rolle(R(ziel), w, `${t.platz}/${t.name} (fest)`);
  for (const [gattung, g] of Object.entries(t.gattungen)) {
    if (!GELENKE[gattung]) throw new Error(`Teil ${t.platz}/${t.name}: unbekannte Gattung ${gattung}`);
    const id = `cha/${t.platz}/${t.name}/${gattung}`;
    for (const k of Object.keys(g.farben || {})) if (FIGURFARBEN.includes(k) && !(PINNEN[t.platz] || []).includes(k)) throw new Error(`${id}: Rolle ${k} gehört der Figur (colors), darf am use nicht umgelegt werden`);
    // Standardfarben der Platzrollen aus der Bestandspalette (nicht für Rollen, die ein Teil fest vorgibt oder die Figur setzt)
    const palId = g.palette || t.palette;
    const farben = {};
    for (const [von, ziel] of Object.entries(g.farben || {})) {
      farben[von] = R(ziel);
      if (FIGURFARBEN.includes(ziel) || (t.rollen && ziel in t.rollen)) continue;
      rolle(R(ziel), { palette: palId, role: von }, `${id} (${von})`);
    }
    const params = g.params, decl = g.decl;
    const layer = { name: `${platz.id} ${t.name} (${gattung})`, tags: ['cha', 'schicht', platz.id], ...(decl ? { params: decl } : {}) };
    const danach = (g.danach || []).map((o) => {
      const c = clean(o);
      if (typeof c.color === 'string' && c.color.startsWith('@')) { c.color = farben[c.color.slice(1)]; if (!c.color) throw new Error(`${id}: danach "${o.name}": Rolle ${o.color} ist nicht in farben`); }
      return c;
    });
    if (g.quelle) {
      const pass = decl ? Object.fromEntries(Object.keys(decl).map((k) => [k, k])) : undefined;
      const p = { ...(params || {}), ...(pass || {}) };
      putModel(id, { ...layer, notes: `Schicht aus ${g.quelle}, Bestandsteil unverändert per use.`, ops: [useOp(g.quelle, { ...(g.at ? { at: g.at } : {}), ...(Object.keys(p).length ? { params: p } : {}), colors: farben }), ...clean(g.schnitte || []), ...danach] });
    } else if (g.schichten) {
      // mehrere herausgelöste Teilmodelle, der Wrapper setzt sie der Reihe nach ein (modus z. B. paint)
      const uses = [];
      for (const s of g.schichten) {
        putModel(`${id}_${s.name}`, { name: `${layer.name}: herausgelöste Ops (${s.name})`, tags: ['cha', 'ops'], notes: `Ops aus ${quellenText(s.ops)}, Reihenfolge wie im Bestand.`, ops: waehleAlle(id, s.ops) });
        uses.push(useOp(`${id}_${s.name}`, { ...(s.modus ? { mode: s.modus } : {}), colors: farben }));
      }
      putModel(id, { ...layer, notes: `Schicht aus ${quellenText(g.schichten.map((s) => s.ops).flat())}, herausgelöst.`, ops: uses });
    } else {
      // Ops herauslösen: eigenes Modell mit den kopierten Ops, Wrapper legt die Rollen um
      const o = g.ops;
      const ops = waehleAlle(id, o);
      const bedingungslos = [].concat(o).some((x) => x.ohneBedingung);
      putModel(id + '_ops', { name: `${layer.name}: herausgelöste Ops`, tags: ['cha', 'ops'], notes: `Ops aus ${quellenText(o)}${bedingungslos ? ' (ohne Bedingung)' : ''}, Reihenfolge wie im Bestand.`, ops });
      putModel(id, { ...layer, notes: `Schicht aus ${quellenText(o)}, herausgelöst.`, ops: [useOp(id + '_ops', { colors: farben })] });
    }
    for (const [key, z] of Object.entries(g.zusatz || {})) putModel(`${id}_${key}`, { name: z.name, tags: ['cha', key], notes: `Zusatzmodell zu ${id}, schneidet per use mode carve.`, ops: clean(z.ops) });
  }
}

// Sammelmodelle je Gattung -------------------------------------------------------------------
const hatTeil = (platz, gattung) => TEILE.some((t) => t.platz === platz && t.gattungen[gattung]);
/** Erlaubte Werte eines Platzes: Standard zuerst, dann die übrigen Teile in der Reihenfolge von TEILE, zuletzt der leere Wert. */
const werte = (p) => [...new Set([p.standard, ...TEILE.filter((t) => t.platz === p.id).map((t) => t.name), ...(p.keine ? [p.keine] : [])])];
const platzOf = (id) => PLAETZE.find((p) => p.id === id);
/** Parameter-Deklarationen der Teile-Schichten, die das Sammelmodell durchreichen muss. */
const declOf = (platz, gattung) => Object.assign({}, ...TEILE.filter((t) => t.platz === platz && t.gattungen[gattung]?.decl).map((t) => t.gattungen[gattung].decl));

for (const gattung of Object.keys(GELENKE)) {
  const folge = gattung === 'head' ? FOLGE.head : FOLGE.koerper_gelenk;
  const slots = folge.filter((p) => hatTeil(p, gattung));
  if (gattung === 'head') slots.splice(0, slots.length, ...FOLGE.head);   // Kopf: alle Kopfplätze
  const params = {}, ops = [];
  for (const s of slots) { const p = platzOf(s); params[s] = { default: p.standard, options: werte(p), label: SCHICHT_NAME[s] }; }
  for (const s of slots) Object.assign(params, declOf(s, gattung));
  const pass = (s) => { const d = declOf(s, gattung); return Object.keys(d).length ? { params: Object.fromEntries(Object.keys(d).map((k) => [k, k])) } : {}; };
  if (gattung !== 'head') {
    for (const s of slots) ops.push(leerOp(SCHICHT_NAME[s], `cha/${s}/{${s}}/${gattung}`, pass(s)));
  } else {
    // Frisur als eigene Schicht in eigenem Gitter; die Hutmaske (cha/kopf/<name>/head_maske) schneidet nur dieses Gitter
    putModel('cha/frisur_maskiert/head', { name: 'Frisur unter der Kopfbedeckung (Maske schneidet nur das Haar-Gitter)', tags: ['cha', 'schicht'],
      params: { frisur: { default: 'dutt', options: werte(platzOf('frisur')) }, kopf: { default: 'keine', options: werte(platzOf('kopf')) } },
      ops: [leerOp('Frisur', 'cha/frisur/{frisur}/head'), { name: 'Haarmaske (carve)', ...useOp('cha/kopf/{kopf}/head_maske', { fallback: ['cha/leer'], mode: 'carve' }) }] });
    for (const s of ['koerper', 'bart', 'gesicht']) ops.push(leerOp(SCHICHT_NAME[s], `cha/${s}/{${s}}/head`));
    ops.push({ name: 'Frisur (unter Hutmaske)', ...useOp('cha/frisur_maskiert/head', { params: { frisur: '{frisur}', kopf: '{kopf}' } }) });
    ops.push(leerOp('Ohren unter der Kopfbedeckung (carve)', 'cha/kopf/{kopf}/head_ohren', { mode: 'carve' }));
    ops.push(leerOp(SCHICHT_NAME.kopf, 'cha/kopf/{kopf}/head'));
  }
  putModel(`cha/joint/${gattung}`, { name: `Sammelmodell ${gattung} (Schichten)`, tags: ['cha', 'joint'], notes: 'Schichtfolge = Reihenfolge der use-Schritte.', params, ops });
}

// Palette -----------------------------------------------------------------------------------
const roles = {};
for (const [ziel, { wert }] of [...rolesBySource.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) roles[ziel] = wert;
Object.assign(roles, FESTE_ROLLEN);
put('assets/palettes/cha.json', { id: 'cha', name: 'Spielerfigur (Platzrollen)', extends: 'base', generated: true,
  notes: 'Platzrollen der Schichten (cha/), je Teil eigene Rollen (<name>_<teil>) mit den Bestandsfarben des Teils. skin, skin_shadow, hair kommen ausschließlich von der Figur (colors); Ausnahme siehe PINNEN in tools/cha-lib.mjs. Keine Spielerfarbe in Kleidungsrollen.', roles });

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

// Katalog -----------------------------------------------------------------------------------
// Der Körper steht oben unter "koerper" (die Karte führt ihn als eigenes Feld), plaetze/teile gelten für Charakter und Outfit.
const katalogPlaetze = PLAETZE.filter((p) => p.id !== 'koerper');
put('assets/katalog/charakter.json', {
  version: 1,
  figur: 'cha/spieler',
  koerper: werte(platzOf('koerper')).map((n) => ({ id: n, name: TEILE.find((t) => t.platz === 'koerper' && t.name === n).anzeige })),
  plaetze: katalogPlaetze.map((p) => ({ id: p.id, name: p.name, gruppe: p.gruppe, standard: p.standard })),
  teile: katalogPlaetze.flatMap((p) => werte(p).map((n) => {
    const t = TEILE.find((x) => x.platz === p.id && x.name === n);
    if (!t && n !== p.keine) throw new Error(`Katalog: ${p.id}/${n} ist weder Teil noch leerer Wert`);
    return { id: `${p.id}/${n}`, platz: p.id, name: t ? t.anzeige : p.keineName, gruppe: p.gruppe, ...(p.gruppe === 'outfit' ? { herkunft: 'frei' } : {}), ...(t?.volk ? { volk: t.volk } : {}) };
  })),
  farben: { haut: HAUT, haar: HAAR },
});

// =============================================================================================
// SCHREIBEN / PRÜFEN
// =============================================================================================
const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const rel = (f) => path.relative(root, f).replace(/\\/g, '/');
const einzeln = ['assets/palettes/cha.json', 'assets/katalog/charakter.json'].filter((f) => fs.existsSync(path.join(root, f)));
const vorhanden = new Set([...walk(A('models', 'cha')), ...walk(A('figures', 'cha'))].map(rel).concat(einzeln));

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
