// Ansichten der Spielerfigur aus Schichten (cha/) mit dem Node-Renderer: Vorschaubild je Teil (Kachel) und Porträt einer Charakterkarte.
// Reine Funktionen über Library + Katalog, deterministisch (feste Kamera, feste Fenster, Pixelmitten-Test, kein Zufall).
// Genutzt von tools/gen-cha-vorschau.mjs (eingecheckte Kachelbilder), tools/cha-bilder.mjs (Porträt-Beispiele) und tools/test-cha.mjs.
import { baueFigur } from './cha-lib.mjs';
import { Canvas, drawGrid } from './cha-render.mjs';

/**
 * Bildgröße der Teile-Kachel: Pantheon pult-kammer-tokens.js, MASS.kachel { w: 72, bild: 62 } → Bildfläche 70 × 62 Spielpixel
 * (Spielraster 640×360), die Anzeige zeigt das Doppelte. Das Bild kommt in genau dieser doppelten Größe, transparent.
 */
export const KACHEL = { w: 140, h: 124 };
/** Porträtfenster der Charakterkarte: MASS.liste.w 132 → Bildfläche 130 × 130 Spielpixel, doppelt. */
export const PORTRAET = { w: 260, h: 260 };

/**
 * Fenster je Platz: Voxelbereich (x, y; z fest), den die Kachel zeigen soll, plus Blick und die Gelenke, deren Voxel sie zeigt (sonst ragen Kopf, Arme usw. in den Ausschnitt). Die Figur steht in Voxeln (y 0 = Sohle, Kopf bis 32).
 * Gleicher Ausschnitt für alle Werte eines Platzes, damit die Kacheln einer Reihe vergleichbar sind.
 * yaw 0 = von vorn, 90 = von der linken Seite (+x), 180 = von hinten.
 */
export const KOPFFENSTER = { x: [-4, 4], y: [24, 33], yaw: 28, pitch: 6, gelenke: ['head'] };
export const FENSTER = {
  gesicht: KOPFFENSTER, frisur: KOPFFENSTER, bart: KOPFFENSTER, kopf: KOPFFENSTER,
  oberteil: { x: [-7, 7], y: [11, 26], yaw: 28, pitch: 8, gelenke: ['torso', 'upperArmL', 'upperArmR'] },    // Rumpf mit Oberarmen
  hose: { x: [-5, 5], y: [5, 16], yaw: 28, pitch: 8, gelenke: ['hips', 'thighL', 'thighR'] },         // Hüfte bis Knie
  schuhe: { x: [-5, 4], y: [0, 7], yaw: 28, pitch: 10, gelenke: ['shinL', 'shinR'] },       // Unterschenkel und Füße
  haende: { x: [3, 8], y: [9, 17], yaw: 40, pitch: 8, gelenke: ['lowerArmL'] },       // linker Unterarm
  umhang: { x: [-8, 7], y: [7, 27], yaw: 198, pitch: 8, gelenke: ['torso', 'hips', 'upperArmL', 'upperArmR', 'thighL', 'thighR'] },      // von hinten, ohne Kopf und Füße
};
export const PLAETZE_MIT_VORSCHAU = Object.keys(FENSTER);

/**
 * Zeichnet die Voxel in ein Canvas (transparent, wenn bg nicht gesetzt): der Ausschnitt `fenster` wird so eingepasst, dass er die Fläche
 * bis auf `rand` Pixel füllt (ganzzahlige Pixel je Voxel, damit die Kanten scharf bleiben), Voxel außerhalb von y wird weggelassen.
 */
export function zeichneAusschnitt(vox, fenster, w, h, { bg = [0, 0, 0, 0], rand = 4, zBereich = [-4, 4] } = {}) {
  const ya = fenster.yaw * Math.PI / 180, pi = fenster.pitch * Math.PI / 180;
  const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pi), sp = Math.sin(pi);
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const x of [fenster.x[0], fenster.x[1] + 1]) for (const y of [fenster.y[0], fenster.y[1] + 1]) for (const z of zBereich) {
    const rx = cy * x + sy * z, rz = -sy * x + cy * z, ry = cp * y - sp * rz;
    minx = Math.min(minx, rx); maxx = Math.max(maxx, rx); miny = Math.min(miny, ry); maxy = Math.max(maxy, ry);
  }
  const px = Math.max(1, Math.floor(Math.min((w - 2 * rand) / (maxx - minx), (h - 2 * rand) / (maxy - miny))));
  const ox = Math.round(w / 2 - (minx + maxx) / 2 * px), oy = Math.round(h / 2 + (miny + maxy) / 2 * px);
  const cv = new Canvas(w, h, bg);
  drawGrid(cv, [...vox].filter((v) => v.y >= fenster.y[0] && v.y <= fenster.y[1]), { yaw: fenster.yaw, pitch: fenster.pitch, px, ox, oy });
  return { canvas: cv, px };
}

/** Farben aus dem Katalog: Index 0 = Figurfarben. Rückgabe { skin, skin_shadow, hair } für baueFigur. */
export const farbenAus = (katalog, haut = 0, haar = 0) => ({ ...katalog.farben.haut[haut], hair: katalog.farben.haar[haar] });

/** Vorschaubild eines Teils (`<platz>/<name>`): Standardfigur mit genau diesem Teil, Ausschnitt des Platzes. Rückgabe Canvas (KACHEL). */
export function vorschauBild(lib, katalog, teilId) {
  const [platz, name] = teilId.split('/');
  if (!FENSTER[platz]) throw new Error(`Platz "${platz}" hat kein Vorschaufenster`);
  const fig = baueFigur(lib, katalog.figur, { params: { [platz]: name }, colors: farbenAus(katalog) });
  const f = FENSTER[platz], vox = f.gelenke.flatMap((j) => fig.pro[j]);
  return zeichneAusschnitt(vox, f, KACHEL.w, KACHEL.h).canvas;
}

/** Plätze und Farbindizes einer Charakterkarte (Pantheon shared/charakter.js: { koerper, <Charakterplätze>, haut, haar, outfit: { <Outfitplätze> } }) → baueFigur-Optionen. */
export function kartenOptionen(katalog, karte) {
  const params = {};
  for (const p of katalog.plaetze) params[p.id] = (p.gruppe === 'outfit' ? karte.outfit?.[p.id] : karte[p.id]) ?? p.standard;
  if (karte.koerper) params.koerper = karte.koerper;
  return { params, colors: farbenAus(katalog, karte.haut ?? 0, karte.haar ?? 0) };
}

/**
 * Porträt einer Charakterkarte (Referenz für die Live-Porträts des Spiels): Kopf in Nahansicht, ¾ von vorn, quadratisch (PORTRAET).
 * Standard transparent; `bg` = [r, g, b, a] für einen Grund (Spiel: figurGrund der Anprobe-Szene).
 */
export function portraet(lib, katalog, karte, { bg = [0, 0, 0, 0] } = {}) {
  const fig = baueFigur(lib, katalog.figur, kartenOptionen(katalog, karte));
  return zeichneAusschnitt(fig.grid.values(), { x: [-5, 4], y: [22, 34], yaw: 28, pitch: 6 }, PORTRAET.w, PORTRAET.h, { bg, rand: 8 }).canvas;
}
