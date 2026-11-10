// Test des Schwarms (MON-03 E, Richtung C "Myzel"): kreatur/schwarmling (+ _sporen), kreatur/koenigin (+ _sporen),
// kreatur/schwarm_fleck (Zerfall) und kreatur/myzel_faden, Palette kreatur – mit Mutationsproben
// (absichtlich verletzte Rezepte muessen rot werden).
// Aufruf: node tools/test-schwarm.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/, schreibt nichts.
//
// Mass: 1 Voxel = 1/16 m. Die Mitte des Fussabdrucks ist der Anker (0,0,0): ein Voxel (x,z) hat seine Mitte bei (x+0,5 | z+0,5).
// Kreisregel wie beim Rudeltier: Voxelmitte hoechstens halbe Kantenlaenge des Fussabdrucks vom Anker (1x1: 8 Voxel, 2x2: 16 Voxel),
// damit das Modell bei 45 Grad Drehung nicht aus dem Fussabdruck ragt. Dreiecke wie im Pruefbogen: 2 x (Quads lit + emit) des Netzes mit AO.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const kurz = (fehler) => fehler.slice(0, 3).join(' | ') + (fehler.length > 3 ? ` … (${fehler.length} Meldungen)` : '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.palettes) await lib.load('palettes', id);
const IDS = {
  s: 'kreatur/schwarmling', ss: 'kreatur/schwarmling_sporen', k: 'kreatur/koenigin', ks: 'kreatur/koenigin_sporen',
  f: 'kreatur/schwarm_fleck', fa: 'kreatur/myzel_faden', palette: 'kreatur'
};
const MODELLE = ['s', 'ss', 'k', 'ks', 'f', 'fa'];
for (const m of MODELLE) await lib.load('models', IDS[m]);

const POSEN = [0, 1, 2, 3], BEIN = [0, 1];
// Budget: das Ziel des Designers (unter ca. 120 Voxel) gilt fuer Schwarmling + Sporen; die Dreiecke liegen wegen der AO-Teilung
// der Netzflaechen (vier Einzelbeine, Stufenkuppel) bei etwa 300 + 60, nicht unter 150 (siehe AUTHORING.md, Abschnitt Schwarm)
const BUDGET = { sVoxel: 120, sTris: 340, ssTris: 80, kTris: 4300, ksTris: 400, fTris: 1000, faTris: 200, kVoxel: 6500 };
const FUNKTION = { mint: 0x7FE0C2, eisblau: 0xA9D6E5, bernstein: 0xFFC66B, rot: 0xFF6B5E, reinrot: 0xFF4830 };   // Funktionsfarben des Spiels
const RUDEL_MARKE = 0xFF9A78;                       // Leuchtfarbe der Rudeltier-Marken: der Schwarm muss sich davon unterscheiden
const FARB_ABSTAND = 45;                            // RGB-Abstand (Euklid) mindestens
const BODEN = 'soil_dark';                          // Rolle des dunklen Hoehlenbodens in den Pruefszenen (biom_vulkan)
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const luma = (c) => { const [r, g, b] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
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
const rollen = (ids) => lib.palette(ids.palette).roles;
const boden = () => lib.palette('biom_vulkan').roles[BODEN].c;
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
/** Alle Parameterfaelle der Schwarmling-Modelle (Pose x Beinphase), Koenigin und Fleck je mit ihren Parametern. */
const alleS = (ids, f) => { for (const pose of POSEN) for (const bp of BEIN) f(baue(ids.s, { pose, fell: 0, beinphase: bp }, ids.palette), baue(ids.ss, { pose, ladung: 0 }, ids.palette), { pose, beinphase: bp }); };
const alleModelle = (ids, f) => {
  alleS(ids, (b, sp, p) => { f(b, `Schwarmling ${JSON.stringify(p)}`, 's'); f(sp, `Schwarmling-Sporen ${JSON.stringify(p)}`, 'ss'); });
  f(baue(ids.k, { pose: 2 }, ids.palette), 'Koenigin', 'k'); f(baue(ids.ks, { pose: 2 }, ids.palette), 'Koenigin-Sporen', 'ks');
  for (const gross of [0, 1]) f(baue(ids.f, { gross }, ids.palette), `Fleck gross ${gross}`, 'f');
  f(baue(ids.fa, {}, ids.palette), 'Myzelfaden', 'fa');
};
const HALB = { s: 8, ss: 8, k: 16, ks: 16, f: 16, fa: 8 };   // halbe Kantenlaenge des Fussabdrucks in Voxeln
const FUSS = { s: [1, 1], ss: [1, 1], k: [2, 2], ks: [2, 2], f: [2, 2], fa: [1, 1] };

// ---------------------------------------------------------------------------------------------
// Pruefungen: jede liefert eine Liste von Fehlermeldungen (leer = in Ordnung)
// ---------------------------------------------------------------------------------------------
/** Fussabdruck, Anker (0,0,0), Stufe detail, alle Zellen innerhalb des Fussabdrucks, Kreisregel bei acht Drehungen. */
function pruefeFussabdruck(ids) {
  const f = []; let maxR = 0;
  for (const m of MODELLE) {
    const mo = lib.get('models', ids[m]);
    if (JSON.stringify(mo.footprint) !== JSON.stringify(FUSS[m])) f.push(`${ids[m]}: footprint ${JSON.stringify(mo.footprint)} statt ${JSON.stringify(FUSS[m])}`);
    if (JSON.stringify(mo.anchor) !== '[0,0,0]') f.push(`${ids[m]}: Anker ${JSON.stringify(mo.anchor)} statt [0,0,0]`);
    if (mo.tier !== 'detail') f.push(`${ids[m]}: Stufe ${mo.tier} statt detail`);
    if (mo.palette !== 'kreatur' && mo.palette !== ids.palette) f.push(`${ids[m]}: Palette ${mo.palette} statt kreatur`);
  }
  alleModelle(ids, (b, l, m) => {
    const h = HALB[m];
    for (const [i, n] of [[0, 'x'], [2, 'z']]) { const lo = b.bounds.min[i], hi = b.bounds.max[i]; if (lo < -h || hi > h - 1) f.push(`${l}: ${n} ${lo}..${hi} ausserhalb ${-h}..${h - 1}`); }
    if (m !== 'ss' && m !== 'ks' && b.bounds.min[1] !== 0) f.push(`${l}: Fuesse nicht auf y 0 (${b.bounds.min[1]})`);
    for (const v of b.vox) {
      const x = v.x + 0.5, z = v.z + 0.5, r = Math.hypot(x, z); maxR = Math.max(maxR, r / h);
      if (r > h + 1e-9) { f.push(`${l}: Voxel (${v.x},${v.y},${v.z}) ${(r / 16).toFixed(3)} m von der Mitte (erlaubt ${h / 16})`); break; }
      let aus = false;
      for (let k = 0; k < 8 && !aus; k++) { const a = (k * Math.PI) / 4, xr = x * Math.cos(a) - z * Math.sin(a), zr = x * Math.sin(a) + z * Math.cos(a); aus = Math.abs(xr) > h + 1e-9 || Math.abs(zr) > h + 1e-9; }
      if (aus) { f.push(`${l}: Voxel (${v.x},${v.y},${v.z}) bei Drehung ausserhalb des Fussabdrucks`); break; }
    }
  });
  return { fehler: f.slice(0, 20), maxR };
}
/** Budget: Voxel und Dreiecke je Fall. */
function pruefeBudget(ids) {
  const f = []; const mx = { sV: 0, sT: 0, ssT: 0, kT: 0, ksT: 0, fT: 0, faT: 0, kV: 0 };
  alleS(ids, (b, sp, p) => {
    mx.sV = Math.max(mx.sV, b.vox.length + sp.vox.length); mx.sT = Math.max(mx.sT, b.tris); mx.ssT = Math.max(mx.ssT, sp.tris);
    if (b.vox.length + sp.vox.length > BUDGET.sVoxel) f.push(`Schwarmling ${JSON.stringify(p)}: ${b.vox.length + sp.vox.length} Voxel (Grenze ${BUDGET.sVoxel})`);
    if (b.tris > BUDGET.sTris) f.push(`Schwarmling ${JSON.stringify(p)}: ${b.tris} Dreiecke (Grenze ${BUDGET.sTris})`);
    if (sp.tris > BUDGET.ssTris) f.push(`Schwarmling-Sporen ${JSON.stringify(p)}: ${sp.tris} Dreiecke (Grenze ${BUDGET.ssTris})`);
  });
  const k = baue(ids.k, { pose: 2 }, ids.palette), ks = baue(ids.ks, { pose: 2 }, ids.palette);
  mx.kT = k.tris; mx.ksT = ks.tris; mx.kV = k.vox.length;
  if (k.tris > BUDGET.kTris) f.push(`Koenigin: ${k.tris} Dreiecke (Grenze ${BUDGET.kTris})`);
  if (k.vox.length > BUDGET.kVoxel) f.push(`Koenigin: ${k.vox.length} Voxel (Grenze ${BUDGET.kVoxel})`);
  if (ks.tris > BUDGET.ksTris) f.push(`Koenigin-Sporen: ${ks.tris} Dreiecke (Grenze ${BUDGET.ksTris})`);
  for (const gross of [0, 1]) { const t = baue(ids.f, { gross }, ids.palette).tris; mx.fT = Math.max(mx.fT, t); if (t > BUDGET.fTris) f.push(`Fleck gross ${gross}: ${t} Dreiecke (Grenze ${BUDGET.fTris})`); }
  mx.faT = baue(ids.fa, {}, ids.palette).tris; if (mx.faT > BUDGET.faTris) f.push(`Myzelfaden: ${mx.faT} Dreiecke (Grenze ${BUDGET.faTris})`);
  return { fehler: f.slice(0, 20), mx };
}
/** Aufbau: Schwarmling und Koenigin aus einem Stueck; Sporen sitzen auf dem Koerper (Voxel darunter), fuenf am Schwarmling, mindestens zehn an der Koenigin; Wurzeln an der Koenigin. */
function pruefeAufbau(ids) {
  const f = [];
  alleS(ids, (b, sp, p) => {
    const l = `Schwarmling ${JSON.stringify(p)}`;
    if (komponenten(b.keys).length !== 1) f.push(`${l}: ${komponenten(b.keys).length} Teile statt einem (schwebende Beine oder Kappe)`);
    if (sp.vox.length !== 5) f.push(`${l}: ${sp.vox.length} Sporenpunkte statt 5`);
    const lose = sp.vox.filter((v) => !b.keys.has(`${v.x},${v.y - 1},${v.z}`));
    if (lose.length) f.push(`${l}: ${lose.length} Sporenpunkte ohne Kappe darunter (schweben), z. B. (${lose[0].x},${lose[0].y},${lose[0].z})`);
    if (sp.vox.some((v) => b.keys.has(`${v.x},${v.y},${v.z}`))) f.push(`${l}: Sporenpunkt steckt im Koerper`);
  });
  const k = baue(ids.k, { pose: 2 }, ids.palette), ks = baue(ids.ks, { pose: 2 }, ids.palette);
  if (komponenten(k.keys).length !== 1) f.push(`Koenigin: ${komponenten(k.keys).length} Teile statt einem (Kappe, Stiel, Wurzeln)`);
  if (ks.vox.length < 10) f.push(`Koenigin-Sporen: nur ${ks.vox.length} Sporenpunkte (mindestens 10)`);
  const lose = ks.vox.filter((v) => !k.keys.has(`${v.x},${v.y - 1},${v.z}`));
  if (lose.length) f.push(`Koenigin: ${lose.length} Sporenpunkte ohne Kappe darunter, z. B. (${lose[0].x},${lose[0].y},${lose[0].z})`);
  const myzel = rollen(ids).myzel.c;
  const wurzel = k.vox.filter((v) => v.y === 0 && v.c === myzel && Math.hypot(v.x + 0.5, v.z + 0.5) > 8);
  if (wurzel.length < 20) f.push(`Koenigin: nur ${wurzel.length} Wurzel-Voxel am Boden ausserhalb des Fusses (mindestens 20): Myzel-Ansatz fehlt`);
  const stiel = k.vox.filter((v) => v.y >= 6 && v.y < 20 && Math.hypot(v.x + 0.5, v.z + 0.5) < 6).length;
  if (stiel < 100) f.push(`Koenigin: Stiel zu duenn (${stiel} Voxel zwischen Hoehe 6 und 20)`);
  return f;
}
/** Familie: Koenigin dieselbe Form, etwa fuenfmal groesser (Breite 3,5 bis 5,5, Hoehe 4,5 bis 6 mal). */
function pruefeFamilie(ids) {
  const f = [], s = baue(ids.s, { pose: 0 }, ids.palette), k = baue(ids.k, { pose: 2 }, ids.palette);
  const kappe = rollen(ids).kappe.c, breite = (b) => { const x = b.vox.filter((v) => v.c === kappe).map((v) => v.x); return Math.max(...x) - Math.min(...x) + 1; }, hoehe = (b) => b.bounds.max[1] + 1;
  const fb = breite(k) / breite(s), fh = hoehe(k) / hoehe(s);
  if (!(fb >= 3.5 && fb <= 5.5)) f.push(`Koenigin ${breite(k)} Voxel Kappenbreite gegen Schwarmling ${breite(s)}: Faktor ${fb.toFixed(2)} (verlangt 3,5 bis 5,5)`);
  if (!(fh >= 4.5 && fh <= 6)) f.push(`Koenigin ${hoehe(k)} Voxel hoch gegen Schwarmling ${hoehe(s)}: Faktor ${fh.toFixed(2)} (verlangt 4,5 bis 6)`);
  const r = rollen(ids);
  for (const [b, l] of [[s, 'Schwarmling'], [k, 'Koenigin']]) {
    const kap = b.vox.filter((v) => v.c === r.kappe.c).length;
    if (kap < b.vox.length * 0.4) f.push(`${l}: nur ${kap} von ${b.vox.length} Voxeln in der Kappenfarbe (die Kappe soll das Bild tragen)`);
  }
  return { fehler: f, fb, fh };
}
/** Posen des Schwarmlings: Formen verschieden (steh, hocke, biss), Beinphasen verschieden, Hocke niedriger, Biss reckt die Kappe nach vorn, Sporen folgen; Koenigin ignoriert die Pose. */
function pruefePosen(ids) {
  const f = [], h = {}, bei = {};
  for (const pose of POSEN) { const b = baue(ids.s, { pose }, ids.palette); h[pose] = formHash(b.vox); bei[pose] = { hoch: b.bounds.max[1], z: mittel(b.vox.filter((v) => v.y >= 3).map((v) => v.z)) }; }
  if (new Set([h[0], h[2], h[3]]).size !== 3) f.push('Posen steh, hocke, biss ergeben nicht drei verschiedene Formen');
  if (!(bei[2].hoch < bei[0].hoch)) f.push(`Hocke nicht niedriger als Steh (${bei[2].hoch} gegen ${bei[0].hoch})`);
  if (!(bei[3].z > bei[0].z + 0.5)) f.push(`Biss reckt die Kappe nicht nach vorn (mittleres z ${bei[3].z.toFixed(2)} gegen ${bei[0].z.toFixed(2)})`);
  if (formHash(baue(ids.s, { pose: 0, beinphase: 0 }, ids.palette).vox) === formHash(baue(ids.s, { pose: 0, beinphase: 1 }, ids.palette).vox)) f.push('Beinphase 0 und 1 geben dieselbe Form');
  const sp = new Set([0, 2, 3].map((pose) => formHash(baue(ids.ss, { pose, ladung: 0 }, ids.palette).vox)));
  if (sp.size !== 3) f.push(`Sporen folgen der Pose nicht (nur ${sp.size} verschiedene Lagen)`);
  if (formHash(baue(ids.s, { pose: 0, beinphase: 0 }, ids.palette).vox) !== formHash(baue(ids.s, { pose: 0, beinphase: 0, fell: 0 }, ids.palette).vox)) f.push('fell 0 aendert die Form');
  const kp = new Set([0, 2].map((pose) => formHash(baue(ids.k, { pose }, ids.palette).vox)));
  if (kp.size !== 1) f.push('Die Koenigin aendert ihre Form mit der Pose (sie steht im Spiel immer in Pose 2 = Modus steht)');
  return { fehler: f, h };
}
/** Graustufen und Boden: Kappe hebt sich vom dunklen Hoehlenboden ab, Sporen heller als die Kappe, Lamellen dunkler, Fleck dunkler als der Boden. */
function pruefeKontrast(ids) {
  const f = [], r = rollen(ids), bo = luma(boden());
  const faktor = { kappe: luma(r.kappe.c) / bo, spore: luma(r.spore_an.c) / luma(r.kappe.c), fleck: luma(r.fleck.c) / bo, lamelle: luma(r.lamelle.c) / luma(r.kappe.c) };
  if (!(faktor.kappe >= 2.5)) f.push(`Kappe (Grau ${luma(r.kappe.c).toFixed(0)}) hebt sich nicht genug vom Boden ab (Grau ${bo.toFixed(0)}): Faktor ${faktor.kappe.toFixed(2)}, verlangt 2,5`);
  if (!(faktor.spore >= 1.25)) f.push(`Sporenpunkte nicht hell genug gegen die Kappe: Faktor ${faktor.spore.toFixed(2)}, verlangt 1,25`);
  if (!(faktor.fleck <= 0.8)) f.push(`Zerfallsfleck (Grau ${luma(r.fleck.c).toFixed(0)}) nicht dunkler als der Boden (Grau ${bo.toFixed(0)}): Faktor ${faktor.fleck.toFixed(2)}, verlangt hoechstens 0,8`);
  if (!(faktor.lamelle <= 0.75)) f.push(`Lamellen nicht dunkel genug gegen die Kappe: Faktor ${faktor.lamelle.toFixed(2)}, verlangt hoechstens 0,75`);
  if (!(luma(r.kappe.c) / luma(r.fleck.c) >= 3)) f.push('Kappe und Fleck liegen in Graustufen zu nah beieinander (Faktor unter 3)');
  return { fehler: f, faktor };
}
/** Zerfall und Boden: Fleck flach (klein hoechstens 2, gross hoechstens 4 Voxel hoch, mindestens 4 x so breit wie hoch), Faden ein Voxel hoch, beide ohne Leuchten. */
function pruefeFlach(ids) {
  const f = [];
  for (const [gross, hMax] of [[0, 2], [1, 4]]) {
    const b = baue(ids.f, { gross }, ids.palette), hoch = b.bounds.max[1] + 1, breit = b.bounds.max[0] - b.bounds.min[0] + 1;
    if (hoch > hMax) f.push(`Fleck gross ${gross}: ${hoch} Voxel hoch (hoechstens ${hMax})`);
    if (breit < 4 * hoch) f.push(`Fleck gross ${gross}: ${breit} Voxel breit bei ${hoch} Hoehe (mindestens 4 x)`);
    if (b.vox.some((v) => v.e > 0)) f.push(`Fleck gross ${gross}: leuchtet (Licht muss aus sein)`);
    if (komponenten(b.keys).length !== 1) f.push(`Fleck gross ${gross}: ${komponenten(b.keys).length} Teile statt einem`);
  }
  if (baue(ids.f, { gross: 1 }, ids.palette).bounds.max[0] - baue(ids.f, { gross: 1 }, ids.palette).bounds.min[0] < 20) f.push('Koenigin-Fleck unter 20 Voxel breit (Kappenrest soll sichtbar bleiben)');
  if (formHash(baue(ids.f, { gross: 0 }, ids.palette).vox) === formHash(baue(ids.f, { gross: 1 }, ids.palette).vox)) f.push('Fleck gross 0 und 1 sind gleich');
  const fa = baue(ids.fa, {}, ids.palette);
  if (fa.bounds.max[1] !== 0) f.push(`Myzelfaden: ${fa.bounds.max[1] + 1} Voxel hoch (soll flach sein, 1)`);
  if (fa.vox.some((v) => v.e > 0)) f.push('Myzelfaden leuchtet');
  if (fa.bounds.max[2] - fa.bounds.min[2] + 1 < 12) f.push('Myzelfaden kuerzer als 12 Voxel');
  return f;
}
/** Determinismus: gleiche Parameter geben gleiche Voxel (auch aus einer frisch geladenen Bibliothek); der Seed aendert nichts. */
async function pruefeDeterminismus(ids) {
  const f = [], lib2 = nodeLibrary(root);
  for (const id of idx.palettes) await lib2.load('palettes', id);
  await lib2.put('palettes', lib.get('palettes', ids.palette));
  for (const m of MODELLE) await lib2.put('models', structuredClone(lib.get('models', ids[m])));
  const farbe = (l, id, params) => [...l.build(id, { params, palette: ids.palette }).grid.values()].map((v) => `${v.x},${v.y},${v.z},${v.c},${v.e}`).sort().join(';');
  for (const [id, params] of [[ids.s, { pose: 3, beinphase: 1 }], [ids.ss, { pose: 2, ladung: 0 }], [ids.k, { pose: 2 }], [ids.ks, {}], [ids.f, { gross: 1 }], [ids.fa, {}]]) {
    if (farbe(lib, id, params) !== farbe(lib2, id, params)) f.push(`${id} ${JSON.stringify(params)}: zwei Bauvorgaenge geben verschiedene Voxel`);
    if (farbe(lib, id, params) !== farbe(lib, id, { ...params, seed: 77 })) f.push(`${id} ${JSON.stringify(params)}: der Seed veraendert das Modell (soll ohne Wirkung sein)`);
  }
  return f;
}
/** Farben: keine Funktionsfarbe (Mint, Eisblau, Bernstein, Rot) und nicht das Orange der Rudeltier-Marken; leuchten duerfen nur die Sporen (Rolle spore_an). */
function pruefeFarben(ids) {
  const f = [], gesehen = new Set(), spore = rollen(ids).spore_an;
  alleModelle(ids, (b, l, m) => {
    for (const v of b.vox) {
      const leuchtErlaubt = m === 'ss' || m === 'ks';
      if (!leuchtErlaubt && v.e > 0) f.push(`${l}: leuchtendes Voxel (${v.x},${v.y},${v.z}) ausserhalb der Sporen`);
      if (leuchtErlaubt && !(v.e > 0 && v.c === spore.c)) f.push(`${l}: Sporenvoxel (${v.x},${v.y},${v.z}) leuchtet nicht in der Rolle spore_an`);
      if (gesehen.has(v.c)) continue; gesehen.add(v.c);
      for (const [n, c] of Object.entries(FUNKTION)) if (dist(v.c, c) < FARB_ABSTAND) f.push(`${l}: Farbe ${v.c.toString(16)} liegt ${dist(v.c, c).toFixed(0)} neben der Funktionsfarbe ${n} (mindestens ${FARB_ABSTAND})`);
      if (dist(v.c, RUDEL_MARKE) < FARB_ABSTAND) f.push(`${l}: Farbe ${v.c.toString(16)} liegt ${dist(v.c, RUDEL_MARKE).toFixed(0)} neben der Leuchtfarbe der Rudeltier-Marken (mindestens ${FARB_ABSTAND})`);
    }
  });
  return { fehler: f.slice(0, 20), farben: gesehen.size };
}

// ---------------------------------------------------------------------------------------------
console.log('Schwarm Richtung C Myzel (MON-03 E)');
const leer = (a) => (Array.isArray(a) ? a.length === 0 : a.fehler.length === 0);
const fb = pruefeFussabdruck(IDS); ok(leer(fb), `Fussabdruck (1x1: Schwarmling, Sporen, Faden; 2x2: Koenigin, Sporen, Fleck), Anker (0,0,0), Stufe detail, Kreisregel bei 8 Drehungen, groesster Abstand ${(fb.maxR * 100).toFixed(0)} % des erlaubten${fb.fehler.length ? ': ' + kurz(fb.fehler) : ''}`);
const bu = pruefeBudget(IDS); ok(leer(bu), `Budget: Schwarmling + Sporen hoechstens ${bu.mx.sV} Voxel (Grenze ${BUDGET.sVoxel}), Koerper ${bu.mx.sT} Dreiecke (${BUDGET.sTris}), Sporen ${bu.mx.ssT} (${BUDGET.ssTris}); Koenigin ${bu.mx.kV} Voxel, ${bu.mx.kT} Dreiecke (${BUDGET.kTris}), Sporen ${bu.mx.ksT} (${BUDGET.ksTris}); Fleck ${bu.mx.fT} (${BUDGET.fTris}), Faden ${bu.mx.faT} (${BUDGET.faTris})${bu.fehler.length ? ': ' + kurz(bu.fehler) : ''}`);
const au = pruefeAufbau(IDS); ok(leer(au), `Aufbau: aus einem Stueck (8 Faelle + Koenigin), 5 Sporenpunkte am Schwarmling, mindestens 10 an der Koenigin, alle auf der Kappe, Wurzeln am Fuss der Koenigin${au.length ? ': ' + kurz(au) : ''}`);
const fam = pruefeFamilie(IDS); ok(leer(fam), `Familie: Koenigin ${fam.fb.toFixed(2)} x so breit und ${fam.fh.toFixed(2)} x so hoch wie der Schwarmling (verlangt etwa 5), Kappe traegt das Bild${fam.fehler.length ? ': ' + kurz(fam.fehler) : ''}`);
const po = pruefePosen(IDS); ok(leer(po), `Posen: steh, hocke und biss verschieden (${[0, 2, 3].map((p) => po.h[p]).join(', ')}), Hocke niedriger, Biss nach vorn, zwei Beinphasen, Sporen folgen, Koenigin pose-unabhaengig${po.fehler.length ? ': ' + kurz(po.fehler) : ''}`);
const ko = pruefeKontrast(IDS); ok(leer(ko), `Graustufen: Kappe ${ko.faktor.kappe.toFixed(2)} x heller als der Boden (verlangt 2,5), Sporen ${ko.faktor.spore.toFixed(2)} x heller als die Kappe (1,25), Fleck ${ko.faktor.fleck.toFixed(2)} x des Bodens (hoechstens 0,8), Lamellen ${ko.faktor.lamelle.toFixed(2)} x der Kappe (hoechstens 0,75)${ko.fehler.length ? ': ' + kurz(ko.fehler) : ''}`);
const fl = pruefeFlach(IDS); ok(leer(fl), `Zerfall und Boden: Fleck flach und dunkel ohne Leuchten, Koenigin-Fleck mit Kappenrest, Faden 1 Voxel hoch ohne Leuchten${fl.length ? ': ' + kurz(fl) : ''}`);
const de = await pruefeDeterminismus(IDS); ok(leer(de), `Determinismus: gleiche Parameter gleiche Voxel (auch frisch geladen), Seed ohne Wirkung${de.length ? ': ' + kurz(de) : ''}`);
const fa = pruefeFarben(IDS); ok(leer(fa), `Farben: keine Funktionsfarbe, nicht das Orange der Rudeltier-Marken (Abstand mindestens ${FARB_ABSTAND}) in ${fa.farben} Farben, nur die Sporen leuchten (Rolle spore_an)${fa.fehler.length ? ': ' + kurz(fa.fehler) : ''}`);

// ---------------------------------------------------------------------------------------------
// Mutationsproben: absichtlich verletzte Rezepte muessen rot werden
// ---------------------------------------------------------------------------------------------
console.log('\nMutationsproben');
let mutN = 0;
const roh = (id) => structuredClone(lib.get('models', id));
/** Legt eine mutierte Kopie des Modellsatzes an; `aendere` bekommt { s, ss, k, ks, f, fa, palette } (Objekte, werden veraendert). */
async function mutiere(aendere) {
  const n = ++mutN, ids = { palette: `test_smut${n}` };
  const s = { palette: structuredClone(lib.get('palettes', IDS.palette)) };
  for (const m of MODELLE) { s[m] = roh(IDS[m]); ids[m] = `test/smut${n}_${m}`; }
  aendere(s);
  s.palette.id = ids.palette;
  await lib.put('palettes', s.palette);
  for (const m of MODELLE) { s[m].id = ids[m]; s[m].palette = ids.palette; await lib.put('models', s[m]); }
  return ids;
}
const finde = (m, name) => m.ops.find((o) => o.name === name);
const rot = async (name, pruefung, aendere) => {
  const ids = await mutiere(aendere); let ergebnis;
  try { ergebnis = await pruefung(ids); } catch (e) { ergebnis = [`Ausnahme: ${e.message.slice(0, 80)}`]; }
  const fehler = Array.isArray(ergebnis) ? ergebnis : ergebnis.fehler;
  ok(fehler.length > 0, `Mutation "${name}" wird erkannt${fehler.length ? ': ' + fehler[0].slice(0, 110) : ' (NICHT erkannt)'}`);
};
await rot('Schwarmling-Kappe 3 Voxel breiter (ragt ueber den Kreis)', pruefeFussabdruck, (s) => { finde(s.s, 'Kappe').r = [11, 3.2, 11]; });
await rot('Koenigin-Kappe ueber den 2x2-Kreis', pruefeFussabdruck, (s) => { finde(s.k, 'Kappe').r = [18, 9, 18]; });
await rot('Schwarmling aufgeblaeht (Voxel- und Dreieckszahl)', pruefeBudget, (s) => { finde(s.s, 'Kappe').r = [7.5, 6, 7.5]; });
await rot('Koenigin aufgeblaeht (Dreiecke)', pruefeBudget, (s) => { finde(s.k, 'Kappe').r = [15.5, 15, 15.5]; });
await rot('Schwebende Beine (Voxel getrennt)', pruefeAufbau, (s) => { for (const o of s.s.ops) if (o.name.startsWith('Bein')) o.at[1] = -4; });
await rot('Sporenpunkt schwebt ueber der Kappe', pruefeAufbau, (s) => { finde(s.ss, 'Spore oben').at[1] = 'hl + 5'; });
await rot('Koenigin ohne Wurzeln', pruefeAufbau, (s) => { s.k.ops = s.k.ops.filter((o) => !o.name.startsWith('Wurzel') && !o.name.startsWith('Gabel')); });
await rot('Koenigin zu klein (Kappe 16 statt 32 breit)', pruefeFamilie, (s) => { finde(s.k, 'Kappe').r = [8, 9, 8]; });
await rot('Pose ohne Wirkung am Schwarmling', pruefePosen, (s) => { s.s.let.duck = '0'; });
await rot('Biss ohne Vorstrecken', pruefePosen, (s) => { s.s.let.lean = '0'; });
await rot('Beinphase ohne Wirkung', pruefePosen, (s) => { s.s.let.dzv = '1'; s.s.let.dzh = '1'; });
await rot('Sporen folgen der Pose nicht', pruefePosen, (s) => { s.ss.let.duck = '0'; s.ss.let.lean = '0'; });
await rot('Kappe dunkel (verschwindet im Boden)', pruefeKontrast, (s) => { s.palette.roles.kappe = '#3A3028'; });
await rot('Zerfallsfleck heller als der Boden', pruefeKontrast, (s) => { s.palette.roles.fleck = '#9A8E78'; });
await rot('Fleck 6 Voxel hoch', pruefeFlach, (s) => { finde(s.f, 'Fleck klein').h = 6; });
await rot('Fleck leuchtet', pruefeFlach, (s) => { finde(s.f, 'Fleck klein').color = 'spore_an'; });
await rot('Faden 3 Voxel hoch', pruefeFlach, (s) => { for (const o of s.fa.ops) { o.from[1] = 2.5; o.to[1] = 2.5; o.r = 1.5; } });
await rot('Zufall im Fell (Seed veraendert die Kappe)', pruefeDeterminismus, (s) => { s.s.jitter = 0.2; finde(s.s, 'Kappe').color = { noise: ['kappe', 'stiel'], weights: [1, 1], cell: 1 }; });
await rot('Sporenfarbe Bernstein (Funktionsfarbe)', pruefeFarben, (s) => { s.palette.roles.spore_an = { color: '#FFC66B', emit: 1.6 }; });
await rot('Sporenfarbe wie die Rudeltier-Marken', pruefeFarben, (s) => { s.palette.roles.spore_an = { color: '#FF9A78', emit: 1.6 }; });
await rot('Kappe leuchtet', pruefeFarben, (s) => { finde(s.s, 'Kappe').emit = 1.5; });
await rot('Sporen ohne Leuchten', pruefeFarben, (s) => { s.palette.roles.spore_an = '#D8F060'; });

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
