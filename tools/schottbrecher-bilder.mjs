// Vorschaubilder des Schottbrechers (Node-Renderer, ohne three.js und ohne Browser): 8 Blickrichtungen, die fünf Posen, Zyklus-Frames,
// Spielgröße (32 px je Kachel) in Farbe und Graustufen auf dunklem Stationsboden mit orangener Leitlinie, neben der Spielfigur (2,4 m).
// Aufruf: node tools/schottbrecher-bilder.mjs <Ausgabeordner>
// Posierte Voxel werden als gedrehte Würfel gezeichnet (Painter-Algorithmus), die Posen kommen aus tools/cha-pose.mjs (wie applyPose, mit shift).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary } from './fs-io.js';
import { Canvas } from './cha-render.mjs';
import { ladeSB, teileSB, posiereSB, ZUSTAENDE } from './schottbrecher-lib.mjs';
import { ladeFigur } from './cha-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots', 'schottbrecher'));
fs.mkdirSync(out, { recursive: true });

// Stationsboden (Farben aus den Screenshots der Designer-Notiz): dunkel = 2D/unbeleuchtet, hell = Voxelmodus beleuchtet
const BODEN = {
  dunkel: { platte: [64, 70, 81], fuge: [46, 51, 60], leit: [140, 68, 4] },
  hell: { platte: [138, 132, 121], fuge: [95, 88, 80], leit: [140, 68, 4] },
};
const FLAECHEN = [   // Normalen und Ecken des Einheitswürfels (Mittelpunkt im Ursprung)
  { n: [0, 1, 0], v: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
];
const LICHT = (() => { const v = [-0.35, 0.8, 0.5], l = Math.hypot(...v); return v.map((x) => x / l); })();
const mulv = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

/** Kamera: orthografisch, yaw 0 = Blick von +z, pitch = Höhenwinkel (Spiel: 57°). px = Pixel je Voxel. */
function kamera({ pitch = 57, px, ox, oy }) {
  const cp = Math.cos(pitch * Math.PI / 180), sp = Math.sin(pitch * Math.PI / 180);
  return { px, proj: (x, y, z) => [ox + x * px, oy - (cp * y - sp * z) * px, sp * y + cp * z], zuKamera: [0, sp, cp] };
}

/** Boden mit Platten (16 Voxel = 1 Kachel), Fugen und zwei Leitlinien; Fußabdruck-Mitte = Kachelecke. */
function boden(cv, cam, farbe, halb) {
  const quad = (x0, z0, x1, z1, col) => cv.quad([[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => cam.proj(x, 0, z).slice(0, 2)), col);
  quad(-halb, -halb, halb, halb, farbe.fuge);
  for (let tx = -halb; tx < halb; tx += 16) for (let tz = -halb; tz < halb; tz += 16) quad(tx + 0.5, tz + 0.5, tx + 15.5, tz + 15.5, farbe.platte);
  quad(-halb, 30, halb, 33, farbe.leit);          // Leitlinie quer (vor dem Monster)
  quad(-47, -halb, -44, halb, farbe.leit);        // Leitlinie längs (links)
}

/** Ein Modell (posierte Punkte) mit Drehung yaw um y, Verschiebung off und Skalierung s in das Canvas zeichnen. Liefert nichts, malt Schatten und Würfel. */
function zeichneModell(cv, cam, m, { yaw = 0, off = [0, 0, 0], s = 1, schatten = true, grau = false }) {
  const cy = Math.cos(yaw * Math.PI / 180), sy = Math.sin(yaw * Math.PI / 180);
  const dreh = (p) => [(cy * p[0] + sy * p[2]) * s + off[0], p[1] * s + off[1], (-sy * p[0] + cy * p[2]) * s + off[2]];
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  if (schatten) {
    const sh = new Set();
    for (const p of m.punkte) { const w = dreh([p.x, p.y, p.z]); sh.add(Math.round(w[0] + w[1] * 0.45) + ',' + Math.round(w[2] - w[1] * 0.3)); }
    for (const k of sh) {
      const [x, z] = k.split(',').map(Number);
      cv.quad([[x - 0.5, z - 0.5], [x + 0.5, z - 0.5], [x + 0.5, z + 0.5], [x - 0.5, z + 0.5]].map(([a, b]) => cam.proj(a, 0.02, b).slice(0, 2)), m.schattenFarbe || [30, 33, 40]);
    }
  }
  const liste = [];
  for (const p of m.punkte) {
    const R = mulMat(Ry, p.R), c = dreh([p.x, p.y, p.z]);
    liste.push({ p, R, c, d: cam.proj(c[0], c[1], c[2])[2] });
  }
  liste.sort((a, b) => a.d - b.d);
  for (const { p, R, c } of liste) {
    const r = (p.c >> 16) & 255, g = (p.c >> 8) & 255, b = p.c & 255;
    for (const f of FLAECHEN) {
      const n = mulv(R, f.n);
      if (n[0] * cam.zuKamera[0] + n[1] * cam.zuKamera[1] + n[2] * cam.zuKamera[2] <= 1e-6) continue;
      if (p.nachbar && p.nachbar(f.n)) continue;   // Fläche innerhalb des Teils verdeckt
      const k = p.e > 0 ? 1.15 : f.n[1] < 0 ? 0.55 : 0.6 + 0.55 * Math.max(0, n[0] * LICHT[0] + n[1] * LICHT[1] + n[2] * LICHT[2]);
      const q = f.v.map((v) => { const o = mulv(R, v.map((t) => t * 0.5 * s)); const w = cam.proj(c[0] + o[0], c[1] + o[1], c[2] + o[2]); return [w[0], w[1]]; });
      let col = [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)];
      if (grau) { const l = 0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2]; col = [l, l, l]; }
      cv.quad(q, col);
    }
  }
}
const mulMat = (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; };

/** Punkte mit Drehmatrix und Nachbar-Test (verdeckte Flächen innerhalb eines Teils weglassen) versehen. */
function anreichern(rig, posen, pro, name, phi) {
  const { punkte, M } = posiereSB(rig, posen, pro, name, phi);
  const sets = {};
  for (const [jn, vox] of Object.entries(pro)) sets[jn] = new Set(vox.map((v) => v.x + ',' + v.y + ',' + v.z));
  const rest = Object.entries(pro).flatMap(([jn, vox]) => vox.map((v) => ({ jn, v })));
  const aus = [];
  rest.forEach(({ jn, v }, i) => {
    const p = punkte[i];
    aus.push({ ...p, R: M[jn].R, nachbar: (n) => sets[jn].has((v.x + n[0]) + ',' + (v.y + n[1]) + ',' + (v.z + n[2])) });
  });
  return { punkte: aus };
}

const lib = nodeLibrary(root);
const { rig, posen } = await ladeSB(lib);
const pro = teileSB(lib);
// Spielfigur als Maßstab: Standardfigur der Lerche in Pose stand, auf 2,4 m skaliert (31 Voxel = 1,94 m → Faktor 1,24)
await ladeFigur(lib, 'lerche/crew_0');
const mfig = lib.get('figures', 'lerche/crew_0'), mrig = lib.get('rigs', mfig.rig), mposen = lib.get('poses', mrig.poses);
const mpro = {};
for (const [jn, part] of Object.entries(mfig.parts)) {
  const b = lib.build(part.model, { params: lib.partParams(part.model, mfig.params, part.params), palette: part.palette || mfig.palette, colors: mfig.colors });
  mpro[jn] = [...b.grid.values()].map((v) => ({ x: part.mirror ? -v.x - 1 : v.x, y: v.y, z: v.z, c: v.c, e: v.e }));
}
const mensch = () => anreichern(mrig, mposen, mpro, 'stand');
const sb = (name, phi) => anreichern(rig, posen, pro, name, phi);

/** Eine Szene (Monster in Pose und Richtung, optional Spielfigur) als Canvas. */
function szene({ pose, phi, yaw = 0, px, w, h, boden: bo = 'dunkel', mitMensch = false, pitch = 57, grau = false, oyAnteil = 0.62 }) {
  const f = BODEN[bo], cam = kamera({ pitch, px, ox: w / 2, oy: h * oyAnteil });
  const cv = new Canvas(w, h, grau ? [0, 0, 0, 255] : [14, 15, 18, 255]);
  const gf = (c) => (grau ? (() => { const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return [l, l, l]; })() : c);
  boden(cv, cam, { platte: gf(f.platte), fuge: gf(f.fuge), leit: gf(f.leit) }, 96);
  const m = sb(pose, phi);
  m.schattenFarbe = gf(bo === 'dunkel' ? [30, 33, 40] : [70, 66, 60]);
  if (mitMensch) { const h2 = mensch(); h2.schattenFarbe = m.schattenFarbe; zeichneModell(cv, cam, h2, { yaw: 160, off: [-27, 0, 6], s: 1.24, grau }); }
  zeichneModell(cv, cam, m, { yaw, grau });
  return cv;
}
const blit = (dst, src, x0, y0) => { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue; dst.d.set(src.d.subarray((y * src.w + x) * 4, (y * src.w + x) * 4 + 4), (Y * dst.w + X) * 4); } };
const gitter = (zellen, spalten, zw, zh, gap = 4) => { const rows = Math.ceil(zellen.length / spalten), cv = new Canvas(spalten * (zw + gap) + gap, rows * (zh + gap) + gap, [6, 6, 8, 255]); zellen.forEach((c, i) => blit(cv, c, gap + (i % spalten) * (zw + gap), gap + Math.floor(i / spalten) * (zh + gap))); return cv; };
const vergroessere = (src, f) => { const cv = new Canvas(src.w * f, src.h * f); for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) cv.d.set(src.d.subarray((Math.floor(y / f) * src.w + Math.floor(x / f)) * 4, (Math.floor(y / f) * src.w + Math.floor(x / f)) * 4 + 4), (y * cv.w + x) * 4); return cv; };
const speichere = (cv, name) => { cv.save(path.join(out, name)); console.log('  ', name, cv.w + '×' + cv.h); };

// 1) acht Blickrichtungen (Patrouille, Phase 0), Detailansicht
speichere(gitter([0, 45, 90, 135, 180, 225, 270, 315].map((yaw) => szene({ pose: 'patrouille', phi: 0, yaw, px: 6, w: 300, h: 250 })), 4, 300, 250), 'ansichten-8-richtungen.png');
// 2) fünf Posen (Standbilder), Detailansicht, 35° gedreht
speichere(gitter(ZUSTAENDE.map((pose) => szene({ pose, yaw: 35, px: 6, w: 300, h: 250 })), 5, 300, 250), 'posen-fuenf.png');
// 3) Zyklen: Patrouille (Periode 2 wegen Sensor-Schwenk) und Jagd, je 8 Frames
speichere(gitter([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75].map((phi) => szene({ pose: 'patrouille', phi, yaw: 90, px: 5, w: 280, h: 230, pitch: 35 })), 4, 280, 230), 'zyklus-patrouille.png');
speichere(gitter([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((phi) => szene({ pose: 'jagd', phi, yaw: 90, px: 5, w: 280, h: 230, pitch: 35 })), 4, 280, 230), 'zyklus-jagd.png');
// 4) Spielgröße: 32 px je Kachel = 2 px je Voxel. Fünf Zustände (Zeile 1), acht Richtungen in Patrouille (Zeile 2), dunkler und heller Boden, Farbe und Graustufen
for (const bo of ['dunkel', 'hell']) for (const grau of [false, true]) {
  const zeilen = [
    ZUSTAENDE.map((pose) => szene({ pose, phi: pose === 'patrouille' || pose === 'jagd' ? 0.125 : undefined, yaw: 45, px: 2, w: 160, h: 128, boden: bo, mitMensch: true, grau })),
    [0, 45, 90, 135, 180, 225, 270, 315].slice(0, 5).map((yaw) => szene({ pose: 'patrouille', phi: 0.125, yaw, px: 2, w: 160, h: 128, boden: bo, mitMensch: true, grau })),
    [225, 270, 315].map((yaw) => szene({ pose: 'patrouille', phi: 0.125, yaw, px: 2, w: 160, h: 128, boden: bo, mitMensch: true, grau })),
  ];
  const cv = gitter(zeilen.flat(), 5, 160, 128, 2);
  speichere(cv, `spielgroesse-${bo}-${grau ? 'grau' : 'farbe'}.png`);
  speichere(vergroessere(cv, 3), `spielgroesse-${bo}-${grau ? 'grau' : 'farbe'}-3x.png`);
}
// 5) Nahaufnahmen: Rammen und Pause, Ansicht von vorn-oben
speichere(gitter([['rammen', 20], ['rammen', 70], ['pause', 20], ['laerm', 20]].map(([pose, yaw]) => szene({ pose, yaw, px: 9, w: 420, h: 360, pitch: 40 })), 2, 420, 360), 'nah-rammen-pause-laerm.png');
