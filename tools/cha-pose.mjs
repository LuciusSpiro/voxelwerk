// Posen in Node (ohne three.js): Gelenkhierarchie des Rigs + Pose → Weltposition der Voxelmitten je Gelenk.
// Entspricht render/voxel-three.js applyPose (Euler YXZ um das Gelenk, lift an der Hüfte, Atmen und Blick bei t = 0 gleich null).
// Einheit: Voxel, Figur-Koordinaten wie im Rig (Füße y = 0). Verglichen wird mit three.js in tools/test-cha.mjs.
const D2R = Math.PI / 180;

/** Rotationsmatrix (zeilenweise, 9 Werte) für Euler YXZ in Grad: R = Ry · Rx · Rz (wie three.js, order 'YXZ'). */
export function eulerYXZ([rx, ry, rz]) {
  const a = Math.cos(rx * D2R), b = Math.sin(rx * D2R), c = Math.cos(ry * D2R), d = Math.sin(ry * D2R), e = Math.cos(rz * D2R), f = Math.sin(rz * D2R);
  const ce = c * e, cf = c * f, de = d * e, df = d * f;
  return [ce + df * b, de * b - cf, a * d, a * f, a * e, -b, cf * b - de, df + ce * b, a * c];
}
const mul = (A, B) => {
  const R = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return R;
};
const apply = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Winkel und lift einer Pose. posen = poses/human.json ({ poses }) oder dessen poses-Objekt; phi nur für Posen mit cycle (walk):
 * Winkel = c + a·sin(2π·φ·k + p), Hüfte += bob·(0,5 − |sin 2πφ|) (Auswertung wie ACTORS im Spiel). Ohne phi: Grundwerte der Pose.
 */
export function poseWerte(posen, name, phi) {
  const tabelle = posen.poses || posen, p = tabelle[name];
  if (!p) throw new Error(`Pose "${name}" gibt es nicht`);
  const joints = {}, shift = {};
  for (const [j, r] of Object.entries(p.joints || {})) joints[j] = [r[0], r[1], r[2]];
  for (const [j, r] of Object.entries(p.shift || {})) shift[j] = [r[0], r[1], r[2]];   // Verschiebung des Gelenks gegenüber dem Elterngelenk (Voxel), z. B. Schild ausfahren
  let lift = p.lift || 0;
  if (phi !== undefined && p.cycle?.joints) {
    for (const [j, c] of Object.entries(p.cycle.joints)) {
      const s = Math.sin(2 * Math.PI * phi * (c.k || 1) + (c.p || 0) * D2R), C = c.c || [0, 0, 0], A = c.a || [0, 0, 0];
      joints[j] = [C[0] + A[0] * s, C[1] + A[1] * s, C[2] + A[2] * s];
    }
    lift += (p.cycle.bob || 0) * (0.5 - Math.abs(Math.sin(2 * Math.PI * phi)));
  }
  if (phi !== undefined && p.cycle?.shift) {   // cycle.shift: wie cycle.joints, aber Verschiebung statt Winkel (Teleskopbeine)
    for (const [j, c] of Object.entries(p.cycle.shift)) {
      const s = Math.sin(2 * Math.PI * phi * (c.k || 1) + (c.p || 0) * D2R), C = c.c || [0, 0, 0], A = c.a || [0, 0, 0];
      shift[j] = [C[0] + A[0] * s, C[1] + A[1] * s, C[2] + A[2] * s];
    }
  }
  return { joints, lift, shift };
}

/** Weltmatrix je Gelenk { R, t }: bildet Gelenk-lokale Punkte (Figur-Koordinate minus Gelenkposition) in den Raum der Pose ab. */
export function gelenkMatrizen(rig, werte) {
  const W = {};
  const bau = (name) => {
    if (W[name]) return W[name];
    const j = rig.joints[name], at = j.at;
    if (!j.parent) return (W[name] = { R: I3, t: [at[0], at[1], at[2]] });
    const P = bau(j.parent), pa = rig.joints[j.parent].at;
    const sh = werte.shift?.[name] || [0, 0, 0];
    const lokal = [at[0] - pa[0] + sh[0], at[1] - pa[1] + sh[1] + (name === 'hips' ? werte.lift || 0 : 0), at[2] - pa[2] + sh[2]];
    const Rl = werte.joints[name] ? eulerYXZ(werte.joints[name]) : I3;
    const o = apply(P.R, lokal);
    return (W[name] = { R: mul(P.R, Rl), t: [o[0] + P.t[0], o[1] + P.t[1], o[2] + P.t[2]] });
  };
  // Wurzel steht bei at = [0,0,0]; ihre Weltposition ist der Ursprung, das Gelenk-lokale System der Wurzel gleich dem der Figur
  for (const n of Object.keys(rig.joints)) bau(n);
  return W;
}

/** Ein Punkt (Figur-Koordinaten, stetig) am Gelenk jn in den Raum der Pose. */
export function weltPunkt(rig, matrizen, jn, p) {
  const W = matrizen[jn], at = rig.joints[jn].at, o = apply(W.R, [p[0] - at[0], p[1] - at[1], p[2] - at[2]]);
  return [o[0] + W.t[0], o[1] + W.t[1], o[2] + W.t[2]];
}

/**
 * Voxelmitten einer gebauten Figur (pro: { gelenk: [{x,y,z}] } in Figur-Koordinaten, Zellen-Index) in Weltkoordinaten der Pose.
 * Rückgabe { gelenk: Float64Array [x0,y0,z0,x1,…] }.
 */
export function posiere(rig, pro, werte, matrizen = gelenkMatrizen(rig, werte)) {
  const out = {};
  for (const [jn, vox] of Object.entries(pro)) {
    const a = new Float64Array(vox.length * 3);
    for (let i = 0; i < vox.length; i++) {
      const v = vox[i], p = weltPunkt(rig, matrizen, jn, [v.x + 0.5, v.y + 0.5, v.z + 0.5]);
      a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2];
    }
    out[jn] = a;
  }
  return out;
}

/** Posenzustände der Passprobe: [{ id, pose, phi? }]. walk wird an den Extremen des cycle ausgewertet (φ = 0, ¼, ½, ¾: beide Umkehrpunkte der Oberschenkel und der Unterschenkel). */
export const PASS_ZUSTAENDE = [
  { id: 'stand', pose: 'stand' },
  { id: 'walk φ0', pose: 'walk', phi: 0 }, { id: 'walk φ¼', pose: 'walk', phi: 0.25 }, { id: 'walk φ½', pose: 'walk', phi: 0.5 }, { id: 'walk φ¾', pose: 'walk', phi: 0.75 },
  { id: 'aim', pose: 'aim' }, { id: 'aim_rifle', pose: 'aim_rifle' }, { id: 'aim_heavy', pose: 'aim_heavy' },
  { id: 'kneel', pose: 'kneel' }, { id: 'sit', pose: 'sit' }, { id: 'crouch', pose: 'crouch' },
];
