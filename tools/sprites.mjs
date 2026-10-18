// Drehsprites für die 2D-Raumansicht (EK1b): Draufsicht jeder Schiffsklasse in 64 Winkelstufen als PNG-Spritesheet.
//
//   npm run sprites                  alle Klassen × Sets nach assets/sprites/ (deterministisch, ohne Browser, ohne three.js)
//   npm run sprites -- jaeger/nord   nur passende Sprites (Filter = Teilstring von "<klasse>/<set>")
//   npm run sprites -- --check       erzeugt im Speicher und vergleicht mit den Dateien (Exit 1 bei Abweichung)
//
// Ausgabe:  assets/sprites/schiff/<klasse>/<set>.png   Sheet, COLS Spalten, Stufe b = Zeile b/COLS, Spalte b%COLS
//           assets/sprites/manifest.json               Klasse, Volk, Stufen, Rahmengröße, Ankerpunkt je Sprite
// Konvention (wie ROT_STEPS in Pantheon public/js/art.js): Stufe b zeigt das Schiff gedreht um b/64·2π im Canvas
// (y nach unten, Uhrzeigersinn), Bug bei Stufe 0 nach +x. Ankerpunkt = Mitte des Rahmens = Mitte der Schiffs-Bounding-Box.
// Modellachsen: Bug +z, oben +y, Draufsicht von +y; Bildschirm rechts = +z, Bildschirm oben = +x.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nodeLibrary } from './fs-io.js';
import { voxelSize } from '../core/scales.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets', 'sprites');
const STEPS = 64, COLS = 8, SS = 4;

// Länge des Schiffs im Spiel in px bei Zoom 1 (Jäger/Korvette entsprechen den bisherigen prozeduralen Sprites: ENEMY_SIZE 16/34 als Radius).
// Spiel-Größen sind Entscheidung des Spiels, hier nur die Standardwerte im Manifest.
export const KLASSEN = {
  jaeger: { len: 32 }, spaeher: { len: 44 }, korvette: { len: 68 }, frachter: { len: 76 },
  fregatte: { len: 88 }, kreuzer: { len: 104 }, linienschiff: { len: 128 },
  // PAN-01 B: Lerche (Spielerschiff, Ausbaustufen 0-3 = 3/5/7/9 Waffen). Eigenes Modell statt schiff/<klasse>/<volk>:
  //   modell = Rezept, params = Modellparameter, sets = nur diese Farbthemen, bezug = Klasse, deren Bounding-Box (Rahmen, Massstab,
  //   Mitte, Hoehenskala) alle Stufen teilen, damit die Sheets deckungsgleich sind und der Anker in jeder Stufe derselbe bleibt.
  // Laenge 78 px: zwischen Korvette (68) und Fregatte (88), nahe an der bisherigen prozeduralen Lerche (ca. 81 px mit Ring).
  lerche_s0: { len: 78, modell: 'schiff/lerche/rom', params: { stufe: 0 }, sets: ['rom'], bezug: 'lerche_s3' },
  lerche_s1: { len: 78, modell: 'schiff/lerche/rom', params: { stufe: 1 }, sets: ['rom'], bezug: 'lerche_s3' },
  lerche_s2: { len: 78, modell: 'schiff/lerche/rom', params: { stufe: 2 }, sets: ['rom'], bezug: 'lerche_s3' },
  lerche_s3: { len: 78, modell: 'schiff/lerche/rom', params: { stufe: 3 }, sets: ['rom'] },
};
// Set = Farbthema. model = Volk-Ordner der Rohmodelle; palette = Farben (Rollen aus <palette> über der Modellpalette).
// "rostmeute" = Germanen-Geometrie (nord) in Rostmeute-Farben (so spielt das Spiel die bisherige Fraktion Rostmeute).
export const SETS = {
  rom: { volk: 'rom', model: 'rom' },
  nord: { volk: 'germanen', model: 'nord' },
  rostmeute: { volk: 'rostmeute', model: 'nord', palette: 'rostmeute' },
  aegypten: { volk: 'aegypten', model: 'aegypten' },
  babylon: { volk: 'babylon', model: 'babylon' },
  himmelsreich: { volk: 'himmelsreich', model: 'himmelsreich' },
};
// Reihenfolge laut Briefing: Nord-Jäger, Nord-Korvette, Nord-Fregatte, Rom-Korvette, danach der Rest
const PRIO = ['jaeger/nord', 'korvette/nord', 'fregatte/nord', 'korvette/rom'];

// ---------------------------------------------------------------------------------------------
// PNG (RGBA, 8 bit) ohne Abhängigkeiten
// ---------------------------------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
export function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------------------------
// Höhenkarte der Draufsicht: je (x,z) das oberste Voxel
// ---------------------------------------------------------------------------------------------
function topMap(grid, refBounds) {
  const b = refBounds || grid.bounds(), nx = b.max[0] - b.min[0] + 1, nz = b.max[2] - b.min[2] + 1;
  const H = new Float32Array(nx * nz).fill(-Infinity), C = new Uint32Array(nx * nz), E = new Float32Array(nx * nz);
  for (const v of grid.values()) {
    const i = (v.x - b.min[0]) * nz + (v.z - b.min[2]);
    if (v.y > H[i]) { H[i] = v.y; C[i] = v.c; E[i] = v.e || 0; }
  }
  return { b, nx, nz, H, C, E, ymin: b.min[1], ymax: b.max[1] };
}

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
// Licht von links oben (Bildschirm), leicht von oben
const LIGHT = [-0.55, -0.75];

/** Rendert eine Winkelstufe in einen Rahmen (F×F) → RGBA-Daten (kein Antialiasing am Rand: Alpha 0/255, 1-px-Umriss). */
function renderFrame(tm, ppv, F, ang, outline) {
  const N = F * SS, co = Math.cos(ang), si = Math.sin(ang);
  const cx = (tm.b.min[0] + tm.b.max[0] + 1) / 2, cz = (tm.b.min[2] + tm.b.max[2] + 1) / 2;
  const h = new Float32Array(N * N).fill(-Infinity), col = new Uint32Array(N * N), em = new Float32Array(N * N);
  for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
    const px = (sx + 0.5) / SS - F / 2, py = (sy + 0.5) / SS - F / 2;      // Canvas-Pixel vom Mittelpunkt
    const lx = px * co + py * si, ly = -px * si + py * co;                   // Schiffskoordinaten: lx entlang Bug, ly nach Steuerbord (unten)
    const vz = cz + lx / ppv, vx = cx - ly / ppv;
    const ix = Math.floor(vx) - tm.b.min[0], iz = Math.floor(vz) - tm.b.min[2];
    if (ix < 0 || iz < 0 || ix >= tm.nx || iz >= tm.nz) continue;
    const i = ix * tm.nz + iz;
    if (h[sy * N + sx] === -Infinity && tm.H[i] !== -Infinity) { h[sy * N + sx] = tm.H[i]; col[sy * N + sx] = tm.C[i]; em[sy * N + sx] = tm.E[i]; }
  }
  const span = Math.max(1, tm.ymax - tm.ymin);
  const rgb = new Float32Array(N * N * 3);
  const hAt = (x, y) => { const v = h[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))]; return v === -Infinity ? tm.ymin - 2 : v; };
  const D = SS * 1.5;   // Abstand für den Höhenverlauf (Sample)
  for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
    const i = sy * N + sx; if (h[i] === -Infinity) continue;
    const c = col[i];
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, f;
    if (em[i] > 0) f = 1.12 + 0.1 * Math.min(1, em[i]);
    else {
      const gx = (hAt(sx + D, sy) - hAt(sx - D, sy)), gy = (hAt(sx, sy + D) - hAt(sx, sy - D));
      const dl = Math.max(-3, Math.min(3, gx * LIGHT[0] + gy * LIGHT[1]));   // positiv = der Sonne zugewandt
      f = 0.86 + 0.28 * (h[i] - tm.ymin) / span + 0.07 * dl;
      // Schatten: Kante, hinter der (zur Lichtrichtung) etwas deutlich Höheres steht
      const hx = hAt(Math.round(sx + LIGHT[0] * SS * 1.5), Math.round(sy + LIGHT[1] * SS * 1.5));
      if (hx - h[i] > 1.5) f *= 0.82;
    }
    r *= f; g *= f; b *= f;
    // Lesbarkeit bei 30 px: etwas mehr Sättigung und Kontrast (Rohpaletten sind flach)
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    r = (lum + (r - lum) * 1.3 - 120) * 1.18 + 120; g = (lum + (g - lum) * 1.3 - 120) * 1.18 + 120; b = (lum + (b - lum) * 1.3 - 120) * 1.18 + 120;
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  // Herunterrechnen (Boxfilter), Alpha-Schwelle 0,5 → harte Kanten wie die übrigen Pixel-Sprites
  const out = new Uint8ClampedArray(F * F * 4), solid = new Uint8Array(F * F);
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
    let n = 0, r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i2 = 0; i2 < SS; i2++) {
      const i = (y * SS + j) * N + x * SS + i2;
      if (h[i] === -Infinity) continue;
      n++; r += rgb[i * 3]; g += rgb[i * 3 + 1]; b += rgb[i * 3 + 2];
    }
    if (n >= SS * SS * 0.5) { const o = (y * F + x) * 4; out[o] = clamp8(r / n); out[o + 1] = clamp8(g / n); out[o + 2] = clamp8(b / n); out[o + 3] = 255; solid[y * F + x] = 1; }
  }
  // 1-px-Umriss (4er-Nachbarschaft) außen
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
    if (solid[y * F + x]) continue;
    if ((x > 0 && solid[y * F + x - 1] === 1) || (x < F - 1 && solid[y * F + x + 1] === 1) || (y > 0 && solid[(y - 1) * F + x] === 1) || (y < F - 1 && solid[(y + 1) * F + x] === 1)) {
      const o = (y * F + x) * 4; out[o] = outline[0]; out[o + 1] = outline[1]; out[o + 2] = outline[2]; out[o + 3] = 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
/** Bereitet Modell + Farbthema vor; lenPx = Schiffslänge im Bild. */
export async function prepare(lib, klasse, setId, lenPx = KLASSEN[klasse].len) {
  const set = SETS[setId], K = KLASSEN[klasse], id = K.modell || `schiff/${klasse}/${set.model}`, params = K.params || {};
  await lib.load('models', id);
  let palette;   // Farbthema: Rollen der Zielpalette über die Modellpalette legen (virtuelle Palette, keine Datei)
  if (set.palette) {
    await lib.load('palettes', set.palette);
    const base = lib.get('models', id).palette, vid = `${base}+${set.palette}`;
    if (!lib.get('palettes', vid)) lib.store.palettes.set(vid, { id: vid, extends: base, roles: lib.get('palettes', set.palette).roles });
    palette = vid;
  }
  const built = lib.build(id, { params, ...(palette ? { palette } : {}) });
  const ref = K.bezug ? lib.build(id, { params: KLASSEN[K.bezug].params || {}, ...(palette ? { palette } : {}) }).grid.bounds() : null;
  const tm = topMap(built.grid, ref), s = voxelSize(built.tier);
  const lenM = tm.nz * s, widM = tm.nx * s, ppm = lenPx / lenM, ppv = ppm * s;
  // Rahmen: Kreis um den Mittelpunkt, der das ganze Schiff in jeder Drehung fasst
  const F = 2 * Math.ceil(Math.hypot(lenPx / 2, widM * ppm / 2)) + 6;
  const palName = palette || lib.get('models', id).palette, pal = lib.palette(palName);
  const md = pal.roles.metal_dark ? pal.roles.metal_dark.c : 0x202020;
  const outline = [((md >> 16) & 255) * 0.4, ((md >> 8) & 255) * 0.4, (md & 255) * 0.4].map(Math.round);
  return { set, setId, klasse, id, model: lib.get('models', id), tm, ppv, ppm, F, outline, lenPx, lenM, widM, palette: set.palette || lib.get('models', id).palette };
}

/** Ein Bild (Stufe 0 = Bug nach +x) bei beliebiger Länge – für Lesbarkeitsvergleiche. */
export async function renderOne(lib, klasse, setId, lenPx, ang = 0) {
  const c = await prepare(lib, klasse, setId, lenPx);
  return { F: c.F, rgba: renderFrame(c.tm, c.ppv, c.F, ang, c.outline) };
}

/** Andockpunkte des Modells (Feld "sockets", Meter relativ zum Modellanker) -> Pixel relativ zum Rahmenmittelpunkt bei Stufe 0 (Bug +x, y unten). */
function socketsPx(c) {
  const sk = c.model.sockets, an = c.model.anchor;
  if (!sk || !an) return null;
  const s = voxelSize(c.model.tier), cx = (c.tm.b.min[0] + c.tm.b.max[0] + 1) / 2, cz = (c.tm.b.min[2] + c.tm.b.max[2] + 1) / 2;
  const out = {};
  for (const [k, v] of Object.entries(sk)) {
    const vx = an[0] + v[0] / s, vz = an[2] + v[2] / s;
    out[k] = [+((vz - cz) * c.ppv).toFixed(2), +((cx - vx) * c.ppv).toFixed(2)];
  }
  return out;
}

export async function buildSprite(lib, klasse, setId) {
  const c = await prepare(lib, klasse, setId), { F } = c;
  const rows = Math.ceil(STEPS / COLS), W = F * COLS, Hh = F * rows, sheet = new Uint8ClampedArray(W * Hh * 4);
  for (let b = 0; b < STEPS; b++) {
    const fr = renderFrame(c.tm, c.ppv, F, (b / STEPS) * Math.PI * 2, c.outline), ox = (b % COLS) * F, oy = Math.floor(b / COLS) * F;
    for (let y = 0; y < F; y++) sheet.set(fr.subarray(y * F * 4, (y + 1) * F * 4), ((oy + y) * W + ox) * 4);
  }
  const png = encodePng(W, Hh, Buffer.from(sheet.buffer));
  const sock = socketsPx(c);
  return {
    png,
    entry: {
      klasse, volk: c.set.volk, set: setId, model: c.id, palette: c.palette,
      file: `schiff/${klasse}/${setId}.png`, steps: STEPS, cols: COLS, rows, frame: [F, F], anchor: [F / 2, F / 2],
      lengthPx: c.lenPx, widthPx: Math.round(c.widM * c.ppm), lengthM: +c.lenM.toFixed(2), pxPerMeter: +c.ppm.toFixed(4),
      heck: sock?.triebwerk_mitte || [-Math.round(c.lenPx / 2), 0],   // Triebwerksmitte relativ zum Anker bei Stufe 0 (Bug +x)
      ...(KLASSEN[klasse].params ? { params: KLASSEN[klasse].params } : {}),
      ...(sock ? { sockets: sock } : {}),
    },
  };
}

async function main() {
  const args = process.argv.slice(2), checkOnly = args.includes('--check'), filter = args.find((a) => !a.startsWith('--'));
  const lib = nodeLibrary(root);
  const all = [];
  for (const k of Object.keys(KLASSEN)) for (const s of Object.keys(SETS)) if (!KLASSEN[k].sets || KLASSEN[k].sets.includes(s)) all.push(`${k}/${s}`);
  all.sort((a, b) => { const pa = PRIO.indexOf(a), pb = PRIO.indexOf(b); return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || (a < b ? -1 : 1); });
  const want = all.filter((n) => !filter || n.includes(filter));
  const manifestPath = path.join(OUT, 'manifest.json');
  const old = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => 'null')) || { sprites: {} };
  const sprites = { ...old.sprites };
  let diff = 0, fail = 0, bytes = 0;
  for (const name of want) {
    const [klasse, setId] = name.split('/'), t0 = performance.now();
    let r;
    try { r = await buildSprite(lib, klasse, setId); } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); fail++; continue; }
    sprites[name] = r.entry; bytes += r.png.length;
    const f = path.join(OUT, r.entry.file), cur = await fs.readFile(f).catch(() => null);
    const same = cur && cur.equals(r.png);
    if (!same) diff++;
    if (!checkOnly && !same) { await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, r.png); }
    lib.buildCache.clear();
    console.log(`  ${same ? '=' : checkOnly ? '≠' : '✓'} ${name}  ${r.entry.frame[0]}px-Rahmen, ${(r.png.length / 1024).toFixed(0)} KB, ${Math.round(performance.now() - t0)} ms`);
  }
  const manifest = {
    format: 1,
    note: 'generiert von tools/sprites.mjs (npm run sprites) – nicht von Hand ändern. Stufe b: Schiff um b/steps·2π gedreht (Canvas, y nach unten), Bug bei 0 nach +x.',
    steps: STEPS, cols: COLS, sprites: Object.fromEntries(Object.keys(sprites).sort().map((k) => [k, sprites[k]])),
  };
  const text = JSON.stringify(manifest, null, 2) + '\n';
  if (checkOnly) { const cur = await fs.readFile(manifestPath, 'utf8').catch(() => ''); if (cur !== text) { diff++; console.log('  ≠ manifest.json'); } }
  else await fs.writeFile(manifestPath, text);
  console.log(`${fail || (checkOnly && diff) ? '✗' : '✓'} ${want.length} Sprites, ${(bytes / 1024 / 1024).toFixed(1)} MB${checkOnly ? (diff ? ` – ${diff} Abweichungen` : ' – unverändert') : ''}`);
  if (fail || (checkOnly && diff)) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
