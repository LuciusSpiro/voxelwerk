// Mini-Voxelrenderer ohne Abhängigkeiten (orthografisch, Painter-Algorithmus) + PNG-Schreiber, für Bilder der Spielerfigur (tools/cha-bilder.mjs).
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
export function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export class Canvas {
  constructor(w, h, bg = [28, 30, 36, 255]) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) this.d.set(bg, i * 4); }
  quad(p, rgb) {   // konvexes Viereck, Pixelmitten-Test
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const [x, y] of p) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    for (let y = Math.max(0, Math.floor(miny)); y <= Math.min(this.h - 1, Math.ceil(maxy)); y++) for (let x = Math.max(0, Math.floor(minx)); x <= Math.min(this.w - 1, Math.ceil(maxx)); x++) {
      const px = x + 0.5, py = y + 0.5; let pos = 0, neg = 0;
      for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (c > 1e-9) pos++; else if (c < -1e-9) neg++; }
      if (pos === 0 || neg === 0) { const o = (y * this.w + x) * 4; this.d[o] = rgb[0]; this.d[o + 1] = rgb[1]; this.d[o + 2] = rgb[2]; this.d[o + 3] = 255; }
    }
  }
  rect(x, y, w, h, rgb) { this.quad([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], rgb); }
  save(file) { fs.writeFileSync(file, encodePng(this.w, this.h, this.d)); }
}

const FACES = [  // Normalen + Eckpunkte (Einheitswürfel)
  { n: [0, 1, 0], v: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], f: 1.12 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], f: 1.0 },
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], f: 0.85 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], f: 0.78 },
  { n: [0, 0, -1], v: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], f: 0.7 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], f: 0.6 },
];
/** Zeichnet ein Gitter (Iterable von {x,y,z,c}) in ein Canvas. cam: {yaw, pitch(Grad), px (Pixel je Voxel), ox, oy (Bildschirmpunkt des Ursprungs)} */
export function drawGrid(cv, vox, cam, offset = [0, 0, 0]) {
  const ya = cam.yaw * Math.PI / 180, pi = cam.pitch * Math.PI / 180;
  const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pi), sp = Math.sin(pi);
  // Blickrichtung zur Kamera hin (Weltvektor): Kamera steht bei yaw=0 vor der Figur (+z), pitch>0 von oben
  const proj = (x, y, z) => { const rx = cy * x + sy * z, rz = -sy * x + cy * z; const ry = cp * y - sp * rz; const dz = sp * y + cp * rz; return [cam.ox + rx * cam.px, cam.oy - ry * cam.px, dz]; };
  const toCam = [-sy * cp, sp, cy * cp];
  const faces = FACES.filter((f) => f.n[0] * toCam[0] + f.n[1] * toCam[1] + f.n[2] * toCam[2] > 1e-6);
  const list = [...vox].map((v) => ({ v, d: proj(v.x + offset[0] + 0.5, v.y + offset[1] + 0.5, v.z + offset[2] + 0.5)[2] }));
  list.sort((a, b) => a.d - b.d);
  for (const { v } of list) {
    const r = (v.c >> 16) & 255, g = (v.c >> 8) & 255, b = v.c & 255;
    for (const f of faces) {
      const q = f.v.map((c) => proj(v.x + offset[0] + c[0], v.y + offset[1] + c[1], v.z + offset[2] + c[2]));
      const k = (v.e > 0 ? 1.15 : f.f);
      cv.quad(q.map((p) => [p[0], p[1]]), [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)]);
    }
  }
}

/**
 * Reihe von Figuren als PNG: je Figur eine Zelle je Blickwinkel (yaw in Grad, 0 = von vorn, 90 = von links).
 * figs = [Iterable von { x, y, z, c, e }]; crop = [yMin, yMax] schneidet einen Bereich aus (Kopfbilder).
 */
export function reihe(file, figs, { px = 11, yaws = [18, 100], pitch = 10, crop = null, bg = [38, 41, 49, 255] } = {}) {
  const fw = Math.round(px * (crop ? 11 : 17)), fh = crop ? Math.round((crop[1] - crop[0] + 4) * px) : Math.round(px * 36);
  const cv = new Canvas(figs.length * yaws.length * fw, fh, bg);
  let i = 0;
  for (const f of figs) {
    const all = [...f];
    for (const yaw of yaws) {
      const vox = crop ? all.filter((v) => v.y >= crop[0] && v.y <= crop[1]) : all;
      const oy = crop ? fh - px + crop[0] * px * Math.cos(pitch * Math.PI / 180) : fh - 1.5 * px;
      drawGrid(cv, vox, { yaw, pitch, px, ox: i * fw + fw / 2, oy });
      i++;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  cv.save(file);
}
