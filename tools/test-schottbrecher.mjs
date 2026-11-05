// MON-02 Station-Monster "Schottbrecher": Rig, Posen (mit shift), Modell, Kreisregel, Dreiecksbudget, Farben, Kontrast, Determinismus.
// Aufruf: node tools/test-schottbrecher.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/ aus dem Repo (nichts wird geschrieben).
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { nodeLibrary, listAssets } from './fs-io.js';
import { meshGrid } from '../core/mesher.js';
import { poseWerte, gelenkMatrizen, weltPunkt } from './cha-pose.mjs';
import { SB_FIGUR, KREIS_MITTE_MAX, ZUSTAENDE, PHASEN, ladeSB, teileSB, posiereSB, messeSB } from './schottbrecher-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  (ist ${JSON.stringify(a)}, soll ${JSON.stringify(b)})`}`);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const kanon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

const lib = nodeLibrary(root), idx = await listAssets(root);
const { fig, rig, posen } = await ladeSB(lib);
for (const id of idx.models.filter((m) => m.startsWith('station/schottbrecher/'))) await lib.load('models', id);
await lib.load('figures', 'lerche/crew_0');
const pro = teileSB(lib);
const P = posen.poses;
const phasenVon = (p) => (p.cycle ? PHASEN : [undefined]);

console.log('\n== human unverändert');
{
  // Hash des geparsten Inhalts (unabhängig von Zeilenenden), ermittelt vor MON-02 (Voxelwerk a3d37aa)
  const roh = (p) => JSON.parse(fs.readFileSync(path.join(root, 'assets', p), 'utf8'));
  ok(sha(kanon(roh('rigs/human.json'))) === 'dc26356016c1bb11', `assets/rigs/human.json unverändert (Hash ${sha(kanon(roh('rigs/human.json')))})`);
  ok(sha(kanon(roh('poses/human.json'))) === 'd71a9e660e8b3435', `assets/poses/human.json unverändert (Hash ${sha(kanon(roh('poses/human.json')))})`);
  ok(!JSON.stringify(roh('poses/human.json')).includes('"shift"'), 'poses/human.json kennt kein shift (human arbeitet weiter mit lift)');
}

console.log('\n== Rig schottbrecher: Gelenkhierarchie');
{
  const J = rig.joints, namen = Object.keys(J);
  ok(namen.length === 19, `19 Gelenke inkl. root (ist ${namen.length})`);
  eq(namen.filter((n) => !J[n].parent), ['root'], 'nur root hat kein Elterngelenk');
  ok(namen.every((n) => n === 'root' || J[J[n].parent]), 'jedes Gelenk hat ein vorhandenes Elterngelenk');
  const zyklus = (n) => { const gesehen = new Set(); for (let c = n; c; c = J[c].parent) { if (gesehen.has(c)) return true; gesehen.add(c); } return false; };
  ok(!namen.some(zyklus), 'keine Zyklen in der Hierarchie');
  ok(namen.every((n) => { let c = n; while (J[c].parent) c = J[c].parent; return c === 'root'; }), 'jede Kette endet an root');
  eq(['hull', 'sensor', 'lampe', 'horchL', 'horchR', 'schild'].filter((n) => !J[n]), [], 'Rumpf, Sensorkopf, Lampe, zwei Horchplatten und Schild sind Gelenke');
  const beine = ['VL', 'VR', 'HL', 'HR'];
  ok(beine.every((b) => J['hip' + b] && J['knee' + b] && J['foot' + b] && J['knee' + b].parent === 'hip' + b && J['foot' + b].parent === 'knee' + b && J['hip' + b].parent === 'hull'), 'vier Beine mit Hüfte - Knie - Fuß als Kette unter hull');
  ok(beine.every((b) => (b[1] === 'L' ? 1 : -1) * J['hip' + b].at[0] > 0), 'links = +x, rechts = -x');
  ok(beine.every((b) => b[1] === 'R' ? J['hip' + b].at[0] === -J['hip' + b.replace('R', 'L')].at[0] && J['knee' + b].at[0] === -J['knee' + b.replace('R', 'L')].at[0] && J['foot' + b].at[0] === -J['foot' + b.replace('R', 'L')].at[0] : true), 'rechte Gelenke = linke gespiegelt (x -> -x)');
  ok(beine.every((b) => J['knee' + b].at[1] > J.hull.at[1] + 8 + 1), 'Knie liegen hoch über der Wanne (Wannenoberkante bei y 19, Knie y 21,5)');
  eq(Object.keys(fig.parts).sort(), namen.filter((n) => n !== 'root').sort(), 'jedes Gelenk außer root hat ein Teil, Teile nur an vorhandenen Gelenken');
  ok(rig.poses === 'schottbrecher' && posen.rig === 'schottbrecher', 'Rig verweist auf poses/schottbrecher, die Posen auf das Rig');
}

console.log('\n== Lichtquelle (Marker lampe)');
{
  const L = rig.lichtquelle, a = L.achse;
  ok(L.gelenk === 'lampe' && rig.joints.lampe.parent === 'sensor', 'lichtquelle.gelenk = lampe, Kind des Sensorkopfes (schwenkt mit)');
  ok(Math.abs(Math.hypot(...a) - 1) < 0.01, `Kegelachse ist ein Einheitsvektor (${a})`);
  ok(a[2] > 0.8 && a[1] < 0 && a[1] > -0.6, 'Kegelachse zeigt nach vorn und leicht nach unten');
  ok(rig.joints.lampe.at[2] >= 5 && rig.joints.lampe.at[0] === 0, 'Lampe sitzt mittig an der Front des Sensorkopfes');
  const v = pro.lampe, schlitz = v.filter((x) => x.y < 23), feld = v.filter((x) => x.y >= 23);
  ok(v.length === 10 && v.every((x) => x.e > 0), 'Teil lampe: 10 Voxel (Schlitz 4×2 und Lichtfeld 2×1), alle leuchtend (emit)');
  const c = schlitz.reduce((s, x) => [s[0] + x.x + 0.5, s[1] + x.y + 0.5, s[2] + x.z + 0.5], [0, 0, 0]).map((x) => x / schlitz.length);
  ok(schlitz.length === 8 && Math.abs(c[0] - rig.joints.lampe.at[0]) < 0.6 && Math.abs(c[1] - rig.joints.lampe.at[1]) < 0.6, `Schlitz-Mitte (${c.map((x) => x.toFixed(1))}) liegt am Gelenk lampe`);
  // Lichtfeld oben auf dem Sensorkopf: 2×1 Voxel, bündig im Dach (höchste Voxelebene des Kopfes), also aus 57° von allen Seiten sichtbar
  const kopfMaxY = Math.max(...pro.sensor.map((x) => x.y), ...feld.map((x) => x.y));
  ok(feld.length === 2 && feld.every((x) => x.y === kopfMaxY) && new Set(feld.map((x) => x.z)).size === 1 && Math.abs(feld[0].x - feld[1].x) === 1, 'Lichtfeld: 2×1 Voxel in der obersten Ebene des Sensorkopfes (Dach), Teil des Gelenks lampe');
  ok(pro.sensor.every((x) => !feld.some((f) => f.x === x.x && f.y === x.y && f.z === x.z)), 'Dach des Sensorkopfes ist an den Feldzellen ausgespart (keine überlagerten Voxel, kein Z-Fighting)');
  ok(Object.entries(pro).filter(([j]) => j !== 'lampe').every(([, vs]) => vs.every((x) => !(x.e > 0))), 'nur der Lichtschlitz leuchtet');
}

console.log('\n== Posen: Gültigkeit');
{
  eq(ZUSTAENDE.filter((z) => !P[z]), [], 'fünf Zustände: patrouille, laerm, jagd, rammen, pause');
  const gelenkeVon = (p) => [...Object.keys(p.joints || {}), ...Object.keys(p.shift || {}), ...Object.keys(p.cycle?.joints || {}), ...Object.keys(p.cycle?.shift || {})];
  ok(Object.values(P).every((p) => gelenkeVon(p).every((j) => rig.joints[j])), 'alle Gelenke in joints, shift und cycle gibt es im Rig');
  ok(Object.values(P).every((p) => Object.values(p.joints || {}).every((w) => w.length === 3 && w.every(Number.isFinite) && w.every((x) => Math.abs(x) <= 120))), 'Winkel sind [x, y, z] in Grad, höchstens 120');
  ok(Object.entries(P).every(([, p]) => p.look === false && p.breathe === 0), 'look false, breathe 0 (kein Atmen: Maschine; applyPose wirkt dann nur über joints und shift)');
  // Teleskop und Schild in ihren Grenzen, in allen Phasen
  let fMin = 1e9, fMax = -1e9, sMin = 1e9, sMax = -1e9;
  for (const z of ZUSTAENDE) for (const ph of phasenVon(P[z])) {
    const w = poseWerte(posen, z, ph);
    for (const b of ['VL', 'VR', 'HL', 'HR']) { const y = (w.shift['foot' + b] || [0, 0, 0])[1]; fMin = Math.min(fMin, y); fMax = Math.max(fMax, y); }
    const s = (w.shift.schild || [0, 0, 0])[2]; sMin = Math.min(sMin, s); sMax = Math.max(sMax, s);
  }
  ok(fMin >= -1.5 && fMax <= 9, `Teleskop foot*.shift y in [-1,5 .. 9] (Stange bleibt in der Hülse und unter der Kniekappe; negativ = ausgefahren): ${fMin.toFixed(2)} bis ${fMax.toFixed(2)}`);
  ok(sMin >= 0 && sMax <= 4, `Schild ausfahren schild.shift z in [0, 4] (4 = Kreisrand): ${sMin} bis ${sMax}`);
  // Inhalt der Zustände
  const hullY = (z) => (P[z].shift?.hull || [0, 0, 0])[1];
  ok(hullY('patrouille') === 0 && hullY('jagd') <= -5 && hullY('pause') < hullY('jagd'), `Wanne: patrouille ${hullY('patrouille')}, jagd ${hullY('jagd')} (mindestens 5 tiefer), pause ${hullY('pause')} (Pause fast am Boden)`);
  ok(['VL', 'VR', 'HL', 'HR'].every((b) => P.jagd.shift['foot' + b][1] === -hullY('jagd') && P.jagd.cycle.shift['foot' + b].c[1] - P.jagd.cycle.shift['foot' + b].a[1] === -hullY('jagd')), 'Jagd: Teleskope ziehen so weit ein, wie die Wanne sinkt (Sohle berührt den Boden im Zyklustiefpunkt)');
  ok(P.laerm.joints.horchL[2] < -60 && P.laerm.joints.horchR[2] > 60 && !P.patrouille.joints?.horchL, 'Lärm: Horchplatten hoch (links z < -60, rechts z > 60), sonst flach');
  const rs = P.rammen.shift.schild || [0, 0, 0];
  ok(rs[2] >= 3 && rs[2] <= 4 && rs[1] <= -1 && rs[1] >= -2 && !P.patrouille.shift?.schild, `Rammen: Schild ${rs[2]} Voxel ausgefahren und ${-rs[1]} Voxel abgesenkt, sonst eingefahren`);
  ok(P.rammen.joints.hull[0] >= 8 && P.rammen.joints.hull[0] <= 10, `Rammen: Wanne nach vorn gekippt (hull rx ${P.rammen.joints.hull[0]}°, positiv = Bug tiefer)`);
  ok(P.pause.shift.lampe?.[2] === -2 && P.pause.shift.lampe?.[1] === -2 && !P.jagd.shift?.lampe, 'Pause: Lichtschlitz und Lichtfeld 2 Voxel in den Kopf versenkt (Licht aus), sonst vorn');
  ok(P.patrouille.cycle && P.jagd.cycle && !P.laerm.cycle && !P.rammen.cycle && !P.pause.cycle, 'Zyklen nur in Patrouille und Jagd');
  ok(P.jagd.cycle.hz > P.patrouille.cycle.hz * 1.8, `Jagd-Zyklus schneller (${P.jagd.cycle.hz} Hz gegen ${P.patrouille.cycle.hz} Hz)`);
  ok(P.jagd.cycle.joints.hipVL.a[0] < P.patrouille.cycle.joints.hipVL.a[0], `Jagd: längere Schritte (Hüftausschlag ${-P.jagd.cycle.joints.hipVL.a[0]}° gegen ${-P.patrouille.cycle.joints.hipVL.a[0]}°)`);
  ok(-P.jagd.cycle.joints.hipVL.a[0] <= 16, 'Jagd: Hüftausschlag höchstens ±16° (keine Scherenbeine, Tempo kommt aus dem Teleskop)');
  // Diagonale Beinpaare
  const ph = (z, j) => P[z].cycle.joints[j].p;
  ok(['patrouille', 'jagd'].every((z) => ph(z, 'hipVL') === ph(z, 'hipHR') && ph(z, 'hipVR') === ph(z, 'hipHL') && Math.abs(ph(z, 'hipVL') - ph(z, 'hipVR')) === 180), 'Zyklus: diagonale Beinpaare (VL+HR, VR+HL) gegeneinander um 180°');
}

console.log('\n== Posen: Zyklen periodisch');
{
  const gleich = (a, b) => ['joints', 'shift'].every((k) => Object.keys({ ...a[k], ...b[k] }).every((j) => (a[k][j] || [0, 0, 0]).every((v, i) => Math.abs(v - (b[k][j] || [0, 0, 0])[i]) < 1e-9))) && Math.abs(a.lift - b.lift) < 1e-9;
  for (const z of ['patrouille', 'jagd']) {
    const kmin = Math.min(...[...Object.values(P[z].cycle.joints), ...Object.values(P[z].cycle.shift || {})].map((c) => c.k || 1));
    const periode = 1 / kmin;
    ok([0, 0.1, 0.37, 0.5, 0.81].every((p) => gleich(poseWerte(posen, z, p), poseWerte(posen, z, p + periode))), `${z}: Zyklus wiederholt sich nach ${periode} Phase(n) (kleinster k-Faktor ${kmin})`);
    ok(!gleich(poseWerte(posen, z, 0.1), poseWerte(posen, z, 0.1 + periode / 2)) || periode === 1, `${z}: eine halbe Periode später ist die Pose eine andere`);
  }
  const w0 = poseWerte(posen, 'patrouille', 0), w5 = poseWerte(posen, 'patrouille', 0.5);
  ok(Math.abs(w0.joints.hipVL[0] + w0.joints.hipHR[0]) < 1e-9 && Math.abs(poseWerte(posen, 'patrouille', 0.25).joints.hipVL[0] + poseWerte(posen, 'patrouille', 0.25).joints.hipVR[0]) < 1e-9, 'Diagonalpaare schwingen gegenphasig (hipVL = -hipVR)');
  ok(w0.shift.footVL[1] !== w5.shift.footVL[1], 'Teleskop-Fuß hebt und senkt sich im Zyklus');
  // Ohne phi liefert poseWerte die Grundwerte (Standbild)
  eq(poseWerte(posen, 'jagd').shift.hull, [0, -5, 0], 'poseWerte ohne φ: Grundwerte der Pose (hull -5)');
  eq(poseWerte(posen, 'rammen').shift.schild, P.rammen.shift.schild, 'poseWerte: shift schild wie in der Pose');
}

console.log('\n== Kreisregel und Boden (Voxelmitte + 0,707 ≤ 16 Voxel von der Fußabdruck-Mitte; gemessen mit der Posenanwendung)');
const mass = {};
{
  console.log(`      Grenze: Voxelmitte ≤ ${KREIS_MITTE_MAX.toFixed(2)} Voxel (16 - halbe Würfeldiagonale 0,707)`);
  let worst = 0;
  const zeilen = [];
  for (const z of ['ruhe', ...ZUSTAENDE]) {
    const pose = z === 'ruhe' ? 'patrouille' : z;
    let m = null;
    const phasen = z === 'ruhe' ? [undefined] : phasenVon(P[pose]);
    for (const ph of phasen) {
      const { punkte } = posiereSB(rig, posen, pro, pose, ph);
      const x = messeSB(punkte);
      if (!m || x.rMax > m.rMax) m = { ...x, ph };
    }
    mass[z] = m; worst = Math.max(worst, m.rMax);
    zeilen.push(`${z.padEnd(10)} größter Abstand ${m.rMax.toFixed(2)} Voxel (${m.rGelenk}${m.ph !== undefined ? ', φ ' + m.ph : ''}), Breite ${m.breite.toFixed(1)}, Tiefe ${m.tiefe.toFixed(1)}, Höhe ${m.yMax.toFixed(1)}, tiefster Punkt ${m.yMin.toFixed(2)}`);
  }
  for (const l of zeilen) console.log('      ' + l);
  ok(['ruhe', ...ZUSTAENDE].every((z) => mass[z].rMax <= KREIS_MITTE_MAX), `alle Posen (Ruhe, fünf Zustände, 16 Zyklusphasen): Voxel höchstens 1,0 m von der Mitte (größter Wert ${worst.toFixed(2)} Voxel = ${(worst / 16).toFixed(2)} m)`);
  const rSchild = Math.max(...posiereSB(rig, posen, pro, 'rammen').punkte.filter((p) => p.j === 'schild').map((p) => Math.hypot(p.x, p.z)));
  ok(rSchild >= 14.5 && rSchild <= KREIS_MITTE_MAX, `Rammen: der Schild reicht bis an den Kreis (äußerster Schildvoxel ${rSchild.toFixed(2)} von ${KREIS_MITTE_MAX.toFixed(2)} Voxel), nicht darüber`);
  // Breite: die Maschine soll gut doppelt so breit wie die Spielfigur wirken (Skizze 2 m; hier mindestens 1,7 m in allen Posen)
  ok(['ruhe', 'laerm', 'rammen', 'jagd', 'patrouille', 'pause'].every((z) => mass[z].breite >= 27), `Silhouette mindestens 27 Voxel = 1,7 m breit (Ruhe ${mass.ruhe.breite} = ${(mass.ruhe.breite / 16).toFixed(2)} m, Pause ${mass.pause.breite.toFixed(1)})`);
  // Rammen gegen Stehen: mittlere Voxelverschiebung (gleiche Voxel in beiden Posen), Schild tief
  {
    const a = posiereSB(rig, posen, pro, 'laerm').punkte, b = posiereSB(rig, posen, pro, 'rammen').punkte;
    const d = a.reduce((s, p, i) => s + Math.hypot(p.x - b[i].x, p.y - b[i].y, p.z - b[i].z), 0) / a.length;
    const sy = Math.min(...b.filter((p) => p.j === 'schild').map((p) => p.y - 0.5));
    console.log(`      Rammen gegen Stehen: mittlere Voxelverschiebung ${d.toFixed(2)} Voxel (${(d / 16 * 100).toFixed(0)} cm), Schildunterkante ${sy.toFixed(2)} Voxel über dem Boden (Stehen: 5)`);
    ok(d >= 1.5 && sy <= 2, 'Rammen deutlich vom Stehen unterscheidbar: mittlere Voxelverschiebung ≥ 1,5 Voxel, Schildunterkante höchstens 2 Voxel über dem Boden');
  }
  // Boden: nichts unter dem Boden (Toleranz 0,5 Voxel), Standposen berühren ihn
  ok(['ruhe', ...ZUSTAENDE].every((z) => mass[z].yMin >= -0.5), `kein Voxel unter dem Boden (tiefster Punkt ${Math.min(...['ruhe', ...ZUSTAENDE].map((z) => mass[z].yMin)).toFixed(2)} Voxel)`);
  ok(['ruhe', 'laerm', 'rammen', 'pause'].every((z) => mass[z].yMin <= 0.5), 'Standposen (Ruhe, Lärm, Rammen, Pause) stehen mit den Füßen am Boden (tiefster Punkt höchstens 0,5 über dem Boden)');
  // Höhe und Breite gegen die Designer-Vorgabe (1,4 bis 1,9 m, niedriger als die Figur mit 2,4 m)
  ok(['ruhe', 'laerm', 'rammen'].every((z) => mass[z].yMax >= 22.4 && mass[z].yMax <= 30.4) && mass.jagd.yMax >= 18.9, `Höhe 1,4 bis 1,9 m in Ruhe, Lärm, Rammen, in der Jagd mit abgesenkter Wanne mindestens 1,18 m (${['ruhe', 'laerm', 'rammen', 'jagd'].map((z) => (mass[z].yMax / 16).toFixed(2) + ' m').join(', ')}; Spielfigur 2,4 m)`);
  ok(mass.pause.yMax < mass.jagd.yMax && mass.jagd.yMax < mass.patrouille.yMax, `Höhenfolge Pause ${mass.pause.yMax.toFixed(1)} < Jagd ${mass.jagd.yMax.toFixed(1)} < Patrouille ${mass.patrouille.yMax.toFixed(1)}`);
  // Mutationsprobe: Schild 8 statt 4 Voxel ausgefahren verletzt die Regel
  const mut = structuredClone(posen); mut.poses.rammen.shift.schild = [0, 0, 8];
  const r = messeSB(posiereSB(rig, mut, pro, 'rammen').punkte).rMax;
  ok(r > KREIS_MITTE_MAX, `Mutationsprobe: Schild 8 Voxel ausgefahren → Abstand ${r.toFixed(2)} > ${KREIS_MITTE_MAX.toFixed(2)}: Regel schlägt an`);
  const mut2 = structuredClone(posen); mut2.poses.jagd.cycle.joints.hipVL.a = [-60, 0, 0];
  ok(PHASEN.some((ph) => messeSB(posiereSB(rig, mut2, pro, 'jagd', ph).punkte).rMax > KREIS_MITTE_MAX), 'Mutationsprobe: Hüftausschlag 60° in der Jagd → Regel schlägt an (Zyklusphasen werden mitgemessen)');
  const mut3 = structuredClone(posen); for (const k of ['hipVL', 'hipVR', 'hipHL', 'hipHR']) mut3.poses.patrouille.cycle.joints[k].a = [-16, 0, 0];
  ok(PHASEN.some((ph) => messeSB(posiereSB(rig, mut3, pro, 'patrouille', ph).punkte).rMax > KREIS_MITTE_MAX), 'Mutationsprobe: Hüftausschlag 16° in der Patrouille (statt 11°) → Regel schlägt an: die breite Beinstellung lässt nur kleine Schritte zu');
  const mut4 = structuredClone(posen); for (const [k, w] of Object.entries(mut4.poses.pause.joints)) if (/^(hip|knee)/.test(k)) mut4.poses.pause.joints[k] = w.map((x) => x * 2.8);
  ok(messeSB(posiereSB(rig, mut4, pro, 'pause').punkte).rMax > KREIS_MITTE_MAX, 'Mutationsprobe: Pause mit dem alten Spreizwinkel (28° statt 10°) → Regel schlägt an');
  const mut5 = structuredClone(posen); mut5.poses.rammen.joints.hipHL = [15, 0, 0]; mut5.poses.rammen.joints.hipHR = [15, 0, 0];
  ok(messeSB(posiereSB(rig, mut5, pro, 'rammen').punkte).rMax > KREIS_MITTE_MAX, 'Mutationsprobe: Rammen mit Hinterbeinen +15° (statt 0°) → Regel schlägt an (Fuß hinten verlässt den Kreis)');
}

console.log('\n== Posen verschieden (Formhash je Pose)');
{
  const hash = (z, ph) => sha(posiereSB(rig, posen, pro, z, ph).punkte.map((p) => [p.x, p.y, p.z].map((v) => Math.round(v * 10)).join(',')).sort().join(';'));
  const h = Object.fromEntries(ZUSTAENDE.map((z) => [z, hash(z)]));
  ok(new Set(Object.values(h)).size === 5, `fünf Zustände haben fünf verschiedene Formen (${ZUSTAENDE.map((z) => z + ' ' + h[z].slice(0, 6)).join(', ')})`);
  for (const z of ['patrouille', 'jagd']) {
    const hs = new Set(PHASEN.map((ph) => hash(z, ph)));
    ok(hs.size >= 8, `${z}: die 16 Zyklusphasen ergeben ${hs.size} verschiedene Formen`);
  }
  ok(hash('patrouille', 0) !== hash('patrouille'), 'patrouille: Zyklusphase 0 unterscheidet sich vom Standbild (Teleskop-Hub)');
}

console.log('\n== Modell: Voxel, Dreiecke, Farben, Symmetrie, Determinismus');
{
  const baue = () => {
    lib.buildCache.clear();
    let vox = 0, tri = 0; const farben = new Map(); const alle = [];
    for (const [jn, part] of Object.entries(fig.parts)) {
      const b = lib.build(part.model, { params: lib.partParams(part.model, fig.params, part.params), palette: part.palette || fig.palette, colors: fig.colors });
      vox += b.grid.size; tri += (b.mesh.lit.indices.length + b.mesh.emit.indices.length) / 3;
      for (const v of b.grid.values()) { farben.set(v.c, (farben.get(v.c) || 0) + 1); alle.push([jn, part.mirror ? -v.x - 1 : v.x, v.y, v.z, v.c, v.e].join(',')); }
    }
    return { vox, tri, farben, hash: sha(alle.sort().join(';')) };
  };
  const a = baue(), b = baue();
  console.log(`      ${a.vox} Voxel, ${a.tri} Dreiecke (Teile einzeln vernetzt; die Pose ändert nur die Lage, nicht die Zahl), ${a.farben.size} verschiedene Farben`);
  ok(a.tri >= 1200 && a.tri <= 3500, `Dreiecke ${a.tri}: Untergrenze 1 200, Budget unter 3 500`);
  ok(a.vox <= 4000, `Voxel ${a.vox} ≤ 4000 (BUDGET.bauVoxel aus tools/cha-lib.mjs, gilt für alle Figuren in npm run check)`);
  ok(a.hash === b.hash && a.vox === b.vox, `Determinismus: zweimal gebaut (Cache geleert) → derselbe Hash ${a.hash}`);
  // Farben: nur unbunte Stahltöne und das weiße Licht (Funktionsfarben Rot, Violett, Mint, Eisblau, Bernstein verboten)
  const chroma = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255; return Math.max(r, g, bl) - Math.min(r, g, bl); };
  const maxChroma = Math.max(...[...a.farben.keys()].map(chroma));
  ok(maxChroma <= 14, `alle ${a.farben.size} Voxelfarben unbunt (größte Buntheit max-min ${maxChroma} von 255): kein Rot, Violett, Mint, Eisblau, Bernstein`);
  const rot = [...a.farben.keys()].filter((c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255; return r > g + 20 && r > bl + 20; });
  eq(rot, [], 'keine Voxelfarbe mit rotem Übergewicht');
  // Rollen der Palette wie in der Notiz
  const pal = lib.palette('schottbrecher').roles, hex = (r) => '#' + pal[r].c.toString(16).padStart(6, '0');
  eq(['panzer', 'hydraulik', 'schild', 'licht'].map(hex), ['#484c52', '#222428', '#949694', '#faf8ee'], 'Palette: Panzerstahl (72,76,82), Hydraulik (34,36,40), Schild blank (148,150,148), Licht (250,248,238)');
  // Kontrast Schild gegen Wanne in Graustufen (Luminanz nach Rec. 601, 0..255)
  const lum = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255; return 0.299 * r + 0.587 * g + 0.114 * bl; };
  const mittel = (jn) => { const l = pro[jn].filter((v) => !(v.e > 0)).map((v) => lum(v.c)); return l.reduce((s, x) => s + x, 0) / l.length; };
  const lSchild = mittel('schild'), lWanne = mittel('hull'), lBoden = 0.299 * 64 + 0.587 * 70 + 0.114 * 81;
  console.log(`      mittlere Luminanz: Schild ${lSchild.toFixed(0)}, Wanne ${lWanne.toFixed(0)}, Stationsboden dunkel ${lBoden.toFixed(0)}, Wannen-Deckplatte ${lum(lib.palette('schottbrecher').roles.panzer_light.c).toFixed(0)}`);
  ok(lSchild - lWanne >= 40, `Schild gegen Wanne: ${(lSchild - lWanne).toFixed(0)} Graustufen Unterschied (≥ 40)`);
  ok(lSchild - lBoden >= 50, `Schild gegen dunklen Boden: ${(lSchild - lBoden).toFixed(0)} Graustufen Unterschied (≥ 50)`);
  // Symmetrie der Ruhelage: links = rechts (x -> -x-1), auch in den Farben
  const alle = Object.values(pro).flat(), set = new Map(alle.map((v) => [v.x + ',' + v.y + ',' + v.z, v.c]));
  const asym = [...set].filter(([k, c]) => { const [x, y, z] = k.split(',').map(Number); return set.get((-x - 1) + ',' + y + ',' + z) !== c; }).length;   // Zellen (bei Überlappung gewinnt das spätere Teil, auf beiden Seiten gleich)
  ok(asym === 0, `Ruhelage spiegelsymmetrisch (x → -x-1) samt Farben (${asym} abweichende Voxel)`);
  // keine Schwachstellen-Marken: nichts leuchtet außer dem Lichtschlitz, kein Teil heißt Maul, Öffnung, Waffe
  ok(!/maul|oeffnung|öffnung|waffe|schwach|ladung/i.test(JSON.stringify(fig) + JSON.stringify(rig.joints)), 'keine Teile oder Gelenke für Maul, Öffnung, Waffe, Schwachstelle, Ladung');
  // Ausfahrt: das Schild-Modell bei ausfahrt = 0 sitzt 4 Voxel weiter vorn; Standard (4) ist die Ruhelage
  const s0 = lib.build('station/schottbrecher/schild', { params: { ausfahrt: 0 }, palette: 'schottbrecher' }).grid.bounds(), s4 = lib.build('station/schottbrecher/schild').grid.bounds();
  ok(s0.max[2] - s4.max[2] === 4, 'Parameter ausfahrt des Schild-Modells: 0 liegt 4 Voxel weiter vorn als der Standard 4');
}

console.log('\n== Posenanwendung in three.js (render/voxel-three.js applyPose mit shift) gegen die Node-Anwendung');
{
  const tUrl = pathToFileURL(path.join(root, 'vendor', 'three.module.js')).href;
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:${JSON.stringify(tUrl)},shortCircuit:true}; return n(s,c); }`));
  const V = await import(pathToFileURL(path.join(root, 'render', 'voxel-three.js')).href);
  const fo = V.figureObject(lib, SB_FIGUR, { phase: 0 });
  const eckenVon = (jn, M) => {
    const set = new Set();
    for (const v of pro[jn]) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) set.add(weltPunkt(rig, M, jn, [v.x + dx, v.y + dy, v.z + dz]).map((a) => Math.round(a * 1e3)).join(','));
    return set;
  };
  const fehlend = (jn, ecken) => {
    const modell = fo.joints[jn].children.find((c) => c.userData.voxels !== undefined), meshes = modell.children.filter((c) => c.isMesh);
    let n = 0, gesamt = 0;
    for (const mesh of meshes) {
      const pos = mesh.geometry.getAttribute('position'), w = mesh.position.clone();
      for (let i = 0; i < pos.count; i++) { w.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); gesamt++; if (!ecken.has([w.x, w.y, w.z].map((a) => Math.round(a / fo.s * 1e3)).join(','))) n++; }
    }
    return { n, gesamt };
  };
  const gelenke = Object.keys(pro);
  const abgleich = (pose, phi) => {
    const w = poseWerte(posen, pose, phi);
    fo.poses.__abgleich = { joints: w.joints, shift: w.shift, lift: w.lift, breathe: 0, look: false };   // Zyklus ausgewertet wie im Client, dann an applyPose
    V.applyPose(fo, '__abgleich', 0);
    fo.root.updateMatrixWorld(true);
    const M = gelenkMatrizen(rig, w);
    let n = 0, gesamt = 0;
    for (const jn of gelenke) { const x = fehlend(jn, eckenVon(jn, M)); n += x.n; gesamt += x.gesamt; }
    return { n, gesamt };
  };
  for (const [pose, phi] of [['rammen'], ['pause'], ['laerm'], ['jagd'], ['patrouille', 0.25], ['patrouille', 0.75], ['jagd', 0.125], ['jagd', 0.6]]) {
    const a = abgleich(pose, phi);
    eq([a.n, a.gesamt > 5000], [0, true], `${pose}${phi !== undefined ? ' φ ' + phi : ''}: alle ${a.gesamt} Netz-Eckpunkte der ${gelenke.length} Gelenke (three.js: YXZ, shift, Spiegelteile) liegen auf Voxelecken der Node-Anwendung`);
  }
  abgleich('rammen');
  const falsch = gelenke.reduce((n, jn) => n + fehlend(jn, eckenVon(jn, gelenkMatrizen(rig, poseWerte(posen, 'pause')))).n, 0);
  ok(falsch > 1000, `Positivkontrolle: three.js in rammen gegen die Matrizen für pause: ${falsch} Eckpunkte ohne Treffer`);
  // shift wirkt: ohne shift (Winkel allein) liegt der Schild nicht dort
  const w = poseWerte(posen, 'rammen'); fo.poses.__o = { joints: w.joints, lift: 0, breathe: 0, look: false };
  V.applyPose(fo, '__o', 0); fo.root.updateMatrixWorld(true);
  const ohne = gelenke.reduce((n, jn) => n + fehlend(jn, eckenVon(jn, gelenkMatrizen(rig, w))).n, 0);
  ok(ohne > 300, `Positivkontrolle: applyPose ohne shift gegen die Matrizen mit shift: ${ohne} Eckpunkte ohne Treffer (shift ist wirksam)`);
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
