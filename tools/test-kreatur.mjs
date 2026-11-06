// Test des Rudeltiers (MON-02, Richtung D "Helmhyaene"): kreatur/rudeltier (Koerper, Teilmodell kreatur/rudeltier_koerper)
// und kreatur/rudeltier_marken (Ladungsmarken), Palette kreatur – mit Mutationsproben (absichtlich verletzte Rezepte muessen rot werden).
// Aufruf: node tools/test-kreatur.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/, schreibt nichts.
//
// Mass: 1 Voxel = 1/16 m. Die Mitte des Fussabdrucks ist der Anker (0,0,0): ein Voxel (x,z) hat seine Mitte bei (x+0,5 | z+0,5).
// Kreisregel: Voxelmitte hoechstens 8 Voxel (0,5 m) vom Anker. Dreiecke wie im Prueafbogen: 2 x (Quads lit + emit) des Netzes mit AO.
// Luminanz: Graustufen wie der CSS-Filter grayscale (Rec.709-Gewichte auf den sRGB-Werten), Relativ-Luminanz (linear) fuer die Fellvarianten.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const kurz = (fehler) => fehler.slice(0, 3).join(' | ') + (fehler.length > 3 ? ` … (${fehler.length} Meldungen)` : '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);
const IDS = { rudel: 'kreatur/rudeltier', koerper: 'kreatur/rudeltier_koerper', marken: 'kreatur/rudeltier_marken', palette: 'kreatur' };
for (const id of [IDS.rudel, IDS.marken]) await lib.load('models', id);

const POSEN = [0, 1, 2, 3], FELL = [0, 1, 2, 3, 4, 5], BEIN = [0, 1], LADUNG = [0, 1, 2, 3];
const BUDGET = { tris: 2300, voxel: 700, markenTris: 300 };
const GLUT = 0xFF9A78;                              // (255,154,120), Leuchtfarbe der Marken (MON-02 Nacharbeit: ohne Bloom vom Knochen getrennt)
const FUNKTION = { mint: 0x7FE0C2, eisblau: 0xA9D6E5, bernstein: 0xFFC66B, rot: 0xFF6B5E, reinrot: 0xFF4830 };   // Funktionsfarben des Spiels
const FARB_ABSTAND = 45;                            // RGB-Abstand (Euklid) mindestens
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const luma = (c) => { const [r, g, b] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const relLum = (c) => { const [r, g, b] = rgb(c); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const mittel = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Gebautes Modell als Voxelliste + Netzzahlen. */
function baue(id, params, palette) {
  const b = lib.build(id, { params, palette });
  const vox = [...b.grid.values()];
  return { vox, tris: 2 * (b.mesh.lit.quads + b.mesh.emit.quads), keys: new Set(vox.map((v) => `${v.x},${v.y},${v.z}`)), anchor: b.anchor, bounds: b.grid.bounds() };
}
function formHash(vox) {
  let h = 2166136261;
  for (const k of vox.map((v) => `${v.x},${v.y},${v.z}`).sort()) for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
const alleKoerper = (ids, f) => { for (const pose of POSEN) for (const fell of FELL) for (const bp of BEIN) f(baue(ids.rudel, { pose, fell, beinphase: bp }, ids.palette), { pose, fell, beinphase: bp }); };
const alleMarken = (ids, f) => { for (const pose of POSEN) for (const ladung of LADUNG) f(baue(ids.marken, { pose, ladung }, ids.palette), { pose, ladung }); };
const rollen = (ids) => lib.palette(ids.palette).roles;
const knochenFarben = (ids) => new Set([rollen(ids).knochen.c, rollen(ids).knochen_dunkel.c]);

/** Zusammenhangskomponenten (6er-Nachbarschaft) einer Menge von Zellschluesseln. */
function komponenten(keys) {
  const seen = new Set(), out = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    const comp = [], st = [k]; seen.add(k);
    while (st.length) {
      const c = st.pop(); comp.push(c); const [x, y, z] = c.split(',').map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = `${x + dx},${y + dy},${z + dz}`; if (keys.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } }
    }
    out.push(comp);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pruefungen: jede liefert eine Liste von Fehlermeldungen (leer = in Ordnung)
// ---------------------------------------------------------------------------------------------
/** Fussabdruck [1,1]: Anker (0,0,0), alle Zellen in x und z innerhalb [-8, 7] (= +-0,5 m um den Anker). */
function pruefeFussabdruck(ids) {
  const f = [];
  for (const id of [ids.rudel, ids.marken]) {
    const m = lib.get('models', id);
    if (JSON.stringify(m.footprint) !== '[1,1]') f.push(`${id}: footprint ${JSON.stringify(m.footprint)} statt [1,1]`);
    if (JSON.stringify(m.anchor) !== '[0,0,0]') f.push(`${id}: Anker ${JSON.stringify(m.anchor)} statt [0,0,0]`);
    if (m.tier !== 'detail') f.push(`${id}: Stufe ${m.tier} statt detail`);
  }
  const pruefe = (b, l) => { for (const [i, n] of [[0, 'x'], [2, 'z']]) { const lo = [b.bounds.min[0], b.bounds.min[1], b.bounds.min[2]][i], hi = b.bounds.max[i]; if (lo < -8 || hi > 7) f.push(`${l}: ${n} ${lo}..${hi} ausserhalb -8..7`); } };
  alleKoerper(ids, (b, p) => pruefe(b, `Koerper ${JSON.stringify(p)}`));
  alleMarken(ids, (b, p) => pruefe(b, `Marken ${JSON.stringify(p)}`));
  alleKoerper(ids, (b, p) => { if (b.bounds.min[1] !== 0) f.push(`Koerper ${JSON.stringify(p)}: Fuesse nicht auf y 0 (${b.bounds.min[1]})`); });
  return f.slice(0, 20);
}
/** Kreisregel: jede Voxelmitte hoechstens 8 Voxel (0,5 m) vom Anker; bei acht Drehungen (45 Grad) bleiben alle Mitten in der +-0,5-m-Box (0 Ausreisser). */
function pruefeKreis(ids) {
  const f = []; let zaehler = 0, maxR = 0;
  const pruefe = (b, l) => {
    for (const v of b.vox) {
      const x = v.x + 0.5, z = v.z + 0.5, r = Math.hypot(x, z); maxR = Math.max(maxR, r);
      if (r > 8 + 1e-9) { f.push(`${l}: Voxel (${v.x},${v.y},${v.z}) ${(r / 16).toFixed(3)} m von der Mitte (erlaubt 0,5)`); continue; }
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, xr = x * Math.cos(a) - z * Math.sin(a), zr = x * Math.sin(a) + z * Math.cos(a);
        if (Math.abs(xr) > 8 + 1e-9 || Math.abs(zr) > 8 + 1e-9) { f.push(`${l}: Voxel (${v.x},${v.y},${v.z}) bei ${k * 45} Grad ausserhalb der Box`); break; }
      }
    }
    zaehler++;
  };
  alleKoerper(ids, (b, p) => pruefe(b, `Koerper ${JSON.stringify(p)}`));
  alleMarken(ids, (b, p) => pruefe(b, `Marken ${JSON.stringify(p)}`));
  return { fehler: f.slice(0, 20), zaehler, maxR };
}
/** Blick +z: der helle Block liegt vorn (Mittelpunkt in z deutlich ueber dem Rest), Nase an der vordersten Stelle, Kruppe hinten. Hundekoerper: laenger als breit. */
function pruefeBlick(ids) {
  const f = [], kn = knochenFarben(ids), nase = rollen(ids).nase.c;
  alleKoerper(ids, (b, p) => {
    const l = `Koerper ${JSON.stringify(p)}`, bone = b.vox.filter((v) => kn.has(v.c)), rest = b.vox.filter((v) => !kn.has(v.c));
    const zb = mittel(bone.map((v) => v.z)), zr = mittel(rest.map((v) => v.z));
    if (!(zb - zr >= 3)) f.push(`${l}: heller Block liegt nicht vorn (mittleres z ${zb.toFixed(1)} gegen Rest ${zr.toFixed(1)}, verlangt Abstand 3)`);
    const zmax = Math.max(...b.vox.map((v) => v.z));
    if (!b.vox.some((v) => v.c === nase && v.z === zmax)) f.push(`${l}: die Nase liegt nicht an der vordersten Zelle`);
    const zlen = b.bounds.max[2] - b.bounds.min[2] + 1, xbr = b.bounds.max[0] - b.bounds.min[0] + 1;
    if (!(zlen >= 1.4 * xbr)) f.push(`${l}: Laenge ${zlen} Voxel nicht mindestens 1,4 x Breite ${xbr} (Hund)`);
    if (rest.filter((v) => v.z >= 0).length < 20) f.push(`${l}: zu wenig Fell vorn (Schulter)`);
  });
  return f.slice(0, 20);
}
/** Budget: Voxel und Dreiecke je Kombination (Koerper + Marken zusammen unter 2300). */
function pruefeBudget(ids) {
  const f = []; let maxT = 0, maxV = 0, maxMarken = 0;
  alleMarken(ids, (m) => { maxMarken = Math.max(maxMarken, m.tris); });
  alleKoerper(ids, (b, p) => {
    maxT = Math.max(maxT, b.tris + maxMarken); maxV = Math.max(maxV, b.vox.length);
    if (b.tris + maxMarken > BUDGET.tris) f.push(`Koerper ${JSON.stringify(p)}: ${b.tris} + Marken ${maxMarken} Dreiecke ueber ${BUDGET.tris}`);
    if (b.vox.length > BUDGET.voxel) f.push(`Koerper ${JSON.stringify(p)}: ${b.vox.length} Voxel ueber ${BUDGET.voxel}`);
  });
  if (maxMarken > BUDGET.markenTris) f.push(`Marken: ${maxMarken} Dreiecke ueber ${BUDGET.markenTris}`);
  return { fehler: f.slice(0, 20), maxT, maxV, maxMarken };
}
/** Graustufen-Kontrast: Block vorn (Knochenvoxel) gegen Rumpf/Fell hinten (alle Nicht-Knochenvoxel mit z < 0): mittlere Luma mindestens Faktor 2; auch das dunkelste Knochenvoxel mindestens Faktor 2 ueber dem hellsten Fellvoxel. */
function pruefeKontrast(ids) {
  const f = []; let minFaktor = Infinity, minEinzel = Infinity; const kn = knochenFarben(ids);
  alleKoerper(ids, (b, p) => {
    const l = `Koerper ${JSON.stringify(p)}`, bone = b.vox.filter((v) => kn.has(v.c)), hinten = b.vox.filter((v) => !kn.has(v.c) && v.z < 0);
    const faktor = mittel(bone.map((v) => luma(v.c))) / mittel(hinten.map((v) => luma(v.c)));
    const einzel = Math.min(...bone.map((v) => luma(v.c))) / Math.max(...b.vox.filter((v) => !kn.has(v.c) && v.c !== rollen(ids).kralle.c && v.c !== rollen(ids).nase.c).map((v) => luma(v.c)));
    minFaktor = Math.min(minFaktor, faktor); minEinzel = Math.min(minEinzel, einzel);
    if (!(faktor >= 2)) f.push(`${l}: Graustufen-Kontrast Block gegen Rumpf hinten ${faktor.toFixed(2)} (verlangt mindestens 2)`);
    if (!(einzel >= 2)) f.push(`${l}: dunkelstes Knochenvoxel nur ${einzel.toFixed(2)} x heller als das hellste Fell (verlangt 2)`);
  });
  return { fehler: f.slice(0, 20), minFaktor, minEinzel };
}
/** Fellvarianten: sechs Toene, alle innerhalb +-8 % der mittleren Luminanz (Relativ-Luminanz und Graustufen-Luma), verschieden genug, im Modell wirklich die Rolle fell_k. */
function pruefeFell(ids) {
  const f = [], r = rollen(ids), toene = FELL.map((k) => r[`fell_${k}`]?.c);
  if (toene.some((c) => c === undefined)) return { fehler: ['Palette: fell_0 bis fell_5 fehlen'], abw: NaN, abwLuma: NaN };
  const mY = mittel(toene.map(relLum)), mL = mittel(toene.map(luma));
  const abw = Math.max(...toene.map((c) => Math.abs(relLum(c) / mY - 1))), abwLuma = Math.max(...toene.map((c) => Math.abs(luma(c) / mL - 1)));
  if (abw > 0.08) f.push(`Fellton-Luminanz weicht um ${(abw * 100).toFixed(1)} % ab (erlaubt 8 %)`);
  if (abwLuma > 0.08) f.push(`Fellton-Graustufen weichen um ${(abwLuma * 100).toFixed(1)} % ab (erlaubt 8 %)`);
  for (let a = 0; a < toene.length; a++) for (let b = a + 1; b < toene.length; b++) if (dist(toene[a], toene[b]) < 12) f.push(`Fellton ${a} und ${b} kaum zu unterscheiden (Abstand ${dist(toene[a], toene[b]).toFixed(1)})`);
  // im Modell: jedes Fell-Voxel hat genau die Farbe des gewaehlten Tons, die Formen sind gleich
  const form0 = formHash(baue(ids.rudel, { fell: 0 }, ids.palette).vox);
  for (const k of FELL) {
    const b = baue(ids.rudel, { fell: k }, ids.palette), fellVox = b.vox.filter((v) => v.c === toene[k]).length;
    if (fellVox < 200) f.push(`fell ${k}: nur ${fellVox} Voxel in der Fellfarbe (Rolle fell_${k} nicht angekommen)`);
    if (formHash(b.vox) !== form0) f.push(`fell ${k}: andere Form als fell 0 (Fell darf nur die Farbe aendern)`);
  }
  return { fehler: f, abw, abwLuma };
}
/** Marken: drei Marken 2 x 2 (flach), 2 Voxel Abstand in z, alle Posen; Ladung zaehlt genau (leuchtende Voxel = 4 x ladung, Leuchtfarbe, nur diese leuchten); sitzen auf dem Ruecken, nichts darueber. */
function pruefeMarken(ids) {
  const f = [], an = rollen(ids).marke_an;
  alleMarken(ids, (m, p) => {
    const l = `Marken ${JSON.stringify(p)}`, comps = komponenten(m.keys).map((c) => c.map((k) => k.split(',').map(Number)));
    if (m.vox.length !== 12) f.push(`${l}: ${m.vox.length} Voxel statt 12 (3 Marken zu 2 x 2)`);
    if (comps.length !== 3) { f.push(`${l}: ${comps.length} getrennte Marken statt 3`); return; }
    comps.sort((a, b) => Math.min(...a.map((c) => c[2])) - Math.min(...b.map((c) => c[2])));
    comps.forEach((c, i) => {
      const xs = new Set(c.map((v) => v[0])), ys = new Set(c.map((v) => v[1])), zs = new Set(c.map((v) => v[2]));
      if (c.length !== 4 || xs.size !== 2 || zs.size !== 2 || ys.size !== 1) f.push(`${l}: Marke ${i} ist nicht 2 x 2 x 1 flach (${xs.size} x ${zs.size} x ${ys.size}, ${c.length} Voxel)`);
    });
    for (let i = 0; i + 1 < comps.length; i++) {
      const hi = Math.max(...comps[i].map((c) => c[2])), lo = Math.min(...comps[i + 1].map((c) => c[2])), luecke = lo - hi - 1;
      if (luecke !== 2) f.push(`${l}: Abstand zwischen Marke ${i} und ${i + 1} ist ${luecke} Voxel (verlangt 2)`);
    }
    const leuchtend = m.vox.filter((v) => v.e > 0);
    if (leuchtend.length !== 4 * p.ladung) f.push(`${l}: ${leuchtend.length} leuchtende Voxel, erwartet ${4 * p.ladung}`);
    if (leuchtend.some((v) => v.c !== an.c || v.c !== GLUT)) f.push(`${l}: Leuchtfarbe nicht (255,154,120)`);
    const aus = m.vox.filter((v) => v.e === 0);
    if (aus.length !== 12 - 4 * p.ladung) f.push(`${l}: ${aus.length} dunkle Voxel, erwartet ${12 - 4 * p.ladung}`);
    // welche Marken leuchten: die ersten `ladung` von hinten
    comps.forEach((c, i) => { const e = c.some(([x, y, z]) => m.vox.find((v) => v.x === x && v.y === y && v.z === z).e > 0); if (e !== (i < p.ladung)) f.push(`${l}: Marke ${i} ${e ? 'leuchtet' : 'ist aus'}, sollte ${i < p.ladung ? 'leuchten' : 'aus sein'}`); });
    const k = baue(ids.rudel, { pose: p.pose }, ids.palette);
    comps.forEach((c, i) => {
      const gestuetzt = c.filter(([x, y, z]) => k.keys.has(`${x},${y - 1},${z}`)).length;
      if (gestuetzt < 2) f.push(`${l}: Marke ${i} schwebt (nur ${gestuetzt} von 4 Voxeln auf dem Koerper)`);
      for (const [x, y, z] of c) for (let yy = y; yy < y + 12; yy++) if (k.keys.has(`${x},${yy},${z}`)) { f.push(`${l}: Koerper bei (${x},${yy},${z}) liegt in oder ueber Marke ${i}`); break; }
    });
  });
  return f.slice(0, 20);
}
/** Sichtbarkeit von vorn: Marken muessen sich zaehlen lassen, wenn man dem Tier entgegensieht (der gefaehrliche Fall: es laeuft auf den Spieler zu).
 *  Strahlen vom Marken-Voxel nach +z (zum Betrachter), je Blickhoehe steigend um tan(Winkel) Voxel je Voxel Abstand; verdeckt, wenn eine Zelle von Koerper
 *  oder einer anderen Marke getroffen wird. Waagerecht (0 Grad) muss die vorderste Marke frei stehen (ueber dem Kragen); ab 20 Grad Blickhoehe (das Spiel schaut
 *  mit 57 Grad) muss jede Marke ganz frei sein. Dann sind bei Ladung 1, 2, 3 genau 4, 8, 12 leuchtende Voxel von vorn zu sehen. */
const SICHT = { flach: 20 };
function sichtbar(koerperKeys, marken, grad) {
  const t = Math.tan(grad * Math.PI / 180), platz = (v) => Math.floor((v.z + 8) / 4);   // welche der drei Marken (z -8..-7, -4..-3, 0..1)
  return marken.filter((v) => {
    for (let dz = 1; dz < 24; dz++) {
      const y = Math.floor(v.y + 0.5 + t * dz);
      if (koerperKeys.has(`${v.x},${y},${v.z + dz}`)) return false;
      if (marken.some((m) => m.x === v.x && m.y === y && m.z === v.z + dz && platz(m) !== platz(v))) return false;
    }
    return true;
  });
}
function pruefeSicht(ids) {
  const f = [], zahlen = {};
  for (const pose of POSEN) {
    const k = baue(ids.rudel, { pose }, ids.palette).keys;
    for (const ladung of LADUNG) {
      const m = baue(ids.marken, { pose, ladung }, ids.palette).vox, an = m.filter((v) => v.e > 0), l = `Pose ${pose} Ladung ${ladung}`;
      const flach = sichtbar(k, m, SICHT.flach).filter((v) => v.e > 0).length;
      zahlen[`${pose}/${ladung}`] = flach;
      if (flach !== an.length) f.push(`${l}: von vorn (${SICHT.flach} Grad) nur ${flach} von ${an.length} leuchtenden Marken-Voxeln frei`);
      const waag = sichtbar(k, m, 0), vorn = m.filter((v) => v.z >= 0);
      if (vorn.some((v) => !waag.includes(v))) f.push(`${l}: vorderste Marke waagerecht vom Kragen verdeckt`);
    }
    // Unterscheidbar: Ladung 1, 2, 3 ergeben von vorn verschiedene, wachsende Zahlen
    const z = [1, 2, 3].map((l) => zahlen[`${pose}/${l}`]);
    if (!(z[0] < z[1] && z[1] < z[2])) f.push(`Pose ${pose}: Ladung 1, 2, 3 von vorn nicht unterscheidbar (${z.join(', ')} Voxel)`);
  }
  return { fehler: f.slice(0, 20), zahlen };
}
/** Posen: Formhash je Pose verschieden, Beinphasen verschieden, Kopf in Pause am tiefsten, Rumpf in Pause/Aufladen tiefer, Rammen mit gestreckten Beinen (mehr z-Ausdehnung der Beine). Marken folgen der Pose. */
function pruefePosen(ids) {
  const f = [], kn = knochenFarben(ids), h = {};
  const kopfY = (b) => Math.max(...b.vox.filter((v) => kn.has(v.c) && v.z >= 3).map((v) => v.y));
  const rueckenY = (b) => mittel(b.vox.filter((v) => !kn.has(v.c) && v.z < 0).map((v) => v.y));
  const bei = {};
  for (const pose of POSEN) { const b = baue(ids.rudel, { pose }, ids.palette); h[pose] = formHash(b.vox); bei[pose] = { kopf: kopfY(b), ruecken: rueckenY(b), b }; }
  if (new Set(Object.values(h)).size !== 4) f.push(`Posen: nur ${new Set(Object.values(h)).size} verschiedene Formen fuer 4 Posen`);
  if (!(bei[0].kopf > bei[1].kopf && bei[1].kopf > bei[2].kopf)) f.push(`Kopfhoehe nimmt nicht ab (steh ${bei[0].kopf}, aufladen ${bei[1].kopf}, pause ${bei[2].kopf})`);
  if (!(bei[2].ruecken < bei[1].ruecken && bei[1].ruecken < bei[0].ruecken)) f.push(`Rueckenhoehe nimmt nicht ab (steh ${bei[0].ruecken}, aufladen ${bei[1].ruecken}, pause ${bei[2].ruecken})`);
  const kralle = rollen(ids).kralle.c, beinZ = (b) => { const z = b.vox.filter((v) => v.c === kralle).map((v) => v.z); return Math.max(...z) - Math.min(...z); };
  if (!(beinZ(bei[3].b) > beinZ(bei[0].b))) f.push(`Rammen: Beine nicht weiter gespreizt als beim Stehen (${beinZ(bei[3].b)} gegen ${beinZ(bei[0].b)})`);
  if (formHash(baue(ids.rudel, { pose: 0, beinphase: 0 }, ids.palette).vox) === formHash(baue(ids.rudel, { pose: 0, beinphase: 1 }, ids.palette).vox)) f.push('Beinphase 0 und 1 geben dieselbe Form');
  // Beine wechseln nur z (gleiche Voxelzahl pro Phase), Rumpf bleibt
  const m = new Set(POSEN.map((pose) => formHash(baue(ids.marken, { pose, ladung: 1 }, ids.palette).vox)));
  if (m.size < 3) f.push(`Marken folgen der Pose nicht (nur ${m.size} verschiedene Lagen)`);
  return { fehler: f, h };
}
/** Determinismus: gleiche Parameter geben gleiche Voxel (auch aus einer frisch geladenen Bibliothek); der Seed aendert nichts (Zufall nur ueber das Seed-System, hier ohne Wirkung). */
async function pruefeDeterminismus(ids) {
  const f = [], lib2 = nodeLibrary(root);
  for (const id of idx.palettes) await lib2.load('palettes', id);
  await lib2.put('palettes', lib.get('palettes', ids.palette));
  for (const id of [ids.koerper, ids.rudel, ids.marken]) { const m = lib.get('models', id); if (m) await lib2.put('models', structuredClone(m)); }
  const hv = (l, id, params) => formHash([...l.build(id, { params, palette: ids.palette }).grid.values()]);
  const farbe = (l, id, params) => [...l.build(id, { params, palette: ids.palette }).grid.values()].map((v) => `${v.x},${v.y},${v.z},${v.c},${v.e}`).sort().join(';');
  for (const [id, params] of [[ids.rudel, { pose: 2, fell: 4, beinphase: 1 }], [ids.rudel, { pose: 3, fell: 1 }], [ids.marken, { pose: 1, ladung: 2 }]]) {
    if (farbe(lib, id, params) !== farbe(lib2, id, params)) f.push(`${id} ${JSON.stringify(params)}: zwei Bauvorgaenge geben verschiedene Voxel`);
    if (farbe(lib, id, params) !== farbe(lib, id, { ...params, seed: 77 })) f.push(`${id} ${JSON.stringify(params)}: der Seed veraendert das Modell (soll ohne Wirkung sein)`);
    if (hv(lib, id, params) !== hv(lib2, id, params)) f.push(`${id}: Formhash unterschiedlich`);
  }
  return f;
}
/** Farben: kein Voxel nahe an Mint, Eisblau, Bernstein oder Rot (Funktionsfarben); leuchten darf nur die Marke, nur mit der Leuchtrolle; Koerper ohne Leuchten. */
function pruefeFarben(ids) {
  const f = [], gesehen = new Set();
  const pruefe = (b, l, leuchtErlaubt) => {
    for (const v of b.vox) {
      if (!leuchtErlaubt && v.e > 0) f.push(`${l}: leuchtendes Voxel (${v.x},${v.y},${v.z}) am Koerper`);
      if (gesehen.has(v.c)) continue; gesehen.add(v.c);
      for (const [n, c] of Object.entries(FUNKTION)) if (dist(v.c, c) < FARB_ABSTAND) f.push(`${l}: Farbe ${v.c.toString(16)} liegt ${dist(v.c, c).toFixed(0)} neben der Funktionsfarbe ${n} (mindestens ${FARB_ABSTAND})`);
    }
  };
  alleKoerper(ids, (b, p) => pruefe(b, `Koerper ${JSON.stringify(p)}`, false));
  alleMarken(ids, (b, p) => pruefe(b, `Marken ${JSON.stringify(p)}`, true));
  return { fehler: f.slice(0, 20), farben: gesehen.size };
}
/** Aufbau: Koerper aus einem Stueck, helle Teile (Block) nur vorn (z >= 0) und zusammenhaengend, Rumpf einfarbig (genau sechs Farben: Fell, zwei Knochentoene, Kralle, Nase, Maehne), kein Fleckenmuster. */
function pruefeAufbau(ids) {
  const f = [], r = rollen(ids), kn = knochenFarben(ids);
  alleKoerper(ids, (b, p) => {
    const l = `Koerper ${JSON.stringify(p)}`, komp = komponenten(b.keys);
    if (komp.length !== 1) f.push(`${l}: ${komp.length} Teile statt einem (schwebende Voxel)`);
    const bone = b.vox.filter((v) => kn.has(v.c));
    if (komponenten(new Set(bone.map((v) => `${v.x},${v.y},${v.z}`))).length !== 1) f.push(`${l}: der helle Block ist nicht ein einziger zusammenhaengender Block`);
    if (bone.some((v) => v.z < 0)) f.push(`${l}: helle Voxel hinten (z < 0): Panzer gehoert nach vorn`);
    const erlaubt = new Set([r[`fell_${p.fell}`].c, r.knochen.c, r.knochen_dunkel.c, r.kralle.c, r.nase.c, r.maehne.c]);
    const fremd = b.vox.filter((v) => !erlaubt.has(v.c));
    if (fremd.length) f.push(`${l}: ${fremd.length} Voxel in anderen Farben (Fleck/Rauschen), z. B. ${fremd[0].c.toString(16)}`);
    const fellVox = b.vox.filter((v) => v.c === r[`fell_${p.fell}`].c);
    if (fellVox.length < 200) f.push(`${l}: nur ${fellVox.length} Fellvoxel`);
    const hellFell = b.vox.filter((v) => !kn.has(v.c) && v.z < 0 && luma(v.c) > 100);
    if (hellFell.length) f.push(`${l}: ${hellFell.length} helle Voxel am Rumpf hinten (Schwachstelle soll dunkel sein)`);
  });
  return f.slice(0, 20);
}

// ---------------------------------------------------------------------------------------------
console.log('Rudeltier Helmhyaene (MON-02)');
const leer = (a) => (Array.isArray(a) ? a.length === 0 : a.fehler.length === 0);
const fb = pruefeFussabdruck(IDS); ok(leer(fb), `Fussabdruck [1,1], Anker (0,0,0), Zellen in x und z innerhalb -8..7, Fuesse auf y 0 (48 Koerper + 16 Marken)${fb.length ? ': ' + kurz(fb) : ''}`);
const kr = pruefeKreis(IDS); ok(leer(kr), `Kreisregel: alle Voxel hoechstens 0,5 m von der Mitte, 0 Ausreisser bei 8 Drehungen (${kr.zaehler} Modelle, groesster Abstand ${(kr.maxR / 16).toFixed(3)} m)${kr.fehler.length ? ': ' + kurz(kr.fehler) : ''}`);
const bl = pruefeBlick(IDS); ok(leer(bl), `Blick +z: heller Block vorn, Nase vorderste Zelle, Laenge mindestens 1,4 x Breite${bl.length ? ': ' + kurz(bl) : ''}`);
const bu = pruefeBudget(IDS); ok(leer(bu), `Budget: hoechstens ${bu.maxV} Voxel (Grenze ${BUDGET.voxel}), ${bu.maxT} Dreiecke Koerper + Marken (Grenze ${BUDGET.tris}), Marken ${bu.maxMarken} (Grenze ${BUDGET.markenTris})${bu.fehler.length ? ': ' + kurz(bu.fehler) : ''}`);
const ko = pruefeKontrast(IDS); ok(leer(ko), `Graustufen-Kontrast Block vorn gegen Rumpf hinten: kleinster Faktor ${ko.minFaktor.toFixed(2)} (verlangt 2), dunkelstes Knochenvoxel gegen hellstes Fell ${ko.minEinzel.toFixed(2)} (alle 48 Kombinationen)${ko.fehler.length ? ': ' + kurz(ko.fehler) : ''}`);
const fe = pruefeFell(IDS); ok(leer(fe), `Fellvarianten: 6 Toene, Luminanz hoechstens ${(fe.abw * 100).toFixed(1)} % und Graustufen ${(fe.abwLuma * 100).toFixed(1)} % vom Mittel (erlaubt 8 %), gleiche Form${fe.fehler.length ? ': ' + kurz(fe.fehler) : ''}`);
const ma = pruefeMarken(IDS); ok(leer(ma), `Marken: 3 Marken 2 x 2 mit 2 Voxeln Abstand, Ladung 0 bis 3 zaehlt genau (4 leuchtende Voxel je Stufe, Leuchtfarbe 255,154,120), sitzen auf dem Ruecken, nichts darueber (16 Faelle)${ma.length ? ': ' + kurz(ma) : ''}`);
const si = pruefeSicht(IDS); ok(leer(si.fehler), `Marken von vorn sichtbar: ab ${SICHT.flach} Grad Blickhoehe jede Marke frei, waagerecht die vorderste frei; leuchtende Voxel von vorn bei Ladung 1, 2, 3 = ${[1, 2, 3].map((l) => si.zahlen['0/' + l]).join(', ')} (Pose steh), in allen Posen wachsend${si.fehler.length ? ': ' + kurz(si.fehler) : ''}`);
const po = pruefePosen(IDS); ok(leer(po), `Posen unterscheidbar: vier Formhashes (${Object.values(po.h).join(', ')}), Kopf und Ruecken sinken, Rammen gestreckt, zwei Beinphasen, Marken folgen${po.fehler.length ? ': ' + kurz(po.fehler) : ''}`);
const de = await pruefeDeterminismus(IDS); ok(leer(de), `Determinismus: gleiche Parameter gleiche Voxel (auch frisch geladen), Seed ohne Wirkung${de.length ? ': ' + kurz(de) : ''}`);
const fa = pruefeFarben(IDS); ok(leer(fa), `Keine Funktionsfarben (Mint, Eisblau, Bernstein, Rot; Abstand mindestens ${FARB_ABSTAND}) in ${fa.farben} verwendeten Farben, nur die Marken leuchten${fa.fehler.length ? ': ' + kurz(fa.fehler) : ''}`);
const au = pruefeAufbau(IDS); ok(leer(au), `Aufbau: aus einem Stueck, ein heller Block nur vorn, Rumpf einfarbig dunkel (sechs Farben, kein Fleckenmuster, hinten nichts Helles)${au.length ? ': ' + kurz(au) : ''}`);

// Ausdehnung (Information fuer den Bericht): Modell gegen die 20-px-Kollisionsbox (32 px je Kachel, also 0,625 m)
{
  let xmin = 99, xmax = -99, zmin = 99, zmax = -99, ymax = 0;
  alleKoerper(IDS, (b) => { xmin = Math.min(xmin, b.bounds.min[0]); xmax = Math.max(xmax, b.bounds.max[0]); zmin = Math.min(zmin, b.bounds.min[2]); zmax = Math.max(zmax, b.bounds.max[2]); ymax = Math.max(ymax, b.bounds.max[1]); });
  const breite = xmax - xmin + 1, laenge = zmax - zmin + 1;
  console.log(`  i Ausdehnung: Breite ${breite} Voxel = ${(breite / 16).toFixed(3)} m = ${(breite * 2)} px, Laenge ${laenge} Voxel = ${(laenge / 16).toFixed(3)} m = ${laenge * 2} px (z ${zmin}..${zmax}), Hoehe bis ${(ymax + 1) / 16} m; Kollisionsbox 20 px = ${(20 / 32)} m`);
  ok(breite * 2 <= 20, `Breite (${breite * 2} px) passt in die 20-px-Kollisionsbox`);
  ok(laenge * 2 <= 32, `Laenge (${laenge * 2} px) innerhalb einer Kachel (32 px); die Box (20 px) ist ${laenge * 2 - 20} px kuerzer als das Modell`);
}

// ---------------------------------------------------------------------------------------------
// Mutationsproben: absichtlich verletzte Rezepte muessen rot werden
// ---------------------------------------------------------------------------------------------
console.log('\nMutationsproben');
let mutN = 0;
const roh = (id) => structuredClone(lib.get('models', id));
/** Legt eine mutierte Kopie des Modellsatzes an; `aendere` bekommt { koerper, rudel, marken, palette } (Objekte, werden veraendert). */
async function mutiere(aendere) {
  const n = ++mutN, ids = { rudel: `test/kmut${n}_rudel`, koerper: `test/kmut${n}_koerper`, marken: `test/kmut${n}_marken`, palette: `test_kmut${n}` };
  await lib.load('models', IDS.koerper);
  const s = { koerper: roh(IDS.koerper), rudel: roh(IDS.rudel), marken: roh(IDS.marken), palette: structuredClone(lib.get('palettes', IDS.palette)) };
  aendere(s);
  s.koerper.id = ids.koerper; s.rudel.id = ids.rudel; s.marken.id = ids.marken; s.palette.id = ids.palette;
  for (const o of s.rudel.ops) if (o.model === IDS.koerper) o.model = ids.koerper;
  s.rudel.palette = ids.palette; s.koerper.palette = ids.palette; s.marken.palette = ids.palette;
  await lib.put('palettes', s.palette);
  await lib.put('models', s.koerper); await lib.put('models', s.rudel); await lib.put('models', s.marken);
  return ids;
}
const finde = (m, name) => m.ops.find((o) => o.name === name);
const rot = async (name, pruefung, aendere) => {
  const ids = await mutiere(aendere); let ergebnis;
  try { ergebnis = await pruefung(ids); } catch (e) { ergebnis = [`Ausnahme: ${e.message.slice(0, 80)}`]; }
  const fehler = Array.isArray(ergebnis) ? ergebnis : ergebnis.fehler;
  ok(fehler.length > 0, `Mutation "${name}" wird erkannt${fehler.length ? ': ' + fehler[0].slice(0, 110) : ' (NICHT erkannt)'}`);
};
await rot('Kragen 8 Voxel breiter (ragt ueber den Kreis)', pruefeKreis, (s) => { finde(s.koerper, 'Knochenkragen (heller Block)').r[0] = 8.5; });
await rot('Fussabdruck: Schnauze 3 Voxel weiter vor (ueber die Kachel)', pruefeFussabdruck, (s) => { finde(s.koerper, 'Schnauze').size[2] = 6; });
await rot('Knochen dunkel (Block hebt sich nicht mehr ab)', pruefeKontrast, (s) => { s.palette.roles.knochen = '#7A6A55'; s.palette.roles.knochen_dunkel = '#6E5F4C'; });
await rot('Ein Fellton viel heller (Luminanz > 8 %)', pruefeFell, (s) => { s.palette.roles.fell_3 = '#8C8F78'; });
await rot('Rauschen im Fell (Fleckenmuster)', pruefeAufbau, (s) => { finde(s.koerper, 'Rumpf (Brust hoch, Kruppe tief)').color = { noise: ['fell', 'maehne', 'knochen_dunkel'], weights: [4, 1, 1], cell: 1 }; });
await rot('Marken mit 1 Voxel Abstand (verschmelzen)', pruefeMarken, (s) => { for (const o of s.marken.ops) o.at[2] = '3 * i - 8'; });
await rot('Marken 3 Voxel tief statt 2', pruefeMarken, (s) => { for (const o of s.marken.ops) o.size = [2, 1, 3]; });
await rot('Ladung zaehlt falsch (i <= ladung)', pruefeMarken, (s) => { finde(s.marken, 'Marke an').if = 'i <= ladung'; finde(s.marken, 'Marke aus').if = 'i > ladung'; });
await rot('Marken im Rueckenfell versunken (alte Hoehe, vom Kragen verdeckt)', pruefeSicht, (s) => { for (const o of s.marken.ops) o.at[1] = '10 + duck'; });
await rot('Kragen ragt hoch (verdeckt die vorderen Marken)', pruefeSicht, (s) => { finde(s.koerper, 'Knochenkragen (heller Block)').at[1] = 'cy + 3'; });
await rot('Maehne auf Markenhoehe (verdeckt die hinteren Marken im flachen Blick)', pruefeSicht, (s) => { finde(s.koerper, 'Maehne zwischen den Marken').at[1] = '13 + duck'; finde(s.koerper, 'Maehne zwischen den Marken').size = [2, 3, 1]; });
await rot('Pose ohne Wirkung am Koerper', pruefePosen, (s) => { s.koerper.let.duck = '0'; s.koerper.let.kopf = '0'; });
await rot('Beinphase ohne Wirkung', pruefePosen, (s) => { for (const o of s.koerper.ops) if (o.op === 'group') o.let.dz = '1'; });
await rot('Leuchtfarbe falsch (Bernstein)', pruefeMarken, (s) => { s.palette.roles.marke_an = { color: '#FFC66B', emit: 1.4 }; });
await rot('Funktionsfarbe Mint im Fell', pruefeFarben, (s) => { s.palette.roles.fell_2 = '#7FE0C2'; });
await rot('Blick nach -z (Kopf hinten)', pruefeBlick, (s) => { for (const o of s.koerper.ops) { if (o.name === 'Schaedelhelm') o.at[2] = -5; if (o.name === 'Schnauze') o.at[2] = -8; if (o.name === 'Nase') o.at[2] = -8; if (o.name === 'Knochenkragen (heller Block)' || o.name === 'Kragen Rueckseite dunkler') o.at[2] = -3; } });
await rot('Helle Voxel hinten (Schwachstelle nicht dunkel)', pruefeAufbau, (s) => { finde(s.koerper, 'Maehne zwischen den Marken').color = 'knochen'; });
await rot('Budget: Rumpf aufgeblaeht (Voxel- und Dreieckszahl)', pruefeBudget, (s) => { finde(s.koerper, 'Rumpf (Brust hoch, Kruppe tief)').r = [4.5, 4.5, 3.5]; });
await rot('Schwebende Beine (Voxel getrennt)', pruefeAufbau, (s) => { for (const o of s.koerper.ops) if (o.op === 'group') o.ops[0].at[1] = 'h - floor(h / 2) + 3'; });
await rot('Seed veraendert das Fell (Zufall ausser der Reihe)', pruefeDeterminismus, (s) => { s.koerper.jitter = 0.2; });

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
