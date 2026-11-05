// Schottbrecher (Station-Monster, MON-02): Teile bauen, posieren (Node, ohne three.js) und messen. Genutzt von tools/test-schottbrecher.mjs
// und tools/schottbrecher-bilder.mjs. Die Posen werden wie in render/voxel-three.js applyPose angewandt (tools/cha-pose.mjs), dazu die
// Erweiterung `shift` (Gelenk gegenüber dem Elterngelenk verschieben, auch in cycle.shift).
import { poseWerte, gelenkMatrizen, weltPunkt } from './cha-pose.mjs';

export const SB_FIGUR = 'station/schottbrecher';
/** Kreisregel (Voxel): Fußabdruck 2×2 Kacheln = 32 Voxel Kantenlänge, Radius 16 um die Mitte (x = 0, z = 0). */
export const KREIS_R = 16;
/** Eine Voxelmitte darf höchstens so weit von der Mitte liegen, damit auch die Voxelecke (halbe Diagonale 0,707) im Kreis bleibt. */
export const KREIS_MITTE_MAX = KREIS_R - Math.SQRT1_2;
export const ZUSTAENDE = ['patrouille', 'laerm', 'jagd', 'rammen', 'pause'];

/** Lädt Figur samt Rig, Posen, Modellen. */
export async function ladeSB(lib, figId = SB_FIGUR) {
  const fig = await lib.load('figures', figId);
  const rig = lib.get('rigs', fig.rig), posen = lib.get('poses', rig.poses);
  return { fig, rig, posen };
}

/** Voxel je Gelenk in Figur-Koordinaten (Zellenindex, mit Spiegelung): { gelenk: [{x,y,z,c,e}] }. */
export function teileSB(lib, figId = SB_FIGUR) {
  const fig = lib.get('figures', figId), pro = {};
  for (const [jn, part] of Object.entries(fig.parts)) {
    const b = lib.build(part.model, { params: lib.partParams(part.model, fig.params, part.params), palette: part.palette || fig.palette, colors: fig.colors });
    pro[jn] = [...b.grid.values()].map((v) => ({ x: part.mirror ? -v.x - 1 : v.x, y: v.y, z: v.z, c: v.c, e: v.e }));
  }
  return pro;
}

/** Alle Voxel einer Pose als Weltpunkte (Voxelmitten): [{ x, y, z, c, e, j }]. phi nur für Posen mit cycle. */
export function posiereSB(rig, posen, pro, name, phi) {
  const werte = poseWerte(posen, name, phi), M = gelenkMatrizen(rig, werte), out = [];
  for (const [jn, vox] of Object.entries(pro)) {
    for (const v of vox) {
      const p = weltPunkt(rig, M, jn, [v.x + 0.5, v.y + 0.5, v.z + 0.5]);
      out.push({ x: p[0], y: p[1], z: p[2], c: v.c, e: v.e, j: jn });
    }
  }
  return { punkte: out, werte, M };
}

/** Maße einer Pose: größter Abstand der Voxelmitten von der Mitte (xz), kleinstes y, Höhe, Spannweite. */
export function messeSB(punkte) {
  let rMax = 0, rJ = '', yMin = Infinity, yMax = -Infinity, xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const p of punkte) {
    const r = Math.hypot(p.x, p.z);
    if (r > rMax) { rMax = r; rJ = p.j; }
    yMin = Math.min(yMin, p.y - 0.5); yMax = Math.max(yMax, p.y + 0.5);
    xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
  }
  return { rMax, rGelenk: rJ, yMin, yMax, breite: xMax - xMin + 1, tiefe: zMax - zMin + 1 };
}

/** Phasen, an denen Zyklen gemessen werden (Zyklen mit k = 0.5 haben Periode 2). */
export const PHASEN = Array.from({ length: 16 }, (_, i) => i / 8);
