// Biom-Props (VOX-02 Paket 2): Prüfregeln für Strauch, Farn, Findling, Bodenbewuchs und Fluid-Kachel.
// Verwendet von tools/test-biom-props.mjs (Prüfung und Mutationsproben). Regeln siehe AUTHORING.md, Abschnitt "Biom-Props".
//
// Alle Maße in Metern, gemessen vom Anker (Mitte unten bzw. Lauffläche) aus; 1 Kachel = 1 m, Footprint 1 × 1 um den Pivot.
// Dreiecke wie im Prüfbogen (tools/pruefbogen.mjs): 2 × Quads des Netzes (lit + emit).
import { lstar, SCHWELLEN, BODEN_ROLLEN } from './biom-lib.mjs';

export const PROPS = ['biom/wiese/strauch', 'biom/wiese/farn', 'biom/wiese/findling', 'biom/gemein/bewuchs', 'biom/gemein/fluid'];
export const BIOM_PALETTEN = ['biom_wiesenwald', 'biom_wueste', 'biom_vulkan'];
const EPS = 1e-6;
const seeds = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * Fälle je Rezept: Parameter, Dreiecksbudget, Höhenband (Meter, Oberkante über dem Anker).
 * Strauch/Farn/Findling/Bewuchs: Seeds 0 bis 63; Fluid: alle Arten × alle conn × einige Seeds.
 */
export const REGELN = {
  'biom/wiese/strauch': {
    faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 800, hoehe: [1.2, 1.51], label: `seed ${seed}` })),
  },
  'biom/wiese/farn': {
    faelle: () => seeds(64).map((seed) => ({ params: { seed }, budget: 600, hoehe: [0.75, 1.0], label: `seed ${seed}` })),
  },
  'biom/wiese/findling': {
    // hoch 0 = halbe Deckung ca. 0,75 m (Kit-Deckung), hoch 1 = volle Deckung ca. 2,1 m
    faelle: () => [0, 1].flatMap((hoch) => seeds(64).map((seed) => ({
      params: { seed, hoch }, budget: hoch ? 900 : 500, hoehe: hoch ? [1.95, 2.15] : [0.70, 0.80], label: `hoch ${hoch} seed ${seed}`,
    }))),
  },
  'biom/gemein/bewuchs': {
    // flach (höchstens 0,2 m) und über die ganze Kachel gestreut (Ausdehnung in x und z mindestens 0,55 m)
    faelle: () => [0, 1, 2, 3].flatMap((form) => seeds(48).map((seed) => ({
      params: { seed, form }, budget: 300, hoehe: [0.03, 0.2], streuung: 0.55, label: `form ${form} seed ${seed}`,
    }))),
  },
  'biom/gemein/fluid': {
    // Oberfläche 25 cm unter der Lauffläche (Wasser, Lava; Uferkanten höchstens 6 cm darunter), Treibsand leicht eingesunken; nichts über der Lauffläche
    faelle: () => [0, 1, 2].flatMap((art) => Array.from({ length: 16 }, (_, conn) => [0, 7].map((seed) => ({
      params: { art, conn, seed }, budget: 400, hoehe: art === 2 ? [-0.2, -0.08] : conn === 15 ? [-0.3, -0.2] : [-0.3, -0.04], tiefe: -1.0, label: `art ${art} conn ${conn} seed ${seed}`,
    }))).flat()),
  },
};

/** Messwerte eines gebauten Modells: Dreiecke, Voxel, Ausdehnung in Metern relativ zum Anker, leuchtende Voxel, Fingerabdruck. */
export function messe(lib, id, params = {}, palette) {
  const b = lib.build(id, { params, palette });
  const s = b.tier === 'detail' ? 1 / 16 : b.tier === 'architecture' ? 1 / 4 : 1;
  const bb = b.grid.bounds(), a = b.anchor;
  const min = [0, 1, 2].map((i) => (bb.min[i] - a[i]) * s), max = [0, 1, 2].map((i) => (bb.max[i] + 1 - a[i]) * s);
  let emit = 0, h = 2166136261;
  const vox = [];
  for (const v of b.grid.values()) { if (v.e > 0) emit++; vox.push(`${v.x},${v.y},${v.z}`); }
  vox.sort();
  let g = 2166136261;   // Formhash: nur die Voxelpositionen, unabhängig von Palette und Farben
  for (const k of vox) for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); g ^= k.charCodeAt(i); g = Math.imul(g, 16777619); }
  for (const v of b.grid.values()) { h ^= v.c; h = Math.imul(h, 16777619); h ^= v.x * 31 + v.y * 17 + v.z * 7; h = Math.imul(h, 16777619); }
  return { tris: 2 * (b.mesh.lit.quads + b.mesh.emit.quads), voxels: b.grid.size, min, max, emit, hash: (h >>> 0).toString(16), form: (g >>> 0).toString(16), keys: new Set(vox), grid: b.grid, built: b };
}

/** Footprint 1 × 1 um den Pivot: kein Voxel außerhalb von ±0,5 m (x, z). */
export function pruefeFussabdruck(m, label) {
  const f = [];
  for (const i of [0, 2]) {
    if (m.min[i] < -0.5 - EPS) f.push(`${label}: ragt ${((-0.5 - m.min[i]) * 100).toFixed(1)} cm über die Kachel (${'xyz'[i]} min ${m.min[i].toFixed(3)} m, erlaubt −0,5)`);
    if (m.max[i] > 0.5 + EPS) f.push(`${label}: ragt ${((m.max[i] - 0.5) * 100).toFixed(1)} cm über die Kachel (${'xyz'[i]} max ${m.max[i].toFixed(3)} m, erlaubt 0,5)`);
  }
  return f;
}

/** Ein Fall gegen die Regeln: Footprint, Höhe, Budget, Streuung, Tiefe. */
export function pruefeFall(m, fall, id) {
  const f = [], l = `${id} [${fall.label}]`;
  f.push(...pruefeFussabdruck(m, l));
  if (m.voxels === 0) f.push(`${l}: leer`);
  if (fall.hoehe && (m.max[1] < fall.hoehe[0] - EPS || m.max[1] > fall.hoehe[1] + EPS)) f.push(`${l}: Oberkante ${m.max[1].toFixed(3)} m außerhalb ${fall.hoehe[0]} bis ${fall.hoehe[1]} m`);
  if (fall.tiefe !== undefined && m.min[1] < fall.tiefe - EPS) f.push(`${l}: reicht bis ${m.min[1].toFixed(3)} m, tiefer als ${fall.tiefe} m`);
  if (fall.budget && m.tris > fall.budget) f.push(`${l}: ${m.tris} Dreiecke über dem Budget ${fall.budget}`);
  if (fall.streuung) for (const i of [0, 2]) if (m.max[i] - m.min[i] < fall.streuung) f.push(`${l}: nur ${(m.max[i] - m.min[i]).toFixed(2)} m Streuung in ${'xyz'[i]} (mindestens ${fall.streuung}, nicht ein Büschel in der Mitte)`);
  return f;
}

/** Alle Fälle eines Rezepts; liefert { fehler, tris: { max, ... } } (höchste Dreiecke je Gruppe, für die Berichtstabelle). */
export function pruefeRezept(lib, id, regel = REGELN[id], palette) {
  const fehler = [], maxTris = {};
  for (const fall of regel.faelle()) {
    const m = messe(lib, id, fall.params, palette);
    fehler.push(...pruefeFall(m, fall, id));
    const g = fall.params.hoch !== undefined ? `hoch ${fall.params.hoch}` : fall.params.form !== undefined ? `form ${fall.params.form}` : fall.params.art !== undefined ? `art ${fall.params.art}` : 'alle';
    maxTris[g] = Math.max(maxTris[g] ?? 0, m.tris);
    lib.buildCache.delete(JSON.stringify([id, fall.params, palette || lib.get('models', id).palette || 'base', null]));
  }
  return { fehler, maxTris };
}

/** Unterschied zweier Gestalten (0 gleich bis 1 völlig verschieden): 1 − Schnitt/Vereinigung der Voxelmengen. */
export function unterschied(a, b) {
  let n = 0;
  for (const k of a.keys) if (b.keys.has(k)) n++;
  return 1 - n / (a.keys.size + b.keys.size - n);
}

/** Seeds liefern sichtbar verschiedene Gestalten (paarweise mindestens `min`) und sind deterministisch (zweiter Bau gleicher Fingerabdruck). */
export function pruefeGestalten(lib, id, paramsJeSeed, seedListe, min) {
  const f = [], ms = seedListe.map((seed) => messe(lib, id, paramsJeSeed(seed)));
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const u = unterschied(ms[i], ms[j]);
    if (u < min) f.push(`${id}: seed ${seedListe[i]} und ${seedListe[j]} unterscheiden sich nur um ${(u * 100).toFixed(0)} % (mindestens ${(min * 100).toFixed(0)} %): gleiche Gestalt`);
  }
  lib.buildCache.clear();
  seedListe.forEach((seed, i) => { const m2 = messe(lib, id, paramsJeSeed(seed)); if (m2.hash !== ms[i].hash) f.push(`${id}: seed ${seed} ist nicht deterministisch (zwei Bauten, zwei Ergebnisse)`); });
  return f;
}

/**
 * Helligkeit der gebauten Stein-Voxel gegen den Boden der Palette (Wertleiter): kein Voxel heller als der hellste Boden plus `steinKappe`,
 * keine helle Kappe (oberes Viertel im Mittel nicht mehr als 3 L* heller als der Rest) und kein heller Sockel (unteres Viertel ebenso).
 */
export function pruefeSteinHelligkeit(lib, id, params, paletteId) {
  const f = [], l = `${id} ${JSON.stringify(params)} mit ${paletteId}`;
  const m = messe(lib, id, params, paletteId), pal = lib.palette(paletteId).roles;
  const boden = BODEN_ROLLEN.map((r) => lstar(pal[r].c)), bMax = Math.max(...boden);
  const vs = [...m.grid.values()].map((v) => ({ y: v.y, L: lstar(v.c) }));
  const lim = bMax + SCHWELLEN.steinKappe;
  const zuHell = vs.filter((v) => v.L > lim + 0.5);
  if (zuHell.length) f.push(`${l}: ${zuHell.length} Voxel heller als der Boden plus ${SCHWELLEN.steinKappe} (L* ${Math.max(...zuHell.map((v) => v.L)).toFixed(1)} gegen ${lim.toFixed(1)}): helle Kappe oder Rand`);
  const ys = vs.map((v) => v.y), y0 = Math.min(...ys), y1 = Math.max(...ys), q = Math.max(1, Math.round((y1 - y0 + 1) / 4));
  const mean = (a) => a.reduce((s, v) => s + v.L, 0) / (a.length || 1);
  const oben = vs.filter((v) => v.y > y1 - q), unten = vs.filter((v) => v.y < y0 + q), mitte = vs.filter((v) => v.y >= y0 + q && v.y <= y1 - q);
  if (mitte.length && mean(oben) - mean(mitte) > 3) f.push(`${l}: obere Schicht im Mittel ${(mean(oben) - mean(mitte)).toFixed(1)} L* heller als der Körper: helle Kappe`);
  if (mitte.length && mean(unten) - mean(mitte) > 3) f.push(`${l}: untere Schicht im Mittel ${(mean(unten) - mean(mitte)).toFixed(1)} L* heller als der Körper: heller Sockel`);
  return f;
}

/** Rollen, die ein Rezept in seinen Farbangaben nennt (rekursiv über alle ops und Farbobjekte). */
export function rollenVon(modell) {
  const rollen = new Set();
  const farbe = (c) => {
    if (typeof c === 'string') { if (!c.startsWith('#')) rollen.add(c); return; }
    if (!c || typeof c !== 'object') return;
    for (const k of ['role', 'shade', 'frame', 'fill']) if (c[k] !== undefined) farbe(c[k]);
    for (const k of ['noise', 'gradient', 'stripes', 'checker']) if (Array.isArray(c[k])) c[k].forEach(farbe);
  };
  const walk = (ops) => { for (const op of ops || []) { if (op.color !== undefined) farbe(op.color); if (op.ops) walk(op.ops); } };
  walk(modell.ops);
  return rollen;
}
