// Spielerfigur aus Schichten (cha/): Platz → Teile → Schicht-Modelle je Gelenk-Gattung → Sammelmodelle → Figur.
// Liest die Bestandsteile (assets/models/fig/**, unverändert) und schreibt
//   assets/models/cha/**          Schicht-Wrapper (use + colors + carve/paint), Sammelmodelle cha/joint/<gattung>
//   assets/palettes/cha.json      Platzrollen (Standardfarben aus den Bestandspaletten, je Teil eigene Rollen)
//   assets/figures/cha/spieler.json
//   assets/katalog/charakter.json Katalog (Version 2) für das Spiel (Plätze, Teile, Hauttöne, Haarfarben; je Teil das Feld vorschau = Pfad des Kachelbilds,
//                                 die Bilder selbst erzeugt tools/gen-cha-vorschau.mjs)
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
/** Schichtfolge je Gattung = Reihenfolge der use-Schritte (unten liegt zuerst). Am Kopf liegt das feste Gesicht im Körper-Kopf (Katalog 2: kein Platz gesicht, kein Platz bart). */
const FOLGE = {
  koerper_gelenk: ['koerper', 'hose', 'schuhe', 'oberteil', 'haende', 'umhang'],
  head: ['koerper', 'frisur', 'kopf'],
};
const SCHICHT_NAME = { koerper: 'Körper', hose: 'Hose', schuhe: 'Schuhe', oberteil: 'Oberteil', haende: 'Handschuhe', umhang: 'Umhang', frisur: 'Frisur', kopf: 'Kopfbedeckung' };

/**
 * Plätze in fester Reihenfolge (Schnittstelle Voxelwerk ↔ Spiel).
 * `keine` = Name des leeren Werts (ohne Datei, Fallback cha/leer), `keineName` = Anzeigename dazu. Ohne `keine` ist der Platz Pflicht.
 */
const PLAETZE = [
  { id: 'koerper', name: 'Körper', gruppe: 'koerper', standard: 'standard' },
  { id: 'frisur', name: 'Frisur', gruppe: 'charakter', standard: 'kurz', keine: 'keine', keineName: 'Kahl' },
  { id: 'kopf', name: 'Kopfbedeckung', gruppe: 'outfit', standard: 'keine', keine: 'keine', keineName: 'Keine' },
  { id: 'oberteil', name: 'Oberteil', gruppe: 'outfit', standard: 'bordtunika', keine: 'keine', keineName: 'Unterzeug' },
  { id: 'hose', name: 'Hose', gruppe: 'outfit', standard: 'bordhose', keine: 'keine', keineName: 'Unterzeug' },
  { id: 'schuhe', name: 'Schuhe', gruppe: 'outfit', standard: 'bordstiefel', keine: 'keine', keineName: 'Barfuß' },
  { id: 'haende', name: 'Hände', gruppe: 'outfit', standard: 'keine', keine: 'keine', keineName: 'Keine' },
  { id: 'umhang', name: 'Umhang', gruppe: 'outfit', standard: 'keiner', keine: 'keiner', keineName: 'Keiner' },
];

/** Hautton (Paar skin + skin_shadow, Schatten 0,8 der Hauptfarbe) und Haarfarbe. Index 0 = Standardfarben der Figur. Katalog 2: 6 Hauttöne, 8 Haarfarben. */
const HAUT = [
  { skin: '#C68E68', skin_shadow: '#A06E4E' },   // 0 mittel (Standard, Schatten wie im Bestand lerche/crew_0)
  { skin: '#F7E0CC', skin_shadow: '#C6B3A3' },   // 1 sehr hell
  { skin: '#E8BE98', skin_shadow: '#BA987A' },   // 2 hell
  { skin: '#9A6A48', skin_shadow: '#7B553A' },   // 3 braun
  { skin: '#6B4430', skin_shadow: '#563626' },   // 4 dunkel
  { skin: '#3E281D', skin_shadow: '#322017' },   // 5 sehr dunkel
];
const HAAR = [
  '#3B2416',   // 0 braun (Standard)
  '#17130F',   // 1 schwarz
  '#E0BF6A',   // 2 blond
  '#A8431E',   // 3 rot
  '#5C3A22',   // 4 kastanie
  '#A9A8A3',   // 5 silbergrau
  '#EEE6CF',   // 6 weiß
  '#8C7A58',   // 7 aschblond
];

/** Gelenk- und Hautfarben liegen bei der Figur (colors), nie in einem Teil. */
const FIGURFARBEN = ['skin', 'skin_shadow', 'hair'];
const FIGUR_STANDARD_COLORS = { ...HAUT[0], hair: HAAR[0] };

// Hilfen für die Daten
const carve = (name, at, size) => ({ name, op: 'box', at, size, mode: 'carve' });
const SCHABLONE = '#808080';   // Farbe von Schablonenboxen (nur ihre Form zählt, sie schneiden per carve)
const box = (name, at, size, color, o = {}) => ({ name, op: 'box', at, size, ...(color !== undefined ? { color } : {}), ...o });
const spiegel = { mirror: 'x', mirrorAt: 0 };

/**
 * Der 8er-Kopf (Richtung A aus FIG-01, assets/models/entwurf/fig01/a/kopf auf Branch fig01): Schädel 8×7×8 (x -4..3, y 26..32, z -4..3), Hals y 25 (4×4),
 * festes Gesicht bei z = 3 (Augen 1×2, Mund, Wangen). Haut aus skin/skin_shadow (Figur), Augen fest. Glatte Flächen (jitter false) sparen Dreiecke (FIG-01).
 */
const KOPF_8 = [
  box('Hals', [-2, 25, -2], [4, 1, 4], 'skin_shadow', { jitter: false }),
  box('Schädel', [-4, 26, -4], [8, 7, 8], 'skin', { jitter: false }),
  box('Kinnkanten', [3, 26, 3], [1, 1, 1], undefined, { mode: 'carve', ...spiegel }),
  box('Augen', [1, 28, 3], [1, 2, 1], '#1A120E', { mode: 'paint', jitter: false, ...spiegel }),
  box('Mund', [-1, 26, 3], [2, 1, 1], { shade: 'skin', f: 0.86 }, { mode: 'paint', jitter: false }),
  box('Wangen', [2, 27, 3], [1, 1, 1], { shade: 'skin', f: 0.93 }, { mode: 'paint', jitter: false, ...spiegel }),
];
// ---- CHA-02 B1: Römische Frisuren (Anfang) ----------------------------------------------------------------------------------------------------------
// Nach FIG-01 frisuren-ideen.png, obere Reihe. Haar sitzt auf der Schädelhülle (x -4..3, y 26..32, z -4..3), das Gesicht (z 3, y <= 30) bleibt frei, Haar steht bis 1 Voxel
// über der Hülle (y 33/34, x -5/4, z -5). Haarrolle = `hair` (Figur, 8 Farben); Stirnband und Ohrring haben je Teil eine feste eigene Farbrolle (kein Haar).
// Keine Kopplung an einen Körper: jede Frisur ist für jede Figur wählbar.
const eck = (name, at) => box(name, at, [1, 1, 1], undefined, { mode: 'carve', ...spiegel });   // Ecke des Haars abrunden (Spiegelpaar)
/** Kurzschnitt (Caesar-Pony): Stirnfransen als Stufe nach vorn, die hintere Kappenhälfte (z -4..-1) eine Lage höher; kein Scheitel. Oberseite von oben: drei Stufen (y 32 vorn, 33 Mitte, 34 hinten). */
const FRISUR_KURZ = [
  box('Haarkranz', [-4, 31, -4], [8, 2, 8], { shade: 'hair', f: 1.04 }, { jitter: false }),
  box('Haar oben', [-4, 33, -4], [8, 1, 7], { shade: 'hair', f: 1.12 }, { jitter: false }),
  box('Haar oben hinten (eine Lage höher)', [-4, 34, -4], [8, 1, 4], { shade: 'hair', f: 1.18 }, { jitter: false }),
  eck('Ecken hinten', [3, 33, -4]), eck('Ecken hinten oben', [3, 34, -4]), eck('Ecken vorn', [3, 33, 2]),
  box('Pony Strähne', [-4, 30, 3], [3, 1, 1], { shade: 'hair', f: 0.94 }),
  box('Haar Seiten', [3, 29, -4], [1, 2, 6], 'hair', { jitter: false, ...spiegel }),
  box('Haar Seiten unten', [3, 28, -4], [1, 1, 4], { shade: 'hair', f: 0.9 }, { jitter: false, ...spiegel }),
  box('Haar hinten', [-4, 28, -4], [8, 3, 1], { shade: 'hair', f: 0.9 }, { jitter: false }),
];
/** Stirnband mit Zopf: kurzes Haar über einem goldenen Stirnband (rings um den Kopf, y 31), Seiten und Nacken darunter bis y 27. Der Zopf links (x -5) kommt vom Ohr nach vorn (z 3) und hängt vor der Schulter bis y 23. */
const FRISUR_STIRNBAND = [
  box('Haar oben', [-4, 32, -4], [8, 1, 8], { shade: 'hair', f: 1.1 }, { jitter: false }),
  box('Haarkappe', [-4, 33, -4], [8, 1, 7], { shade: 'hair', f: 1.12 }, { jitter: false }),
  eck('Ecken hinten', [3, 33, -4]), eck('Ecken vorn', [3, 33, 2]),
  box('Scheitel', [0, 33, -4], [1, 1, 7], { shade: 'hair', f: 0.82 }, { mode: 'paint', jitter: false }),
  box('Haar Seiten', [3, 27, -4], [1, 4, 6], 'hair', { jitter: false, ...spiegel }),
  box('Haar hinten', [-4, 27, -4], [8, 4, 1], { shade: 'hair', f: 0.9 }, { jitter: false }),
  box('Stirnband vorn', [-4, 31, 3], [8, 1, 1], 'trim', { jitter: false }),
  box('Stirnband hinten', [-4, 31, -4], [8, 1, 1], 'trim', { jitter: false }),
  box('Stirnband Seiten', [3, 31, -3], [1, 1, 6], 'trim', { jitter: false, ...spiegel }),
  box('Zopfansatz', [-5, 29, 1], [1, 1, 3], 'hair', { jitter: false }),   // vom Seitenhaar (x -4, z bis 1) nach vorn bis z 3
  box('Zopf', [-5, 24, 3], [1, 5, 1], { stripes: [{ shade: 'hair', f: 1.15 }, { shade: 'hair', f: 0.7 }], axis: 'y', period: 2 }),
  box('Zopfband', [-5, 23, 3], [1, 1, 1], 'trim', { jitter: false }),
];
/** Welle: mittellang, Seitenwellen als S-Linie (oben x 4, Mitte x 3, unten x 4, in z gegeneinander versetzt), die Strähnen sind zu einer Tolle vorn gebündelt (y 34) mit Überhang über der Stirn. */
const FRISUR_WELLE = [
  box('Haarkranz', [-4, 31, -4], [8, 2, 8], { noise: ['hair', { shade: 'hair', f: 1.12 }], weights: [4, 1], cell: 2 }, { jitter: false }),
  box('Haar oben', [-4, 33, -4], [8, 1, 7], { noise: [{ shade: 'hair', f: 1.1 }, { shade: 'hair', f: 0.88 }], weights: [3, 1], cell: 2 }, { jitter: false }),
  eck('Ecken hinten', [3, 33, -4]), eck('Ecken vorn', [3, 33, 2]),
  box('Tolle', [-2, 34, 0], [3, 1, 3], { shade: 'hair', f: 1.16 }, { jitter: false }),
  box('Tolle Überhang', [-2, 33, 3], [3, 1, 2], { shade: 'hair', f: 1.1 }, { jitter: false }),   // z 3..4 über der Stirn (y 33, über dem Gesicht)
  box('Pony Strähne', [-4, 30, 3], [2, 1, 1], 'hair'),
  box('Pony Strähne rechts', [2, 30, 3], [2, 1, 1], 'hair'),
  box('Haar Seiten', [3, 27, -4], [1, 4, 6], 'hair', spiegel),
  box('Welle Seite oben', [4, 29, -3], [1, 3, 4], { shade: 'hair', f: 0.92 }, spiegel),   // S-Linie: oben x 4 (z -3..0) ...
  box('Welle Seite unten', [4, 25, -1], [1, 2, 4], 'hair', spiegel),   // ... Mitte x 3 ... unten wieder x 4 (z -1..2)
  box('Haar hinten', [-4, 26, -4], [8, 5, 1], 'hair'),
  box('Welle hinten oben', [-4, 28, -5], [8, 3, 1], { shade: 'hair', f: 0.9 }),
  box('Welle hinten unten', [-3, 26, -5], [6, 2, 1], 'hair'),
];
/**
 * Offenes Haar: lang bis auf die Schultern, Scheitel seitlich (x -2), die linke Seite eine Lage höher (y 34). Rechts (x+) liegt das Haar hinter dem Ohr (z -4..-2, endet bei y 28) und der blaue Ohrring ragt heraus;
 * links fällt es nach vorn über die Schulter (x -5, bis z 2, y 23). Die Rückenplatte verjüngt sich V-förmig (10 breit y 28..31, 8 breit y 25..27, 6 breit y 24), die Strähnenenden enden bei y 24/25/26 abwechselnd.
 */
const FRISUR_OFFEN = [
  box('Haarkranz', [-4, 31, -4], [8, 2, 8], { shade: 'hair', f: 1.04 }, { jitter: false }),
  box('Haar oben', [-1, 33, -4], [5, 1, 7], { shade: 'hair', f: 1.12 }, { jitter: false }),
  box('Haar oben links höher', [-4, 33, -4], [3, 2, 7], { shade: 'hair', f: 1.16 }, { jitter: false }),
  eck('Ecken hinten', [3, 33, -4]), eck('Ecken vorn', [3, 33, 2]), eck('Ecken links hinten oben', [-4, 34, -4]), eck('Ecken links vorn oben', [-4, 34, 2]),
  box('Scheitel', [-2, 34, -4], [1, 1, 7], { shade: 'hair', f: 0.78 }, { mode: 'paint', jitter: false }),
  box('Pony Seite', [-4, 30, 3], [2, 1, 1], 'hair', spiegel),
  box('Haar rechts hinter dem Ohr', [3, 28, -4], [1, 3, 3], 'hair', { jitter: false }),
  box('Haar rechts hinter dem Ohr außen', [4, 28, -4], [1, 4, 3], { shade: 'hair', f: 0.9 }, { jitter: false }),
  box('Haar links', [-4, 26, -4], [1, 5, 7], 'hair', { jitter: false }),
  box('Haar links über der Schulter', [-5, 24, -4], [1, 7, 6], { shade: 'hair', f: 0.9 }, { jitter: false }),
  box('Strähne links 1', [-5, 23, -3], [1, 1, 2], { shade: 'hair', f: 0.82 }, { jitter: false }),
  box('Haar hinten', [-4, 26, -4], [8, 5, 1], { shade: 'hair', f: 0.92 }, { jitter: false }),
  box('Rücken oben', [-5, 28, -5], [10, 4, 1], { stripes: ['hair', { shade: 'hair', f: 0.82 }], axis: 'x', period: 2 }),
  box('Rücken Mitte', [-4, 25, -5], [8, 3, 1], { stripes: ['hair', { shade: 'hair', f: 0.82 }], axis: 'x', period: 2 }),
  box('Rücken unten', [-3, 24, -5], [6, 1, 1], { shade: 'hair', f: 0.82 }),
  ...[[-3, 24], [0, 24], [2, 24], [-4, 25], [3, 25]].map(([x, y], i) => carve(`Strähnenende ${i + 1}`, [x, y, -5], [1, 1, 1])),
  box('Ohrring', [4, 25, 1], [1, 2, 1], 'primary', { jitter: false }),
];
// ---- CHA-02 B1 (Ende) --------------------------------------------------------------------------------------------------------------------------------

// ---- B2: vier germanische Frisuren mit Bart (CHA-02 B). Haar und Bart tragen die Rolle hair (die Haarfarbe färbt beides); Gold und Schmuck sind feste Teilrollen.
// Maße: Schädel x -4..3, y 26..32, z -4..3, Gesicht bei z 3 (Augen y 28-29 bei x 1 und -2, Mund y 26 bei x -1..0, Wangen y 27): Bart lässt Augen und Mund frei.
const STREIFEN_ZOPF = { stripes: [{ shade: 'hair', f: 1.15 }, { shade: 'hair', f: 0.7 }], axis: 'y', period: 2 };
const schatten = (f) => ({ shade: 'hair', f });
/** Kurzhaar mit kurzem Bart: kurze Kappe (6×6, y 33) mit abgesetztem dunklem Stoppelrand (y 32, f 0,8); der Bart ist flach (nur z 3, dunkler Ton) und lässt den Mund (x -1..0, y 26) frei. */
const BART_KURZ = [
  box('Haarkranz', [-4, 31, -4], [8, 1, 7], 'hair'),
  box('Stoppelrand', [-4, 32, -4], [8, 1, 8], schatten(0.8)),
  box('Kappe', [-3, 33, -3], [6, 1, 6], schatten(1.14)),
  box('Haar hinten', [-4, 28, -4], [8, 3, 1], 'hair'),
  box('Haar Seiten', [3, 29, -3], [1, 2, 3], 'hair', spiegel),
  box('Strähne', [-4, 30, 3], [2, 1, 1], 'hair'),
  box('Koteletten', [3, 26, -1], [1, 3, 4], 'hair', spiegel),
  box('Stoppeln Wange', [1, 26, 3], [2, 2, 1], schatten(0.8), spiegel),
  box('Oberlippe', [-1, 27, 3], [2, 1, 1], schatten(0.8)),
  box('Kinn', [-3, 25, 3], [6, 1, 1], schatten(0.8)),
];
/**
 * Langhaar mit Vollbart: Suebenknoten hinten oben (3×2×2 bei [1,33,-3], Band in Rolle trim), Streifen nach hinten gekämmt; der Bart ist voll und steht vor (z 3..4, Kieferbreite von Haar zu Haar, Rahmen ums Gesicht bis x 4/-5),
 * Schnurrbart über dem Mund, Gabelbart am Kinn (y 24, Spalt bei x -1..0). Tiefer als y 24 und weiter als z 4 geht es wegen Passprobe und Bereichstoleranz nicht (Unterschied zum kurzen Bart über Tiefe und Breite).
 */
const BART_LANG = [
  box('Haarkranz', [-4, 31, -4], [8, 1, 7], 'hair'),
  box('Haar oben (nach hinten gekämmt)', [-4, 32, -4], [8, 1, 8], { stripes: [schatten(1.14), schatten(0.9)], axis: 'x', period: 2 }, { jitter: false }),
  box('Knoten', [1, 33, -3], [3, 2, 2], schatten(1.15), { jitter: false }),
  box('Knotenband', [1, 33, -3], [3, 1, 2], 'trim', { mode: 'paint', jitter: false }),
  box('Haar hinten', [-4, 26, -4], [8, 5, 1], 'hair'),
  box('Haar hinten lang', [-4, 24, -6], [8, 7, 2], 'hair'),   // z -6..-5 hinter dem Fellumhang-Ansatz (z -4); tiefer als y 24 stößt es in der Pose crouch in den Fellumhang
  box('Haar Seiten', [3, 26, -4], [1, 5, 6], 'hair', spiegel),
  box('Bart Rahmen', [3, 25, 2], [1, 4, 3], 'hair', spiegel),   // Kieferbreite, schließt an das Haar der Seiten an (x 3 und -4, z 2..4)
  box('Bart Rahmen außen', [4, 26, 1], [1, 3, 3], schatten(0.9), spiegel),   // über die Kopfbreite hinaus (x 4 und -5): Rahmen ums Gesicht
  box('Bart Wange', [1, 26, 3], [2, 2, 1], 'hair', spiegel),
  box('Bart Wange vorn', [1, 26, 4], [2, 2, 1], schatten(0.9), spiegel),
  box('Schnurrbart', [-1, 27, 3], [2, 1, 2], schatten(0.9)),
  box('Kinn', [-3, 25, 3], [6, 1, 2], schatten(0.92)),
  box('Bart unten', [-3, 24, 4], [6, 1, 1], schatten(0.86)),   // y 24 nur bei z 4: bei z 3 läge er im Oberteil, tiefer stößt er in der Pose aim an den Unterarm
  carve('Gabelbart', [-1, 24, 4], [2, 1, 1]),
];
/** Zöpfe aus der Kopfbreite heraus auf x 4 und -5 (z 2..3) bis y 22, kräftige Streifen; dahinter langes Seiten- und Rückenhaar bis y 24. Von vorn sichtbar neben dem Gesicht. Scheitelwulst (x -1..0) statt flacher Kappe. */
const ZOPF_BAND = [
  box('Haarkranz', [-4, 31, -4], [8, 1, 7], 'hair'),
  box('Haar oben', [-4, 32, -4], [8, 1, 8], schatten(1.12)),
  box('Scheitelwulst', [-1, 33, -4], [2, 1, 7], schatten(1.2)),
  box('Scheitel', [0, 33, -4], [1, 1, 7], schatten(0.75), { mode: 'paint' }),
  box('Haar hinten', [-4, 26, -4], [8, 5, 1], 'hair'),
  box('Haar hinten lang', [-4, 24, -5], [8, 7, 1], schatten(0.92)),
  box('Haar Seiten', [3, 25, -4], [1, 6, 8], 'hair', spiegel),   // x 3 und -4, y 25..30, z -4..3: trägt die Zöpfe
  box('Stirnband vorn', [-4, 30, 3], [8, 1, 1], 'trim', { jitter: false }),
  box('Stirnband hinten', [-4, 30, -4], [8, 1, 1], 'trim', { jitter: false }),
  box('Stirnband Seiten', [3, 30, -3], [1, 1, 6], 'trim', { jitter: false, ...spiegel }),
  box('Zopf', [4, 25, 3], [1, 5, 1], STREIFEN_ZOPF, spiegel),
  box('Zopf Ansatz', [4, 27, 2], [1, 3, 1], STREIFEN_ZOPF, spiegel),
  box('Zopfband', [4, 24, 3], [1, 1, 1], 'trim', { jitter: false, ...spiegel }),
];
/**
 * Wildes Haar: Umriss statt Oberseite. Keine Einzelzacken oben: drei 2×1×2-Buckel im Inneren, oberste Ecken rund; Locken an Seiten (x 4/-5) und Rücken (z -6) als 2×2-Klumpen im Schachbrett vor/zurück versetzt,
 * unregelmäßiger Saum (y 23/24/25), Seitensträhne mit Perle vor dem Ohr (x 4, z 2, Perle y 25: y 24 stößt in der Ruhepose an den Fellumhang). Farbe: Rauschen in Blöcken von 2.
 */
const WILD_FARBE = { noise: ['hair', schatten(0.8)], weights: [5, 2], cell: 2 };
const WILD_SEITE = [[30, -4], [28, -2], [26, 0]];   // Seitenklumpen (y unten, z links), je 2 hoch und 2 tief, Schachbrett
const WILD_RUECKEN = [[-4, 30], [0, 30], [-2, 28], [2, 28], [-2, 24], [2, 24]];   // Rückenklumpen (x links, y unten), je 2 × 2
const WILD = [
  box('Haarkranz', [-4, 31, -4], [8, 1, 7], WILD_FARBE, { jitter: false }),
  box('Haar oben', [-4, 32, -4], [8, 1, 8], WILD_FARBE, { jitter: false }),
  box('Haar Dach', [-4, 33, -4], [8, 1, 7], WILD_FARBE, { jitter: false }),
  eck('Ecken oben hinten', [3, 33, -4]), eck('Ecken oben vorn', [3, 33, 2]),
  box('Buckel 1', [-2, 34, -3], [2, 1, 2], WILD_FARBE, { jitter: false }),
  box('Buckel 2', [0, 34, -1], [2, 1, 2], WILD_FARBE, { jitter: false }),
  box('Haar hinten', [-4, 26, -4], [8, 5, 1], WILD_FARBE, { jitter: false }),
  box('Haar hinten Platte', [-4, 25, -5], [8, 6, 1], WILD_FARBE, { jitter: false }),
  box('Haar Seiten', [3, 26, -4], [1, 6, 7], WILD_FARBE, { jitter: false, ...spiegel }),
  ...WILD_SEITE.map(([y, z], i) => box(`Locke Seite ${i + 1}`, [4, y, z], [1, 2, 2], WILD_FARBE, { jitter: false, ...spiegel })),
  ...WILD_RUECKEN.map(([x, y], i) => box(`Locke Rücken ${i + 1}`, [x, y, -6], [2, 2, 1], WILD_FARBE, { jitter: false })),
  box('Saum 23 a', [-2, 23, -6], [2, 1, 1], WILD_FARBE, { jitter: false }),
  box('Saum 23 b', [2, 23, -6], [2, 1, 1], WILD_FARBE, { jitter: false }),
  box('Seitensträhne', [4, 25, 2], [1, 3, 1], WILD_FARBE, { jitter: false }),
  box('Locke Stirn links', [-4, 30, 3], [2, 1, 1], 'hair'),
  box('Locke Stirn rechts', [2, 30, 3], [2, 1, 1], 'hair'),
  box('Perle', [4, 25, 2], [1, 1, 1], 'cloth', { jitter: false }),
];
/** Bordhelm (aus fig/crew/helm_offen), auf den 8er-Kopf verbreitert: Schale über Hinterkopf und Seiten, Gesichtsrahmen bei z 3. */
const HELM_BORD = [
  box('Halsring', [-2, 25, -2], [4, 1, 4], 'metal'),
  box('Helmschale', [-4, 26, -4], [8, 6, 7], 'secondary', { mode: 'under' }),
  box('Helmdach', [-4, 32, -4], [8, 1, 8], 'secondary'),
  box('Gesichtsrahmen oben', [-4, 31, 3], [8, 1, 1], 'metal_light'),
  box('Gesichtsrahmen Seiten', [3, 26, 3], [1, 5, 1], 'metal_light', spiegel),
  box('Akzentstreifen', [-1, 32, -4], [2, 1, 8], 'primary'),
  box('Akzent Seite', [3, 29, -4], [1, 1, 7], 'primary', { mode: 'paint', ...spiegel }),
  box('Funkmodul', [3, 27, -3], [1, 3, 2], 'metal_dark'),
  box('Antenne', [3, 30, -3], [1, 3, 1], 'metal_light'),
  box('Status-LED', [3, 28, 0], [1, 1, 1], { role: 'glow', emit: 1 }, { jitter: false }),
  box('Stirnlampe', [-4, 30, 3], [1, 1, 1], { role: 'glow', emit: 1.2 }, { jitter: false }),
];

/**
 * Teile. Je Teil und Gattung ein Eintrag:
 *   quelle   Bestandsteil, das per use eingesetzt wird (unverändert)
 *   farben   Bestandsrolle → Platzrolle (per colors am use). Der Platzrollenname wird je Teil eindeutig gemacht (<name>_<teil>),
 *            jedes Teil behält so seine eigenen Bestandsfarben. Nie skin/skin_shadow/hair als Ziel; als Schlüssel nur laut PINNEN (cha-lib).
 *   params   feste Parameter am use                  decl  an der Schicht deklarierte, durchgereichte Parameter
 *   schnitte carve-Boxen nach dem use (nur Boxen: Teil von Körper/Kleidung trennen)
 *   danach   weitere Ops nach dem use (Boxen); color "@<Bestandsrolle>" = Platzrolle dieses Teils
 *   at       Versatz am use (Anbaupunkt-Teile wie der Fellumhang: Anker des Bestandsteils)
 *   ops      statt quelle: eigene Ops ({ eigene: [Boxen] }, Rollen wie im Bestand, per farben umgelegt) oder Ops aus Bestandsteilen herauslösen. Ein Objekt oder eine Liste von
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
    head: { ops: { eigene: KOPF_8 }, farben: {} },   // 8er-Kopf mit festem Gesicht (CHA-02, Entwurf FIG-01 Richtung A); Hals gehört zum Kopf
  } },

  // ---- Frisur (CHA-02 B1: vier römische Frisuren, B2 ergänzt die germanischen). Haar liegt auf der Schädelhülle x -4..3, y bis 32, z -4..3
  { platz: 'frisur', name: 'kurz', anzeige: 'Kurzschnitt', volk: 'rom', palette: 'rom', gattungen: {
    head: { ops: { eigene: FRISUR_KURZ }, farben: {} },
  } },
  { platz: 'frisur', name: 'stirnband', anzeige: 'Stirnband mit Zopf', volk: 'rom', palette: 'rom', rollen: { band: '#D9A441' }, gattungen: {
    head: { ops: { eigene: FRISUR_STIRNBAND }, farben: { trim: 'band' } },
  } },
  { platz: 'frisur', name: 'welle', anzeige: 'Welle', volk: 'rom', palette: 'rom', gattungen: {
    head: { ops: { eigene: FRISUR_WELLE }, farben: {} },
  } },
  { platz: 'frisur', name: 'offen', anzeige: 'Offenes Haar', volk: 'rom', palette: 'rom', rollen: { ohrring: '#2C5DB8' }, gattungen: {
    head: { ops: { eigene: FRISUR_OFFEN }, farben: { primary: 'ohrring' } },
  } },

  // ---- B2: germanische Frisuren mit Bart (Haar und Bart = Rolle hair; Stirnband und Perle feste Teilfarbe)
  { platz: 'frisur', name: 'bartkurz', anzeige: 'Kurzhaar mit Bart', volk: 'germanen', palette: 'nord', gattungen: { head: { ops: { eigene: BART_KURZ }, farben: {} } } },
  { platz: 'frisur', name: 'bartlang', anzeige: 'Langhaar mit Vollbart', volk: 'germanen', palette: 'nord', rollen: { band: '#D9A93A' }, gattungen: { head: { ops: { eigene: BART_LANG }, farben: { trim: 'band' } } } },
  { platz: 'frisur', name: 'zopfband', anzeige: 'Zöpfe mit Stirnband', volk: 'germanen', palette: 'nord', rollen: { band: '#D9A93A' }, gattungen: { head: { ops: { eigene: ZOPF_BAND }, farben: { trim: 'band' } } } },
  { platz: 'frisur', name: 'wild', anzeige: 'Wildes Haar', volk: 'germanen', palette: 'nord', rollen: { perle: '#3E6EB4' }, gattungen: { head: { ops: { eigene: WILD }, farben: { cloth: 'perle' } } } },

  // ---- Kopfbedeckung: Helm ohne eingebauten Kopf als späte Schicht, an den 8er-Kopf angepasst (Paket C gestaltet die Helme neu). Maske schneidet das Haar-Gitter
  // hut_zier fest: im Bestand ist primary der Spielerakzent des Helms (#56B4E9 = Spielerfarbe S1); die Spielerfigur trägt einen festen Crew-Akzent (Signalrot)
  { platz: 'kopf', name: 'bordhelm', anzeige: 'Bordhelm', volk: 'crew', palette: 'crew', rollen: { hut_zier: '#B3342B' }, gattungen: {
    head: { ops: { eigene: HELM_BORD },
      farben: { secondary: 'hut', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', primary: 'hut_zier', glow: 'licht' },
      zusatz: {
        maske: { name: 'Haarmaske (schneidet das Haar-Gitter)', ops: [
          { name: 'Haar in und neben der Schale (auch x -5 und 4)', op: 'box', at: [-6, 26, -6], size: [12, 5, 9], color: SCHABLONE },
          { name: 'Haar über der Schale (bis y 34, Fransen vor dem Rahmen)', op: 'box', at: [-6, 31, -6], size: [12, 4, 12], color: SCHABLONE },
          { name: 'Haar unter der Schale (langes Haar im Nacken, Ohrring)', op: 'box', at: [-6, 20, -6], size: [12, 6, 9], color: SCHABLONE },
          // B2: Haar der germanischen Frisuren (Zöpfe vor der Brust, Locken über und neben der Schale)
          { name: 'Zöpfe vor der Brust und Schläfen links (B2)', op: 'box', at: [-4, 20, 3], size: [1, 11, 2], color: SCHABLONE },
          { name: 'Zöpfe vor der Brust und Schläfen rechts (B2)', op: 'box', at: [3, 20, 3], size: [1, 11, 2], color: SCHABLONE },
          { name: 'Haar über dem Helmdach (B2)', op: 'box', at: [-5, 33, -6], size: [10, 3, 10], color: SCHABLONE },
          { name: 'Haar neben der Schale links (B2)', op: 'box', at: [4, 22, -6], size: [2, 13, 10], color: SCHABLONE },
          { name: 'Haar neben der Schale rechts (B2)', op: 'box', at: [-6, 22, -6], size: [2, 13, 10], color: SCHABLONE },
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
    // CHA-02 D1 (Befund b): die Werkzeugöse (x -4, y 13..14, z -4) hing 2 Voxel vor dem Becken in der Luft; der Halter (z -3) verbindet sie mit dem Becken (z -2) und dem Plattengurt
    hips: { quelle: 'fig/germanen/huefte', farben: { cloth: 'unter', leather: 'top_leder', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell', primary: 'top', secondary: 'top_unter' },
      danach: [{ name: 'Öse Halter (hängt die Werkzeugöse an das Becken)', op: 'box', at: [-4, 13, -3], size: [1, 2, 1], color: '@metal' }] },
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
    shin: { quelle: 'fig/germanen/unterschenkel', farben: { metal_dark: 'schuh', metal: 'metall', metal_light: 'metall_hell', rubber: 'gummi', leather: 'gamasche', primary: 'planke' },
      // CHA-02 D1 (Befund a): der Stiefel bringt die eigene Wickelgamasche und die Schienbeinplanken mit (y 3..5), nur der Hosenteil ab y 6 fällt weg. So steht der Unterschenkel mit der Bordhose nicht mehr im Unteranzug; mit der Germanenhose liegen die Voxel deckungsgleich.
      schnitte: [carve('Hosenanteil abschneiden (y 6..7: Gamasche und Kniekachel gehören zur Hose)', [1, 6, -2], [3, 2, 6])] },
  } },

  // ---- Hände
  { platz: 'haende', name: 'armschiene', anzeige: 'Armschiene', volk: 'rom', palette: 'rom', gattungen: {
    lowerArm: { quelle: 'fig/rom/armschiene', farben: { cloth: 'unter', metal_dark: 'handschuh', metal: 'metall', secondary: 'handschuh_2', glow: 'licht' } },
  } },

  // ---- Umhang: Fell. Das Bestandsteil färbt Fellflecken mit hair; das Teil nagelt hair auf einen festen Wert (PINNEN).
  // Die Kette zwischen den Spangen hängt im Bestand an der Halsberge des Germanen-Oberteils: zwei Kettenhalter (Boxen) hängen sie an den Kragen.
  { platz: 'umhang', name: 'fellumhang', anzeige: 'Fellumhang', volk: 'germanen', palette: 'nord', gattungen: {
    torso: { quelle: 'fig/germanen/fellumhang', at: [0, 20, -3], farben: { leather: 'umhang', hair: 'umhang_2', metal: 'metall', metal_dark: 'metall_dunkel', metal_light: 'metall_hell' },
      // CHA-02 D1 (Befund e): Der Kragen ist nicht mehr oben abgeschnitten, sondern neu aufgeteilt: Er liegt neben dem breiten Kopf (x 4..5 und -6..-5, y 24..25, z -4..2: zwei Fellwülste auf den Schultern),
      // unter dem Kopf (x -4..3) bleibt nichts stehen (die Kette hängt davor bei z 3). Der Schädel (x -4..3, y 26..32) kommt in keiner Pose an den Kragen (Test "CHA-02 D1": 0 Voxel für den Kopf ohne Haar und mit dem Kurzschnitt; langes Haar streift die Wülste in aim/kneel, siehe Test).
      schnitte: [carve('Kragen unter dem Kopf abschneiden, Spangen eingeschlossen (x -4..3, y 25..27, z -5..2)', [-4, 25, -5], [8, 3, 8]), carve('Kragen unter dem Kopf abschneiden (x -4..3, y 24, z -5..1; z 2 trägt den Kettenhalter)', [-4, 24, -5], [8, 1, 7]), carve('Kragen oben abschneiden (y 26..27, die Wülste enden bei y 25)', [-7, 26, -5], [14, 2, 9]),
        { name: 'Wulst vorn kürzen (y 25, z 2 bleibt für Seitensträhne und Perle der Frisuren frei)', op: 'box', at: [4, 25, 2], size: [2, 1, 1], mode: 'carve', mirror: 'x', mirrorAt: 0 }],
      // Die Pelzbahn hing im Bestand am Kragen (y 24, z -4); ohne den Kragen unter dem Kopf hängt sie über zwei Fellstege (x 4..5, y 23, z -4..-3, hinter der Schulterplatte der Ärmel) an den Wülsten. Die Kette hängt über Halter (x 3, z 2..3) an den Wülsten.
      danach: [{ name: 'Kettenhalter (Kette an den Wülsten)', op: 'box', at: [3, 24, 2], size: [1, 1, 2], color: '@metal', mirror: 'x', mirrorAt: 0 },
        { name: 'Fellsteg hinten (Pelzbahn an den Wulst)', op: 'box', at: [4, 23, -4], size: [2, 1, 2], color: { noise: ['umhang_fellumhang', { shade: 'umhang_fellumhang', f: 0.72 }, { shade: 'umhang_2_fellumhang', f: 1.5 }], weights: [3, 3, 2], cell: 1 }, mirror: 'x', mirrorAt: 0 }] },
  } },

  // ---- CHA-02 D1: Recycling der Bestandsausrüstung (Robe, Einsatzanzug, Anzughose, Einsatzstiefel, Ocreae, Einsatzhandschuh, Sagum) ---------------------------------------------
  // Die Einsatzuniform (crew/nova|juno|tami) und die Bordmonturen (lerche/crew_*) sind aus diesen Teilen voxelidentisch zusammenstellbar (tools/test-cha.mjs, Abschnitt "CHA-02 D1").
  // Der Rollen-Akzent der Einsatzuniform (Bestand: primary = Spielerfarbe) ist hier fest Crew-Signalrot (keine Spielerfarbe in Kleidung).
  { platz: 'oberteil', name: 'robe', anzeige: 'Robe', volk: 'lerche', palette: 'lerche_rom', gattungen: {
    torso: { quelle: 'fig/lerche/robe_torso', farben: { sand: 'top', wood_dark: 'top_saum', cloth: 'top_schal', trim: 'top_zier', leather: 'top_leder' } },
    hips: { quelle: 'fig/lerche/robe_hips', farben: { sand: 'top', wood_dark: 'top_saum', cloth: 'top_schal', trim: 'top_zier', leather: 'top_leder' } },
    upperArm: { quelle: 'fig/lerche/robe_upperarm', farben: { sand: 'top', cloth: 'top_schal' } },
    lowerArm: { quelle: 'fig/lerche/robe_lowerarm', farben: { sand: 'top', wood_dark: 'top_saum', trim: 'top_zier' } },
  } },
  { platz: 'oberteil', name: 'einsatzanzug', anzeige: 'Einsatzanzug', volk: 'crew', palette: 'crew', rollen: { akzent: '#B3342B' }, gattungen: {
    torso: { ops: { quelle: 'fig/crew/anzug_rumpf', ohneNamen: ['Unteranzug'] }, farben: { secondary: 'top', primary: 'akzent', metal: 'metall', metal_dark: 'metall_dunkel', glow: 'licht', glow2: 'licht_2' } },
    hips: { ops: { quelle: 'fig/crew/anzug_huefte', ohneNamen: ['Unteranzug'] }, farben: { metal_dark: 'metall_dunkel', primary: 'akzent', leather: 'leder', metal: 'metall' } },
    upperArm: { ops: { quelle: 'fig/crew/anzug_oberarm', ohneNamen: ['Unteranzug'] }, farben: { primary: 'akzent', secondary: 'top' } },
    lowerArm: { ops: { quelle: 'fig/crew/anzug_unterarm', namen: ['Manschette', 'Armgerät', 'Armgerät Anzeige'], paintZuAdd: ['Manschette'] }, farben: { secondary: 'top', metal_dark: 'metall_dunkel', glow: 'licht' } },
  } },
  // Anzughose: Oberschenkel mit Beintasche, Unterschenkel mit Knieschonern; das Schienbein reicht wie bei der Bordhose bis y 5 und unter die Stiefel (y 0..4 abgeschnitten)
  { platz: 'hose', name: 'anzughose', anzeige: 'Anzughose', volk: 'crew', palette: 'crew', rollen: { akzent: '#B3342B' }, gattungen: {
    thigh: { ops: { quelle: 'fig/crew/anzug_oberschenkel', ohneNamen: ['Unteranzug'], paintZuAdd: ['Schenkelplatte'] }, farben: { secondary: 'platte', leather: 'leder', metal: 'metall' } },
    shin: { ops: [{ quelle: 'fig/basis/unterschenkel', namen: ['Schienbein'] }, { eigene: [carve('Stiefelbereich abschneiden (y 0..4)', [1, 0, -1], [3, 5, 3])] }, { quelle: 'fig/crew/anzug_unterschenkel', namen: ['Knieschoner', 'Knieschoner Kern'] }],
      farben: { cloth: 'hose', primary: 'akzent' } },
  } },
  // Einsatzstiefel: Bein + Stiefel aus fig/basis/unterschenkel mit Stiefelschaft 4 (wie im Einsatzanzug), weißer Stiefel und Rand als paint; das Schienbein (y 5..6) bleibt der Hose
  { platz: 'schuhe', name: 'einsatzstiefel', anzeige: 'Einsatzstiefel', volk: 'crew', palette: 'crew', gattungen: {
    shin: { quelle: 'fig/basis/unterschenkel', params: { bootH: 4 }, farben: { cloth: 'stoff', metal_dark: 'schuh', rubber: 'gummi', secondary: 'weiss', metal: 'rand' },
      schnitte: [carve('Schienbein abschneiden (y 5..6, gehört zur Hose)', [1, 5, -1], [3, 2, 3])],
      danach: [{ name: 'Stiefel weiß', op: 'box', at: [1, 1, -1], size: [3, 3, 3], color: '@secondary', mode: 'paint' }, { name: 'Stiefelrand', op: 'box', at: [1, 4, -1], size: [3, 1, 3], color: '@metal', mode: 'paint' }] },
  } },
  // Ocreae: Legionärsstiefel mit Beinschiene. Der Teil über dem Knie (Schienbeinstoff y 6 samt Schienenseiten) fällt weg, er gehört zur Hose; Schiene (y 3..5), Knieschutz und Kniescheibe sitzen davor.
  { platz: 'schuhe', name: 'ocreae', anzeige: 'Ocreae', volk: 'rom', palette: 'rom', gattungen: {
    shin: { quelle: 'fig/rom/ocrea', farben: { cloth: 'stoff', metal_dark: 'schuh', rubber: 'gummi', secondary: 'platte', trim: 'zier', metal: 'metall', metal_light: 'metall_hell' },
      schnitte: [carve('Schienbeinstoff über dem Stiefel abschneiden (y 6, gehört zur Hose)', [1, 6, -1], [3, 1, 3])] },
  } },
  // Einsatzhandschuh: nur die Faust des Anzugs (Handschuh, Knöchel); der Ärmel kommt vom Oberteil
  { platz: 'haende', name: 'einsatzhandschuh', anzeige: 'Einsatzhandschuh', volk: 'crew', palette: 'crew', gattungen: {
    lowerArm: { quelle: 'fig/basis/unterarm', farben: { cloth: 'stoff', metal_dark: 'handschuh' },
      schnitte: [carve('Unterarm abschneiden (y 13..16, der Ärmel gehört zum Oberteil)', [4, 13, -1], [3, 4, 3])] },
  } },
  // Sagum: Bahn und Fibeln aus fig/rom/umhang (Anbau am Rücken-Gelenk, Anker [0,20,-3])
  { platz: 'umhang', name: 'sagum', anzeige: 'Sagum', volk: 'rom', palette: 'rom', gattungen: {
    torso: { quelle: 'fig/rom/umhang', at: [0, 20, -3], farben: { cloth: 'umhang', trim: 'zier' } },
  } },
  // ---- CHA-02 D1 (Ende) ---------------------------------------------------------------------------------------------------------------------------------------------------------
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
  if (o.eigene) return clean(o.eigene);
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
const quellenText = (o) => [...new Set([].concat(o).map((x) => x.quelle ?? 'eigenen Boxen'))].join(', ');

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
      params: { frisur: { default: platzOf('frisur').standard, options: werte(platzOf('frisur')) }, kopf: { default: 'keine', options: werte(platzOf('kopf')) } },
      ops: [leerOp('Frisur', 'cha/frisur/{frisur}/head'), { name: 'Haarmaske (carve)', ...useOp('cha/kopf/{kopf}/head_maske', { fallback: ['cha/leer'], mode: 'carve' }) }] });
    ops.push(leerOp(SCHICHT_NAME.koerper, 'cha/koerper/{koerper}/head'));
    ops.push({ name: 'Frisur (unter Hutmaske)', ...useOp('cha/frisur_maskiert/head', { params: { frisur: '{frisur}', kopf: '{kopf}' } }) });
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
  version: 2,
  figur: 'cha/spieler',
  koerper: werte(platzOf('koerper')).map((n) => ({ id: n, name: TEILE.find((t) => t.platz === 'koerper' && t.name === n).anzeige })),
  plaetze: katalogPlaetze.map((p) => ({ id: p.id, name: p.name, gruppe: p.gruppe, standard: p.standard })),
  teile: katalogPlaetze.flatMap((p) => werte(p).map((n) => {
    const t = TEILE.find((x) => x.platz === p.id && x.name === n);
    if (!t && n !== p.keine) throw new Error(`Katalog: ${p.id}/${n} ist weder Teil noch leerer Wert`);
    return { id: `${p.id}/${n}`, platz: p.id, name: t ? t.anzeige : p.keineName, gruppe: p.gruppe, ...(p.gruppe === 'outfit' ? { herkunft: 'frei' } : {}), ...(t?.volk ? { volk: t.volk } : {}), vorschau: `cha/vorschau/${p.id}/${n}.png` };
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
