// CHA-02 A1: 8er-Kopf mit festem Gesicht (Kopfmaß samt Mutationsprobe), Katalog Version 2 (ohne gesicht und bart, 6 Hauttöne, 8 Haarfarben), Bordhelm auf dem neuen Kopf.
// CHA-02 B1: vier römische Frisuren (kurz, stirnband, welle, offen): Bau, Haarfarbe (Lecktest), Kopfbreite, Frisur × Bordhelm, Toleranz, Dreiecke, Mutationsproben.
// Tests der Spielerfigur aus Schichten (cha/): Standardfigur, Voxelgleichheit zu lerche/crew_0 (außer Kopf), Farbrollen (Lecktest),
// Haut/Haar über Figur-colors, Prüfregeln samt Mutationsprobe, Generator wiederholbar, Rig-Bereiche.
// A2: alle Kombinationen der Teile, Lecktest über alle Teile, Farben je Teil, Haut/Haar im Katalog, Bordhelm (Haar, Haut, Ohren),
// Schweben, Schichtfolge, Katalog samt Mutationsprobe.
// A4: Vorschaubilder je Teil (existieren, gültiges PNG, Größe, Generator --check samt Mutationsprobe), Porträt aus Charakterkarte.
// A3: Posen in Node gegen three.js, Passprobe über alle Kombinationen × Posen, Mutationsprobe der Passprobe, Spielerfarbe nie in der Kleidung.
// Aufruf: node tools/test-cha.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/ aus dem Repo (nichts wird geschrieben).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { nodeLibrary, listAssets } from './fs-io.js';
import { pruefeFigurKopf, pruefeAnker, pruefeRollen, pruefeBereiche, pruefeFigur, pruefeKopf, pruefeKatalog, platzOptionen, baueFigur, vergleiche, FIGURFARBEN, GELENK_LINKS, LEERE_WERTE, PLATZ_ENTFALLEN, KOPF_MASS, CHA_TOLERANZEN, toleranzenVon, OEFFNUNG, pruefePassung, ladeFigur, haarAussen } from './cha-lib.mjs';
import { meshGrid } from '../core/mesher.js';
import { kopfDurchdringung } from './cha-kopfpass.mjs';
import { poseWerte, gelenkMatrizen, weltPunkt, eulerYXZ } from './cha-pose.mjs';
import { decodePng, encodePng } from './cha-render.mjs';
import { KACHEL, PORTRAET, FENSTER, vorschauBild, portraet, kartenOptionen } from './cha-ansicht.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  (ist ${JSON.stringify(a)}, soll ${JSON.stringify(b)})`}`);

const lib = nodeLibrary(root), idx = await listAssets(root);
const chaIds = idx.models.filter((i) => i.startsWith('cha/'));
for (const id of chaIds) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
await lib.load('figures', 'lerche/crew_0');
for (const jn of Object.values(lib.get('figures', 'lerche/crew_0').parts)) await lib.load('models', jn.model);
const rig = lib.get('rigs', 'human') || (await lib.load('rigs', 'human'));
const get = (id) => lib.get('models', id);
const PINK = '#ff00ff';
const istPink = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return r > 200 && b > 200 && g < 100; };
const zaehlePink = (grid) => { let n = 0; for (const v of grid.values()) if (istPink(v.c)) n++; return n; };

// =============================================================================================
console.log('\n== Figur cha/spieler');
const fig = lib.get('figures', 'cha/spieler');
eq(Object.keys(fig.params), ['koerper', 'frisur', 'kopf', 'oberteil', 'hose', 'schuhe', 'haende', 'umhang'], 'params genau mit den Platzschlüsseln der Schnittstelle Version 2 (Reihenfolge der Plätze, ohne gesicht und bart)');
eq(fig.params, { koerper: 'standard', frisur: 'kurz', kopf: 'keine', oberteil: 'bordtunika', hose: 'bordhose', schuhe: 'bordstiefel', haende: 'keine', umhang: 'keiner' }, 'Standardwerte laut Schnittstelle');
ok(PLATZ_ENTFALLEN.every((p) => !(p in fig.params)), 'die Plätze gesicht und bart gibt es in den Figur-params nicht mehr');
eq(Object.keys(fig.colors).sort(), ['hair', 'skin', 'skin_shadow'], 'Figur-colors setzen nur Haut und Haar');
const std = baueFigur(lib, 'cha/spieler');
ok(std.grid.size > 1000, `Standardfigur baut (${std.grid.size} Voxel)`);

console.log('\n== Voxelgleich zu lerche/crew_0 (außer dem Kopf)');
const ref = baueFigur(lib, 'lerche/crew_0');
const ohneKopf = (r) => { const g = new Map(); for (const [jn, vs] of Object.entries(r.pro)) if (jn !== 'head') for (const v of vs) g.set(jn + ':' + v.x + ',' + v.y + ',' + v.z, v); return g; };
{
  const A = ohneKopf(ref), B = ohneKopf(std);
  let gleichV = 0, nurA = 0, nurB = 0, farbe = 0;
  for (const [k, v] of A) { const w = B.get(k); if (!w) nurA++; else if (w.c !== v.c || w.e !== v.e) farbe++; else gleichV++; }
  for (const k of B.keys()) if (!A.has(k)) nurB++;
  console.log(`    Körper ohne Kopf: crew_0 ${A.size} Voxel, cha/spieler ${B.size} Voxel, gleich ${gleichV}, nur crew_0 ${nurA}, nur cha ${nurB}, andere Farbe ${farbe}`);
  ok(nurA === 0 && nurB === 0, `Geometrie außer dem Kopf identisch (${gleichV} von ${A.size} Voxeln)`);
  ok(farbe === 0, `Farben außer dem Kopf identisch (${farbe} Abweichungen; die frühere Spielerfarbe cloth2 steht als feste Teilfarbe in der Palette cha)`);
  for (const jn of Object.keys(ref.pro)) if (jn !== 'head') eq(std.pro[jn].length, ref.pro[jn].length, `Gelenk ${jn}: gleiche Voxelzahl`);
  {
    // B1: lerche/crew_0 behält sein Dutt-Haar (eigenes Kopfteil), cha/spieler trägt den Kurzschnitt: verglichen wird der Kopf ohne Haar (Haar = Marker grün)
    const HAARC = '#00FF00', istGruen = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > 150 && r < 90 && b < 90; };
    const farben = { hair: HAARC, cloth2: HAARC };
    const kopfRef = baueFigur(lib, 'lerche/crew_0', { colors: farben }).pro.head, kopfNackt = baueFigur(lib, 'cha/spieler', { params: { frisur: 'keine' }, colors: farben }).pro.head;
    const m = new Map(kopfNackt.map((v) => [`${v.x},${v.y},${v.z}`, v]));
    const ohneHaar = kopfRef.filter((v) => !istGruen(v.c));
    const gleichKopf = ohneHaar.filter((v) => { const w = m.get(`${v.x},${v.y},${v.z}`); return w && w.c === v.c && w.e === v.e; }).length;
    ok(gleichKopf === ohneHaar.length && kopfRef.length >= kopfNackt.length, `der Kopf ohne Haar ist voxelidentisch (lerche/crew_0 trägt den 8er-Kopf mit Dutt-Haar, cha/spieler den Kurzschnitt; ${gleichKopf} von ${ohneHaar.length} Nicht-Haar-Voxeln, Haar wird nicht verglichen)`);
  }
}

console.log('\n== Kopf 8 × 7 × 8 mit festem Gesicht (CHA-02 A1)');
{
  eq(pruefeKopf(lib, 'cha/spieler', idx.models), [], `nackter Kopf: ${KOPF_MASS.breite} breit, ${KOPF_MASS.hoehe} hoch, ${KOPF_MASS.tiefe} tief, Hals bei y ${KOPF_MASS.halsY}`);
  const nackt = baueFigur(lib, 'cha/spieler', { params: { frisur: 'keine', kopf: 'keine' } }).pro.head;
  const an = (x, y, z) => nackt.find((v) => v.x === x && v.y === y && v.z === z);
  ok([-2, -1, 0, 1].every((x) => [-2, -1, 0, 1].every((z) => an(x, 25, z))), 'Hals: 4 × 4 bei y 25 gehört zum Kopfteil');
  ok(an(1, 28, 3) && an(1, 29, 3) && an(-2, 28, 3) && an(-2, 29, 3), 'Augen: je 1 × 2 Voxel bei z 3 (y 28 und 29)');
  ok(an(-1, 26, 3) && an(0, 26, 3) && !an(3, 26, 3) && !an(-4, 26, 3), 'Mund bei y 26, Kinnkanten (x -4 und 3 bei y 26, z 3) sind abgeschnitten');
  const haut = baueFigur(lib, 'cha/spieler', { params: { frisur: 'keine', kopf: 'keine' }, colors: { skin: '#FF0000', skin_shadow: '#00FF00' } }).pro.head;
  ok(haut.filter((v) => v.y >= 26).every((v) => v.c !== undefined) && haut.filter((v) => v.y === 27 && v.z === 0 && v.x === 0)[0].c === 0xff0000, 'Schädel folgt der Rolle skin (Hautton aus der Figur)');
  const ps = lib.get('models', 'cha/koerper/standard/head_ops').ops;
  ok(ps.every((o) => o.color === undefined || typeof o.color !== 'string' || ['skin', 'skin_shadow', '#1A120E'].includes(o.color)), 'Kopfteil benutzt nur skin, skin_shadow und feste Augenfarbe (keine fremde Rolle)');
  ok(ps.filter((o) => ['Hals', 'Schädel'].includes(o.name)).every((o) => o.jitter === false), 'Hals und Schädel ohne Helligkeitsstreuung (jitter false, sparen Dreiecke)');
  ok(get('cha/koerper/standard/head').anchor.every((v) => v === 0) && get('cha/koerper/standard/head_ops').anchor.every((v) => v === 0), 'Kopfteil: anchor [0,0,0]');
  // Mutationsprobe: ein 6 breiter Schädel (Bestandsmaß) wird rot gemeldet
  const l2 = nodeLibrary(root);
  for (const id of chaIds) await l2.load('models', id);
  await l2.load('figures', 'cha/spieler');
  const s = l2.get('models', 'cha/koerper/standard/head_ops').ops.find((o) => o.name === 'Schädel'); s.at = [-3, 26, -4]; s.size = [6, 7, 8];
  ok(pruefeKopf(l2, 'cha/spieler', idx.models).some((f) => /breite 6 \(erwartet 8\)/.test(f.msg)), 'Mutationsprobe: Schädel nur 6 breit → Kopfregel meldet "breite 6 (erwartet 8)"');
  const l3 = nodeLibrary(root);
  for (const id of chaIds) await l3.load('models', id);
  await l3.load('figures', 'cha/spieler');
  l3.get('models', 'cha/koerper/standard/head_ops').ops = l3.get('models', 'cha/koerper/standard/head_ops').ops.filter((o) => o.name !== 'Hals');
  ok(pruefeKopf(l3, 'cha/spieler', idx.models).some((f) => /ohne Hals/.test(f.msg)), 'Mutationsprobe: Kopf ohne Hals → Kopfregel meldet es');
  // Rig und Posen bleiben unverändert: die Kopfbereiche des Rigs stammen vom Bestandskopf, der 8er-Kopf braucht die Zusatztoleranzen der Prüfregeln
  eq([rig.bereiche.head, rig.toleranzen.frisur?.head, rig.toleranzen.kopf?.head], [{ min: [-4, 25, -3], max: [3, 30, 3] }, { min: [0, 2, 2], max: [0, 3, 0] }, { min: [0, 0, 1], max: [0, 2, 0] }], 'Rig human unverändert (Kopfbereich und Toleranzen vom Bestandskopf)');
  ok(Object.keys(CHA_TOLERANZEN).length > 0 && toleranzenVon(rig).koerper.head.max[1] === 2, 'der 8er-Kopf liegt über dem Rig-Bereich: Zusatztoleranz für Körper-Kopf in cha-lib (toleranzenVon)');
}

console.log('\n== Kopf aller Figuren (CHA-02 A2)');
{
  const figIds = idx.figures;   // alle Dateien in assets/figures, keine feste Liste: künftige Figuren werden automatisch erfasst
  for (const f of figIds) await ladeFigur(lib, f);
  const fehler = figIds.flatMap((f) => pruefeFigurKopf(lib, f, idx.models));
  eq(fehler, [], `alle ${figIds.length} Figuren in assets/figures: Kopfteil mit 8er-Schädel (use-Baum), Hülle >= ${KOPF_MASS.breite} × ${KOPF_MASS.hoehe} × ${KOPF_MASS.tiefe}, Hals 4 × 4 bei y ${KOPF_MASS.halsY} (keine Ausnahmen)`);
  ok(['cha/spieler', 'lerche/crew_0', 'lerche/crew_1', 'lerche/crew_2', 'lerche/ivo', 'lerche/scavenger', 'crew/nova', 'crew/juno', 'crew/tami', 'rom/legionaer', 'test/puppe', 'fig/germanen/grundtyp', 'fig/germanen/enterer', 'fig/test/grundtyp'].every((f) => figIds.includes(f)), 'die Bestandsliste ist im Lauf enthalten (Spieler, Lerche, Crew, Rostmeute, Rom, Germanen, Test)');
  console.log(`    ${figIds.length} Figuren: ${figIds.join(', ')}`);
  // Mutationsproben (Modelle im Speicher): eine Figur mit 6er-Kopf wird rot, ein Helm ohne 8er-Schädel darunter ebenfalls
  const frisch = async (f) => { const l = nodeLibrary(root); for (const id of idx.models) await l.load('models', id); await ladeFigur(l, f); return l; };
  {
    const l = await frisch('lerche/crew_0');
    l.get('models', 'fig/lerche/head').ops = [{ op: 'box', name: 'Hals', at: [-1, 25, -1], size: [2, 1, 2], color: 'skin_shadow' }, { op: 'box', name: 'Schädel 6er', at: [-3, 26, -3], size: [6, 5, 6], color: 'skin' }];
    const r = pruefeFigurKopf(l, 'lerche/crew_0', idx.models);
    ok(r.some((x) => /Kopfhülle breite 6 \(mindestens 8\)/.test(x.msg)) && r.some((x) => /Hals bei y 25 unvollständig/.test(x.msg)) && r.some((x) => /enthält nicht den 8er-Schädel/.test(x.msg)), `Mutationsprobe: lerche/crew_0 mit altem 6er-Kopf wird rot (${r.map((x) => x.msg.slice(0, 40)).join(' | ')})`);
  }
  {
    const l = await frisch('crew/nova');
    const h = l.get('models', 'fig/crew/helm_offen');
    h.ops = h.ops.filter((o) => o.name !== 'Kopf');
    ok(pruefeFigurKopf(l, 'crew/nova', idx.models).some((x) => /enthält nicht den 8er-Schädel/.test(x.msg)), 'Mutationsprobe: Helm ohne 8er-Schädel darunter (Hülle bleibt 8 breit) → Kopfregel meldet es');
  }
  // Kopf berührt Rumpf, Schulter und Schulteraufsatz in den Posen nicht schlimmer als nach A2 (Schutz gegen Rückschritt); A1 zum Vergleich
  {
    const a2 = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'cha-kopfpass-a2.json'), 'utf8')), a1 = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'cha-kopfpass-a1.json'), 'utf8'));
    const ohne = figIds.filter((f) => !f.startsWith('cha/'));
    eq(ohne.filter((f) => !a2[f]), [], 'für jede Bestandsfigur gibt es Passprobewerte in tools/cha-kopfpass-a2.json (neue Figuren: node tools/cha-kopfpass.mjs > tools/cha-kopfpass-a2.json)');
    let schlechter = 0, hoeher = 0, gesamtA1 = 0, gesamtA2 = 0;
    for (const f of ohne.filter((f) => a2[f])) {
      const m = kopfDurchdringung(lib, f);
      for (const [z, paare] of Object.entries(m)) for (const [p, n] of Object.entries(paare)) {
        gesamtA2 += n; gesamtA1 += a1[f]?.[z]?.[p] ?? 0;
        if (n > (a2[f][z]?.[p] ?? 0)) { schlechter++; console.log(`    schlechter als A2: ${f} ${z} ${p}: ${n} > ${a2[f][z]?.[p]}`); }
        if (n > (a1[f]?.[z]?.[p] ?? 0)) hoeher++;
      }
    }
    eq(schlechter, 0, 'Kopf gegen Rumpf, Schulter, Oberarm (samt Aufsätzen) in allen Posen nicht schlimmer als der Stand nach A2');
    console.log(`    gegenüber dem Stand vor A2 (alter Kopf, tools/cha-kopfpass-a1.json): ${hoeher} Werte (Figur, Pose, Paar) höher; Summe der durchdrungenen Voxel ${gesamtA1} → ${gesamtA2}`);
    ok(gesamtA2 > gesamtA1, 'Positivkontrolle: die Messung sieht die stärkere Durchdringung des größeren Kopfes (nachher mehr als vorher)');
    // Mutationsprobe: ein Kragenbrett am Helm kippt in den Posen in den Rumpf
    const l = await frisch('rom/legionaer');
    const mess = (lb) => Object.values(kopfDurchdringung(lb, 'rom/legionaer')).reduce((s, p) => s + Object.values(p).reduce((a, b) => a + b, 0), 0);
    const vorher = mess(l), l2 = await frisch('rom/legionaer');
    l2.get('models', 'fig/rom/helm').ops.push({ op: 'box', name: 'Kragenbrett', at: [-4, 25, -6], size: [8, 2, 12], color: '#ff0000' });
    const nachher = mess(l2);
    ok(nachher > vorher, `Mutationsprobe: Helm mit Kragenbrett (8 × 2 × 12 über den Schultern) → mehr Durchdringung in Posen (${vorher} → ${nachher})`);
  }
}

console.log('\n== Rollen-Lecktest');
const basisRollen = Object.keys(lib.palette('base').roles);
{
  const spielerRollen = ['primary', 'secondary', 'cloth', 'cloth2', 'spieler'];
  const mit = baueFigur(lib, 'cha/spieler', { colors: Object.fromEntries(spielerRollen.map((r) => [r, PINK])) });
  const dd = vergleiche(std.grid, mit.grid);
  eq([dd.nurA + dd.nurB, dd.farbe], [0, 0], `Spielerfarb-Rollen (${spielerRollen.join(', ')}) auf Magenta: kein Voxel der Spielerfigur ändert sich`);
  const refMit = baueFigur(lib, 'lerche/crew_0', { colors: { cloth2: PINK } });
  const dr = vergleiche(ref.grid, refMit.grid);
  ok(dr.farbe > 0, `Positivkontrolle: bei lerche/crew_0 färbt cloth2 = Magenta ${dr.farbe} Voxel um`);
  const alle = baueFigur(lib, 'cha/spieler', { colors: Object.fromEntries(basisRollen.filter((r) => !FIGURFARBEN.includes(r) && r !== 'black').map((r) => [r, PINK])) });
  eq(zaehlePink(alle.grid), 0, 'alle Basisrollen außer skin/skin_shadow/hair/black auf Magenta: 0 Magenta-Voxel (jede benutzte Rolle ist auf eine Platzrolle umgelegt)');
  const refAlle = baueFigur(lib, 'lerche/crew_0', { colors: Object.fromEntries(basisRollen.filter((r) => !FIGURFARBEN.includes(r) && r !== 'black').map((r) => [r, PINK])) });
  ok(zaehlePink(refAlle.grid) > 100, `Positivkontrolle: dasselbe bei lerche/crew_0 ergibt ${zaehlePink(refAlle.grid)} Magenta-Voxel`);
  const alle2 = baueFigur(lib, 'cha/spieler', { colors: Object.fromEntries(basisRollen.filter((r) => !FIGURFARBEN.includes(r)).map((r) => [r, PINK])) });
  const dB = vergleiche(std.grid, alle2.grid);
  eq(dB.farbe, 0, 'auch black auf Magenta ändert nichts');
}

console.log('\n== Haut und Haar über Figur-colors');
{
  const haut = baueFigur(lib, 'cha/spieler', { colors: { skin: '#FF0000', skin_shadow: '#00FF00' } });
  const haar = baueFigur(lib, 'cha/spieler', { colors: { hair: '#0000FF' } });
  const dh = vergleiche(std.grid, haut.grid), dr = vergleiche(std.grid, haar.grid);
  ok(dh.farbe > 20 && dh.nurA + dh.nurB === 0, `skin/skin_shadow wirken (${dh.farbe} Voxel umgefärbt, Geometrie gleich)`);
  ok(dr.farbe > 10 && dr.nurA + dr.nurB === 0, `hair wirkt (${dr.farbe} Voxel umgefärbt, Geometrie gleich)`);
  let beides = 0;
  for (const v of std.grid.values()) { const a = haut.grid.get(v.x, v.y, v.z), b = haar.grid.get(v.x, v.y, v.z); if (a.c !== v.c && b.c !== v.c) beides++; }
  eq(beides, 0, 'kein Voxel reagiert auf Haut und Haar zugleich');
  const hautVox = [...haut.grid.values()].filter((v) => std.grid.get(v.x, v.y, v.z).c !== v.c), blau = [...haar.grid.values()].filter((v) => std.grid.get(v.x, v.y, v.z).c !== v.c);
  ok(blau.every((v) => v.y >= 25), 'Haarvoxel liegen im Kopf (y >= 25)');
  ok(hautVox.some((v) => v.y < 25), 'Haut kommt auch außerhalb des Kopfes vor (Hals, Hände)');
}

console.log('\n== Prüfregeln auf dem Bestand');
eq(pruefeAnker(idx.models, get), [], `Anker: ${chaIds.length} Modelle ohne Befund`);
eq(pruefeRollen(idx.models, get), [], 'Rollen: kein use setzt skin/skin_shadow/hair');
eq(pruefeBereiche(idx.models, get, (id) => lib.build(id), rig), [], 'Gelenkbereiche: alle Schichten innerhalb von Bereich + Toleranz');
{
  const r = pruefeFigur(lib, 'cha/spieler', idx.models);
  eq(r.fehler, [], `Figur baut mit Standardwerten und mit allen ${r.gebaut - 1} Einzelwerten`);
}

console.log('\n== Mutationsprobe (die Regeln erkennen manipulierte Modelle)');
const mit = (aenderungen) => (id) => (id in aenderungen ? aenderungen[id] : get(id));   // Modell-Lookup mit Überschreibungen
const klon = (id) => structuredClone(get(id));
const hat = (fehler, id, re) => fehler.some((f) => f.id === id && re.test(f.msg));
{
  const W = 'cha/oberteil/bordtunika/torso', Q = 'fig/lerche/tunic_torso';
  const w = klon(W); delete w.anchor;
  ok(hat(pruefeAnker(idx.models, mit({ [W]: w })), W, /ohne "anchor"/), 'Schicht ohne anchor wird erkannt (Modell-ID im Fehler)');
  const q = klon(Q); delete q.anchor;
  const f2 = pruefeAnker(idx.models, mit({ [Q]: q }));
  ok(hat(f2, W, /hat keinen "anchor"/), 'use auf ein Teil ohne anchor wird erkannt');
  ok(pruefeAnker(idx.models, mit({})).length === 0, 'unveränderter Zustand bleibt ohne Befund (Gegenprobe)');
  const q2 = klon(Q); q2.anchor = [0, 20, -3];
  ok(hat(pruefeAnker(idx.models, mit({ [Q]: q2 })), W, /braucht "at"/), 'Anbaupunkt-Anker ohne ausgleichendes at wird erkannt');
  const w3 = klon(W); w3.ops[0].at = [0, 20, -3];
  ok(pruefeAnker(idx.models, mit({ [Q]: q2, [W]: w3 })).length === 0, 'Anbaupunkt-Anker mit ausgleichendem at ist in Ordnung');
}
for (const rolle of FIGURFARBEN) {
  const W = 'cha/oberteil/bordtunika/torso', w = klon(W);
  w.ops[0].colors = { ...w.ops[0].colors, [rolle]: 'top' };
  ok(hat(pruefeRollen(idx.models, mit({ [W]: w })), W, new RegExp(`colors setzt ${rolle}`)), `use mit colors.${rolle} wird erkannt`);
}
{
  const W = 'cha/oberteil/bordtunika/torso', w = klon(W);
  w.ops[0].palette = 'lerche_rom';
  ok(hat(pruefeRollen(idx.models, mit({ [W]: w })), W, /palette/), 'use mit fremder palette wird erkannt');
  const g = klon('cha/koerper/standard/head'); g.ops[0].colors = { hair: 'schmuck' };
  ok(hat(pruefeRollen(idx.models, mit({ 'cha/koerper/standard/head': g })), 'cha/koerper/standard/head', /hair/), 'colors.hair in einer Kopf-Schicht wird erkannt');
}
{
  // Bereiche: Rig-Daten manipulieren (Bereich verkleinert bzw. Toleranz entfernt), die Schichten müssen rot werden
  const S = 'cha/hose/bordhose/thigh', D = 'cha/frisur/welle/head', bauen = (id) => lib.build(id);
  const rig2 = structuredClone(rig); rig2.bereiche.thighL.max[1] = 9;
  ok(hat(pruefeBereiche(idx.models, get, bauen, rig2), S, /y max 13 > 9/), 'Schicht außerhalb des (verkleinerten) Bereichs wird erkannt');
  const tol3 = toleranzenVon(rig); delete tol3.frisur;
  const f3 = pruefeBereiche(idx.models, get, bauen, rig, tol3);
  ok(hat(f3, D, /y max 34 > 30/) && hat(f3, D, /z min -5 < -3/) && hat(f3, D, /x min -5 < -4/), 'Welle ohne Toleranz für frisur verletzt den Kopfbereich (Toleranz wird gebraucht und benutzt)');
  const tol4 = toleranzenVon(rig); delete tol4.koerper;
  ok(hat(pruefeBereiche(idx.models, get, bauen, rig, tol4), 'cha/koerper/standard/head', /y max 32 > 30/), 'der 8er-Kopf ohne Zusatztoleranz verletzt den Kopfbereich des Rigs (y 32 > 30)');
  ok(pruefeBereiche(idx.models, get, bauen, rig).length === 0, 'mit den Toleranzen des Rigs: kein Befund (Gegenprobe)');
}
{
  const l2 = nodeLibrary(root);
  for (const id of chaIds) await l2.load('models', id);
  await l2.load('figures', 'cha/spieler');
  l2.get('figures', 'cha/spieler').parts.head.model = 'cha/joint/gibtsnicht';
  const r = pruefeFigur(l2, 'cha/spieler', idx.models);
  ok(r.fehler.length > 0 && r.fehler[0].id === 'cha/spieler', 'Figur mit kaputtem Teil wird von Regel (c) rot gemeldet');
}

// =============================================================================================
// A2: Prüfsatz-Alternativen, Katalog
// =============================================================================================
const optionen = platzOptionen(lib, idx.models);
const PLAETZE = Object.keys(fig.params);
const kombi = (p, w) => ({ [p]: w });   // Standardfigur mit einem Platz getauscht
const schluessel = (v) => v.x + ',' + v.y + ',' + v.z;
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));

console.log('\n== Teile je Platz (Schnittstelle Voxelwerk ↔ Spiel)');
eq(Object.fromEntries(PLAETZE.map((p) => [p, optionen[p]])), {
  koerper: ['standard'], frisur: ['kurz', 'stirnband', 'welle', 'offen', 'bartkurz', 'bartlang', 'zopfband', 'wild', 'keine'], kopf: ['keine', 'bordhelm'],
  oberteil: ['bordtunika', 'plankenweste', 'keine'], hose: ['bordhose', 'germanenhose', 'keine'], schuhe: ['bordstiefel', 'germanenstiefel', 'keine'],
  haende: ['keine', 'armschiene'], umhang: ['keiner', 'fellumhang'],
}, 'options der Sammelmodelle: Teilenamen exakt wie in der Schnittstelle, Standard zuerst, leerer Wert zuletzt');
ok(PLATZ_ENTFALLEN.every((p) => !(p in optionen)), 'Plätze gesicht und bart gibt es in den Sammelmodellen nicht mehr (festes Gesicht, Bart steckt in der Frisur)');

console.log('\n== Alle Kombinationen');
{
  const alle = PLAETZE.map((p) => optionen[p]).reduce((acc, ws) => acc.flatMap((c) => ws.map((w) => [...c, w])), [[]]);
  const params = (c) => Object.fromEntries(PLAETZE.map((p, i) => [p, c[i]]));
  const erwartet = PLAETZE.reduce((n, p) => n * optionen[p].length, 1);
  eq(alle.length, erwartet, `${erwartet} Kombinationen der Teile`);
  const fehler = []; let leer = 0, zuKlein = 0;
  for (const c of alle) {
    try { const r = baueFigur(lib, 'cha/spieler', { params: params(c) }); if (!r.grid.size) leer++; else if (r.grid.size < 1000) zuKlein++; }
    catch (e) { fehler.push(`${c.join('/')}: ${e.message}`); }
  }
  eq(fehler.slice(0, 3), [], `alle ${alle.length} Kombinationen bauen fehlerfrei (Teile)`);
  eq([leer, zuKlein], [0, 0], 'keine Kombination ist leer oder auffällig klein (< 1000 Voxel)');
  // Farben: jede Haut-Haar-Kombination an einer Stichprobe der Kombinationen (jede 37.)
  const probe = alle.filter((_, i) => i % 37 === 0);
  let gebaut = 0; const ff = [];
  for (const h of katalog.farben.haut) for (const hr of katalog.farben.haar) for (const c of probe) {
    try { baueFigur(lib, 'cha/spieler', { params: params(c), colors: { ...h, hair: hr } }); gebaut++; } catch (e) { ff.push(e.message); }
  }
  eq(ff.slice(0, 3), [], `Farben: ${gebaut} Figuren (${katalog.farben.haut.length} Hauttöne × ${katalog.farben.haar.length} Haarfarben × ${probe.length} Kombinationen) bauen fehlerfrei`);
  console.log(`    Kombinationen: ${alle.length} (Teile), ${gebaut} mit Farben`);
}

console.log('\n== Lecktest über alle Teile');
{
  const konfigs = [['Standard', {}], ...PLAETZE.flatMap((p) => optionen[p].map((w) => [`${p}=${w}`, kombi(p, w)]))];
  konfigs.push(['alles germanisch mit Stirnband', { frisur: 'stirnband', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' }]);
  konfigs.push(['Bordhelm, Fellumhang, Stirnband', { kopf: 'bordhelm', umhang: 'fellumhang', frisur: 'stirnband' }], ['Bordhelm, Fellumhang, offenes Haar', { kopf: 'bordhelm', umhang: 'fellumhang', frisur: 'offen' }]);
  const rollenAlle = basisRollen.filter((r) => !FIGURFARBEN.includes(r) && r !== 'black');
  const spielerRollen = ['primary', 'secondary', 'cloth', 'cloth2', 'spieler'];
  const pinkAlle = Object.fromEntries(rollenAlle.map((r) => [r, PINK]));
  const schlecht = { spieler: [], alle: [], black: [], haar: [] };
  let pinkMax = 0;
  for (const [name, params] of konfigs) {
    const base = baueFigur(lib, 'cha/spieler', { params });
    const dS = vergleiche(base.grid, baueFigur(lib, 'cha/spieler', { params, colors: Object.fromEntries(spielerRollen.map((r) => [r, PINK])) }).grid);
    if (dS.nurA + dS.nurB + dS.farbe) schlecht.spieler.push(`${name}: ${dS.farbe} Voxel`);
    const pa = zaehlePink(baueFigur(lib, 'cha/spieler', { params, colors: pinkAlle }).grid);
    pinkMax = Math.max(pinkMax, pa); if (pa) schlecht.alle.push(`${name}: ${pa} Magenta`);
    const dB = vergleiche(base.grid, baueFigur(lib, 'cha/spieler', { params, colors: { black: PINK } }).grid);
    if (dB.farbe) schlecht.black.push(`${name}: ${dB.farbe}`);
    // Haarfarbe wirkt nur im Kopf: kein Voxel eines anderen Gelenks ändert sich (der Fellumhang darf nicht der Haarfarbe folgen)
    const haar = baueFigur(lib, 'cha/spieler', { params, colors: { hair: PINK } });
    for (const [jn, vox] of Object.entries(base.pro)) if (jn !== 'head' && vox.some((v, i) => haar.pro[jn][i].c !== v.c)) schlecht.haar.push(`${name}: Gelenk ${jn}`);
  }
  eq(schlecht.spieler, [], `Spielerfarb-Rollen (${spielerRollen.join(', ')}) auf Magenta: bei allen ${konfigs.length} Konfigurationen ändert sich kein Voxel`);
  eq(schlecht.alle, [], `alle Basisrollen außer skin/skin_shadow/hair/black auf Magenta: bei allen ${konfigs.length} Konfigurationen 0 Magenta-Voxel (jedes Teil legt alle benutzten Rollen um)`);
  eq(schlecht.black, [], 'black auf Magenta ändert bei keiner Konfiguration etwas');
  eq(schlecht.haar, [], 'Haarfarbe (hair) auf Magenta ändert nur Voxel im Kopf-Gelenk, auch beim Fellumhang');
  // Positivkontrollen: dieselben Bestandsteile ohne Umlegung leaken
  const quellen = [['fig/germanen/rumpf', 'nord'], ['fig/germanen/oberarm', 'nord'], ['fig/germanen/oberschenkel', 'nord'], ['fig/germanen/unterschenkel', 'nord'], ['fig/crew/helm_offen', 'crew'], ['fig/rom/armschiene', 'rom'], ['fig/germanen/fellumhang', 'nord']];
  for (const [q, pal] of quellen) {
    await lib.load('models', q);
    const n = zaehlePink(lib.build(q, { palette: pal, colors: pinkAlle }).grid);
    ok(n > 10, `Positivkontrolle: ${q} ohne Umlegung ergibt ${n} Magenta-Voxel`);
  }
  ok(vergleiche(lib.build('fig/germanen/fellumhang', { palette: 'nord' }).grid, lib.build('fig/germanen/fellumhang', { palette: 'nord', colors: { hair: PINK } }).grid).farbe > 0, 'Positivkontrolle: im Bestand färbt hair die Fellflecken (deshalb nagelt der Fellumhang hair fest)');
  console.log(`    Konfigurationen: ${konfigs.length}, größter Magenta-Wert ${pinkMax}`);
}

console.log('\n== Farben je Teil (Platzrollen)');
{
  const pal = lib.get('palettes', 'cha').roles;   // nur die eigenen Rollen der Palette cha
  const teile = [...new Set(chaIds.filter((i) => /^cha\/[^/]+\/[^/]+\/[^/]+$/.test(i) && (get(i).tags || []).includes('schicht')).map((i) => i.split('/').slice(1, 3).join('/')))];
  const rollenIn = (ops = []) => ops.flatMap((o) => [...Object.values(o.colors || {}), ...(typeof o.color === 'string' ? [o.color] : []), ...rollenIn(o.ops)]);
  const fremd = [];
  for (const t of teile) {
    const name = t.split('/')[1];
    for (const id of chaIds.filter((i) => i.startsWith(`cha/${t}/`) && !(get(i).tags || []).includes('ops'))) for (const r of rollenIn(get(id).ops)) {
      if (typeof r === 'string' && pal[r] !== undefined && !FIGURFARBEN.includes(r) && !r.endsWith('_' + name)) fremd.push(`${id}: ${r}`);
    }
  }
  eq(fremd, [], 'jede Platzrolle, die ein Teil benutzt, trägt den Namen dieses Teils (<rolle>_<teil>): keine Rolle wird zwischen Teilen geteilt');
  const namen = teile.map((t) => t.split('/')[1]);
  eq(Object.keys(pal).filter((r) => r !== 'spieler' && !namen.some((n) => r.endsWith('_' + n))), [], 'die Palette cha enthält außer spieler nur Teilrollen');
  ok(pal.top_plankenweste === '#8E959D' && pal.top_bordtunika === '#5B2A5E', 'Plankenweste behält ihr Eisengrau, Bordtunika ihr Purpur (gleiche Rolle top, verschiedene Teile)');
  ok(pal.hose_germanenhose !== pal.hose_bordhose && pal.schuh_germanenstiefel !== pal.schuh_bordstiefel, 'Hosen und Stiefel behalten je ihre Bestandsfarben');
}

console.log('\n== Haut- und Haarfarben im Katalog');
{
  const { haut, haar } = katalog.farben;
  eq([haut.length, haar.length], [6, 8], '6 Hauttöne, 8 Haarfarben');
  eq([haut[0].skin, haut[0].skin_shadow, haar[0]], [fig.colors.skin, fig.colors.skin_shadow, fig.colors.hair], 'Index 0 = heutige Standardfarben der Figur');
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const abstand = (xs) => Math.min(...xs.flatMap((a, i) => xs.slice(i + 1).map((b) => Math.abs(lum(a) - lum(b)))));
  ok(abstand(haut.map((h) => h.skin)) >= 25, `Hauttöne deutlich unterscheidbar (kleinster Helligkeitsabstand ${abstand(haut.map((h) => h.skin)).toFixed(0)} von 255)`);
  ok(abstand(haar) >= 20, `Haarfarben deutlich unterscheidbar (kleinster Helligkeitsabstand ${abstand(haar).toFixed(0)} von 255)`);
  ok(haut.every((h) => lum(h.skin_shadow) < lum(h.skin)), 'skin_shadow ist je Hautton dunkler als skin');
  const lumHaut = haut.map((h) => lum(h.skin));
  ok(Math.max(...lumHaut) > 220 && Math.min(...lumHaut) < 50, `Hauttöne reichen von sehr hell (Helligkeit ${Math.max(...lumHaut).toFixed(0)}) bis sehr dunkel (${Math.min(...lumHaut).toFixed(0)})`);
  const a = baueFigur(lib, 'cha/spieler', { colors: { ...haut[1], hair: haar[2] } });
  const dd = vergleiche(std.grid, a.grid);
  ok(dd.farbe > 30 && dd.nurA + dd.nurB === 0, `Hautton 1 und Haarfarbe 2 färben ${dd.farbe} Voxel um, Geometrie unverändert`);
  for (let i = 0; i < haut.length; i++) for (let j = 0; j < haar.length; j++) if ((i + j) % 3 === 0) baueFigur(lib, 'cha/spieler', { colors: { ...haut[i], hair: haar[j] } });
  ok(true, 'Stichprobe Hautton × Haarfarbe baut fehlerfrei');
}

console.log('\n== Bordhelm: Haar und Haut unter der Schale');
{
  const HAARC = '#00FF00', HAUTC = '#FF8800', SCHC = '#CC5500';
  const cls = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; if (g > 150 && r < 90 && b < 90) return 'haar'; if (r > 140 && g > 40 && g < 150 && b < 25) return 'haut'; return 'sonst'; };
  const offen = (v) => v.z >= OEFFNUNG.zMin && v.x >= OEFFNUNG.xMin && v.x <= OEFFNUNG.xMax && v.y >= OEFFNUNG.yMin && v.y <= OEFFNUNG.yMax;   // Gesichtsöffnung des Helms (vor der Schale)
  const flaeche = (vox) => { const s = new Set(vox.map(schluessel)); return vox.filter((v) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => !s.has(schluessel({ x: v.x + a, y: v.y + b, z: v.z + c })))); };
  const messe = (params) => {
    const r = baueFigur(lib, 'cha/spieler', { params, colors: { hair: HAARC, skin: HAUTC, skin_shadow: SCHC } });
    const f = flaeche(r.pro.head.filter((v) => v.y >= 24));   // sichtbare Voxel des Kopfes
    return { haarAussen: f.filter((v) => cls(v.c) === 'haar' && !offen(v)), haarOffen: f.filter((v) => cls(v.c) === 'haar' && offen(v)), hautAussen: f.filter((v) => cls(v.c) === 'haut' && v.y >= 26 && !offen(v)), gesicht: f.filter((v) => cls(v.c) === 'haut' && offen(v)).map(schluessel).sort() };
  };
  const rep = [];
  for (const frisur of ['kurz', 'stirnband', 'welle', 'offen', 'keine']) {
    const m = messe({ kopf: 'bordhelm', frisur }), o = messe({ kopf: 'keine', frisur });
    eq([m.haarAussen.length, m.hautAussen.length], [0, 0], `Bordhelm + ${frisur}: 0 Haar- und 0 Hautvoxel außerhalb der Gesichtsöffnung (Schale, hinten, unten)`);
    eq(m.gesicht, o.gesicht, `Bordhelm + ${frisur}: Haut in der Gesichtsöffnung unverändert (die Maske schneidet nur das Haar)`);
    ok(frisur === 'keine' || o.haarAussen.length > 40, `Kontrolle ohne Helm (${frisur}): ${o.haarAussen.length} Haar- und ${o.hautAussen.length} Hautvoxel außen`);
    rep.push(`${frisur} ${m.haarOffen.length}`);
  }
  console.log('    Haar in der Gesichtsöffnung (Stirnfransen, Brauen, gewollt): ' + rep.join(', '));
  const seite = (params) => baueFigur(lib, 'cha/spieler', { params, colors: { skin: HAUTC, skin_shadow: SCHC } }).pro.head.filter((v) => (v.x === 3 || v.x === -4) && v.y >= 26 && v.y <= 31 && v.z <= 2 && cls(v.c) === 'haut');
  eq([seite({ kopf: 'bordhelm', frisur: 'keine' }).length, seite({ kopf: 'keine', frisur: 'keine' }).length > 0], [0, true], 'Schläfen: ohne Helm sichtbar, unter dem Bordhelm abgedeckt (der 8er-Kopf hat keine Ohren)');
}

console.log('\n== Römische Frisuren (CHA-02 B1)');
{
  const ROM = ['kurz', 'stirnband', 'welle', 'offen'];
  const HAARC = '#00FF00', GOLD = 0xD9A441, BLAU = 0x2C5DB8;
  const KOPFHUELLE = { x: [-5, 4], y: [23, 34], z: [-5, 4] };   // Schädel x -4..3, y 26..32, z -4..3 plus Hals; Haar bis 1 Voxel darüber (hinten bis z -5, vorn bis z 4: Tolle der Welle über der Stirn, Nacken bis y 23)
  const kopfVon = (l, params, colors = {}) => baueFigur(l, 'cha/spieler', { params, colors }).pro.head;
  const nackt = new Map(kopfVon(lib, { frisur: 'keine' }).map((v) => [schluessel(v), v]));
  const draussen = (vox) => vox.filter((v) => v.x < KOPFHUELLE.x[0] || v.x > KOPFHUELLE.x[1] || v.y < KOPFHUELLE.y[0] || v.y > KOPFHUELLE.y[1] || v.z < KOPFHUELLE.z[0] || v.z > KOPFHUELLE.z[1]);
  /** Haar-Hülle: Voxel der Frisur außerhalb von Hals und Schädel müssen in KOPFHUELLE liegen (höchstens 1 Voxel über dem Schädel) */
  const huellenFehler = (l, f) => draussen(kopfVon(l, { frisur: f }).filter((v) => !nackt.has(schluessel(v)))).map(schluessel);
  /** Haarrolle nur im Haar: Farbwechsel der Haarfarbe ändert nur Voxel der Frisur, feste Teilfarben (Stirnband, Ohrring) bleiben */
  const festeFarben = (vox) => vox.filter((v) => v.c === GOLD || v.c === BLAU).map(schluessel).sort();
  const leck = (l, f) => {
    const a = kopfVon(l, { frisur: f }, { hair: '#3B2416' }), b = kopfVon(l, { frisur: f }, { hair: '#FF00FF' }), c = kopfVon(l, { frisur: f }, { hair: '#E0BF6A' });
    const geaendert = a.filter((v, i) => v.c !== b[i].c);
    const haut = kopfVon(l, { frisur: 'keine' }, { hair: '#FF00FF' });   // Nackt: Haarfarbe ändert nichts
    return { n: geaendert.length, festA: festeFarben(a), festB: festeFarben(b), festC: festeFarben(c), nackt: nackt.size === haut.length && [...nackt.values()].every((v) => haut.find((w) => w.x === v.x && w.y === v.y && w.z === v.z).c === v.c) };
  };
  for (const f of ROM) {
    const id = `cha/frisur/${f}/head`;
    ok(!!get(id) && get(id).anchor.every((v) => v === 0) && get(`${id}_ops`).anchor.every((v) => v === 0), `${f}: Teil existiert, anchor [0,0,0]`);
    const k = kopfVon(lib, { frisur: f });
    ok(k.length > nackt.size + 20, `${f}: baut (${k.length} Kopfvoxel, nackt ${nackt.size})`);
    eq(huellenFehler(lib, f), [], `${f}: Haar höchstens 1 Voxel über dem Schädel (x -5..4, y bis 34, z ab -5, Nacken bis y 23), Hals und Schädel bleiben 8 breit`);
    eq([...nackt.values()].filter((v) => !k.some((w) => w.x === v.x && w.y === v.y && w.z === v.z)).length, 0, `${f}: kein Schädel- oder Halsvoxel fehlt (der Kopf bleibt 8 × 7 × 8)`);
    const gesicht = [...nackt.values()].filter((v) => v.z === 3 && v.y <= 29), m = new Map(k.map((w) => [schluessel(w), w]));
    eq(gesicht.filter((v) => m.get(schluessel(v)).c !== v.c).length, 0, `${f}: das Gesicht (z 3, y 26..29: Augen, Mund, Wangen) bleibt frei`);
    const l = leck(lib, f);
    ok(l.n > 40, `${f}: die Haarfarbe färbt ${l.n} Voxel um`);
    ok(l.nackt, 'Kontrolle: bei Frisur keine ändert die Haarfarbe nichts');
    eq([l.festA, l.festB].map((x) => x.join()).every((x) => x === l.festC.join()), true, `${f}: feste Teilfarben (Stirnband-Gold, Ohrring-Blau) hängen nicht an der Haarfarbe`);
  }
  eq(Object.fromEntries(ROM.map((f) => [f, [leck(lib, f).festA.length > 0, kopfVon(lib, { frisur: f }).some((v) => v.c === BLAU)]])), { kurz: [false, false], stirnband: [true, false], welle: [false, false], offen: [true, true] }, 'feste Farben nur dort, wo sie gehören: Stirnband-Gold (stirnband), Ohrring-Blau (offen)');
  const pal = lib.get('palettes', 'cha').roles;
  eq([pal.band_stirnband, pal.ohrring_offen], ['#D9A441', '#2C5DB8'], 'Stirnband und Ohrring: feste eigene Farbrollen je Teil (band_stirnband, ohrring_offen), keine Haarfarbe');
  // Haarfarbe: jede der 8 Farben ergibt andere Haarvoxel
  { const bilder = katalog.farben.haar.map((h) => kopfVon(lib, { frisur: 'welle' }, { hair: h }).map((v) => v.c).join()); ok(new Set(bilder).size === 8, 'Haarfarben: alle 8 Farben ergeben verschiedene Köpfe (Welle)'); }
  // Mutationsprobe Haarrolle: das Stirnband färbt sich mit der Haarfarbe → der Lecktest wird rot
  {
    const l2 = nodeLibrary(root); for (const id of chaIds) await l2.load('models', id); await l2.load('figures', 'cha/spieler');
    const b = l2.get('models', 'cha/frisur/stirnband/head_ops').ops.find((o) => o.name === 'Stirnband vorn'); b.color = 'hair';
    const lk = leck(l2, 'stirnband'), vorn = kopfVon(l2, { frisur: 'stirnband' }).filter((v) => v.c === GOLD).length;
    ok(lk.festA.join() !== leck(lib, 'stirnband').festA.join() && vorn < festeFarben(kopfVon(lib, { frisur: 'stirnband' })).length, 'Mutationsprobe: Stirnband in Haarfarbe → die feste Goldfarbe fehlt vorn, der Lecktest meldet die Abweichung');
    const l3 = nodeLibrary(root); for (const id of chaIds) await l3.load('models', id); await l3.load('figures', 'cha/spieler');
    l3.get('models', 'cha/frisur/welle/head_ops').ops.push({ op: 'box', name: 'Haarsträhne zu weit', at: [6, 28, -1], size: [1, 3, 1], color: 'hair' });
    ok(huellenFehler(l3, 'welle').length === 3, 'Mutationsprobe: ein Haarstrang bei x 6 (2 Voxel über der Hülle) wird von der Hüllenprüfung gemeldet');
    const l4 = nodeLibrary(root); for (const id of chaIds) await l4.load('models', id); await l4.load('figures', 'cha/spieler');
    const sk = l4.get('models', 'cha/frisur/kurz/head_ops').ops; sk.push({ op: 'box', name: 'Auge zugehaart', at: [1, 28, 3], size: [1, 1, 1], color: 'hair' });
    const k4 = kopfVon(l4, { frisur: 'kurz' }), m4 = new Map(k4.map((w) => [schluessel(w), w]));
    ok([...nackt.values()].filter((v) => v.z === 3 && v.y <= 29 && m4.get(schluessel(v)).c !== v.c).length === 1, 'Mutationsprobe: Haar über dem Auge wird von der Gesichtsprüfung gemeldet');
  }
  // Frisur × Bordhelm: ohne Haarmaske sticht jede Frisur durch den Helm, mit der Maske nicht
  {
    const aussen = (l, f) => haarAussen(baueFigur(l, 'cha/spieler', { params: { frisur: f, kopf: 'bordhelm' }, colors: { hair: HAARC } }).pro.head).length;
    eq(ROM.map((f) => aussen(lib, f)), [0, 0, 0, 0], 'Bordhelm × jede der vier Frisuren: kein sichtbares Haar außerhalb der Gesichtsöffnung (Haarmaske)');
    const l2 = nodeLibrary(root); for (const id of chaIds) await l2.load('models', id); await l2.load('figures', 'cha/spieler');
    l2.get('models', 'cha/kopf/bordhelm/head_maske').ops = [];
    ok(ROM.every((f) => aussen(l2, f) > 10), `Mutationsprobe: Bordhelm ohne Haarmaske → bei jeder der vier Frisuren sticht Haar durch (${ROM.map((f) => aussen(l2, f)).join(', ')} Voxel)`);
    const l3 = nodeLibrary(root); for (const id of chaIds) await l3.load('models', id); await l3.load('figures', 'cha/spieler');
    for (const o of l3.get('models', 'cha/kopf/bordhelm/head_maske').ops) if (o.at[0] === -6) { o.at[0] = -4; o.size[0] = 8; }   // Maske nur so breit wie der Schädel
    const a3 = ROM.map((f) => aussen(l3, f));
    ok(a3[2] > 0 && a3[3] > 0, `Mutationsprobe: Maske nur 8 breit → Welle und offenes Haar (x -5/4) ragen am Helm vorbei (${a3.join(', ')} Voxel)`);
  }
  // Dreiecke: Frisuren nach Dreieckszahl des Kopfes (Mesher wie das Spiel), Standard und Worst Case der Figur
  {
    const tri = (params) => {
      const fg = lib.get('figures', 'cha/spieler'), p = { ...fg.params, ...params };
      let n = 0;
      for (const part of Object.values(fg.parts)) { const b = lib.build(part.model, { params: lib.partParams(part.model, p, part.params), palette: fg.palette, colors: fg.colors }); const mm = meshGrid(b.grid); n += (mm.lit.indices.length + mm.emit.indices.length) / 3; }
      return n;
    };
    const ALLE8 = [...ROM, 'bartkurz', 'bartlang', 'zopfband', 'wild'];
    const kopfTri = Object.fromEntries(['keine', ...ALLE8].map((f) => [f, tri({ frisur: f })]));
    console.log('    Dreiecke Spielerfigur (Standardkleidung) je Frisur: ' + Object.entries(kopfTri).map(([f, n]) => `${f} ${n}`).join(', '));
    const worst = tri({ kopf: 'bordhelm', frisur: 'offen', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' });
    console.log(`    Worst Case (Bordhelm, offenes Haar, volle Ausrüstung): ${worst} Dreiecke`);
    ok(ALLE8.every((f) => kopfTri[f] - kopfTri.keine <= 700), `jede der 8 Frisuren kostet höchstens 700 Dreiecke gegenüber dem kahlen Kopf (${ALLE8.map((f) => `${f} +${kopfTri[f] - kopfTri.keine}`).join(', ')})`);
    ok(worst <= 6000, `Worst Case der Spielerfigur höchstens 6000 Dreiecke (${worst}; Standard heute ${kopfTri.kurz})`);
  }
}

// =============================================================================================
// CHA-02 B2: vier germanische Frisuren mit Bart
// =============================================================================================
console.log('\n== Germanische Frisuren mit Bart (CHA-02 B2)');
{
  const G4 = ['bartkurz', 'bartlang', 'zopfband', 'wild'];
  const HAARC = '#00FF00';
  const frischB2 = async () => { const l = nodeLibrary(root); for (const id of chaIds) await l.load('models', id); await l.load('figures', 'cha/spieler'); return l; };
  const kopf = (l, params, colors = { hair: HAARC }) => baueFigur(l, 'cha/spieler', { params, colors }).pro.head;
  const koord = (v) => `${v.x},${v.y},${v.z}`;
  const istGruen = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > 150 && r < 90 && b < 90; };
  // Zöpfe sichtbar: Haarvoxel außerhalb der Kopfbreite (x <= -5 oder x >= 4, y <= 29, z >= 2, neben dem Gesicht), vor denen kein Kopfvoxel weiter vorn in derselben Spalte liegt (frei nach +z = Blick von vorn)
  const zopfSichtbar = (l, frisur) => { const h = kopf(l, { frisur }), s = new Set(h.map(koord)); return h.filter((v) => v.y <= 29 && v.z >= 2 && (v.x <= -5 || v.x >= 4) && istGruen(v.c) && ![1, 2, 3, 4, 5].some((d) => s.has(`${v.x},${v.y},${v.z + d}`))).length; };
  // Bart färbt mit: Voxel am Kinn und an den Wangen (z >= 3, y <= 27) ändern ihre Farbe, wenn hair auf Magenta steht
  const bartVoxel = (l, frisur) => { const a = kopf(l, { frisur }, { hair: '#3B2416' }), b = new Map(kopf(l, { frisur }, { hair: PINK }).map((v) => [koord(v), v])); return a.filter((v) => v.z >= 3 && v.y <= 27 && v.x >= -3 && v.x <= 2 && b.get(koord(v)) && b.get(koord(v)).c !== v.c).length; };
  const aussenHelm = (l, frisur) => haarAussen(kopf(l, { frisur, kopf: 'bordhelm' })).length;

  // 1. existiert, baut, steht im Katalog und in den options
  for (const f of G4) {
    const t = katalog.teile.find((x) => x.id === `frisur/${f}`);
    ok(t && t.volk === 'germanen' && get(`cha/frisur/${f}/head`) && optionen.frisur.includes(f), `frisur/${f} „${t?.name}“: Katalog (volk germanen), Modell cha/frisur/${f}/head, options`);
    const b = baueFigur(lib, 'cha/spieler', { params: { frisur: f } });
    ok(b.grid.size > 1400, `frisur/${f} baut (${b.grid.size} Voxel)`);
  }
  // 2. Kopfbreite 8: die Frisur fügt dem nackten Kopf nur hinzu oder färbt um (jedes Voxel des nackten Kopfes bleibt), der nackte Kopf bleibt 8 × 7 × 8
  eq(pruefeKopf(lib, 'cha/spieler', idx.models), [], 'nackter Kopf (Frisur keine) bleibt 8 × 7 × 8 mit Hals');
  const nackt = new Set(kopf(lib, { frisur: 'keine' }).map(koord));
  for (const f of G4) {
    const h = new Set(kopf(lib, { frisur: f }).map(koord));
    ok([...nackt].every((k) => h.has(k)), `${f}: der Schädel (8 breit) bleibt vollständig, die Frisur nimmt keinen Schädelvoxel weg`);
  }
  // 3. Haarfarbe färbt Haar UND Bart (Lecktest), feste Farben bleiben
  for (const f of ['bartkurz', 'bartlang']) ok(bartVoxel(lib, f) >= 8, `${f}: hair = Magenta färbt den Bart um (${bartVoxel(lib, f)} Voxel am Kinn und an den Wangen)`);
  for (const f of ['zopfband', 'wild']) ok(bartVoxel(lib, f) <= 4, `Kontrolle: ${f} hat keinen Bart (nur ${bartVoxel(lib, f)} Haarvoxel vorn unten)`);
  {
    const gold = (hair) => kopf(lib, { frisur: 'zopfband' }, { hair }).find((v) => v.y === 30 && v.z === 3 && v.x === 0).c;
    eq(gold('#3B2416') === gold(PINK), true, 'zopfband: Stirnband bleibt bei jeder Haarfarbe gleich (feste Teilrolle band_zopfband)');
    const perle = (hair) => kopf(lib, { frisur: 'wild' }, { hair }).find((v) => v.x === 4 && v.y === 25 && v.z === 2).c;
    eq(perle('#3B2416') === perle(PINK), true, 'wild: Perle bleibt bei jeder Haarfarbe gleich (feste Teilrolle perle_wild)');
    ok(lib.get('palettes', 'cha').roles.band_zopfband === '#D9A93A' && lib.get('palettes', 'cha').roles.perle_wild === '#3E6EB4', 'Stirnband-Gold und Perlenblau stehen als feste Rollen in der Palette cha');
  }
  // 4. Augen und Mund des festen Gesichts bleiben frei
  {
    const f0 = kopf(lib, { frisur: 'keine' });
    const gesicht = f0.filter((v) => (v.z === 3 && [-2, 1].includes(v.x) && [28, 29].includes(v.y)) || (v.z === 3 && [-1, 0].includes(v.x) && v.y === 26));
    for (const f of G4) { const h = new Map(kopf(lib, { frisur: f }).map((v) => [koord(v), v])); ok(gesicht.length === 6 && gesicht.every((v) => h.get(koord(v)).c === v.c), `${f}: Augen (4 Voxel) und Mund (2 Voxel) bleiben unverändert`); }
  }
  // 5. Frisur × Bordhelm: kein Haar außerhalb der Gesichtsöffnung, Haut in der Öffnung unverändert, nichts schwebt
  for (const f of G4) {
    eq(aussenHelm(lib, f), 0, `Bordhelm + ${f}: 0 sichtbare Haarvoxel außerhalb der Gesichtsöffnung (Schale, hinten, Seiten, Zöpfe, Locken)`);
    const ohne = haarAussen(kopf(lib, { frisur: f })).length;
    ok(ohne > 15, `Kontrolle ohne Helm (${f}): ${ohne} Haarvoxel außen`);
    const haut = (params) => kopf(lib, params, { hair: HAARC, skin: '#FF8800', skin_shadow: '#CC5500' }).filter((v) => v.z >= 3 && v.x >= OEFFNUNG.xMin && v.x <= OEFFNUNG.xMax && v.y >= 26 && v.y <= 30 && ((v.c >> 16) & 255) > 140 && ((v.c >> 8) & 255) < 150).map(koord).sort();
    eq(haut({ frisur: f, kopf: 'bordhelm' }), haut({ frisur: f, kopf: 'keine' }), `Bordhelm + ${f}: Haut in der Gesichtsöffnung unverändert (die Maske schneidet nur Haar)`);
    const vs = [...baueFigur(lib, 'cha/spieler', { params: { frisur: f, kopf: 'bordhelm' } }).grid.values()], m = new Map(vs.map((v) => [koord(v), v])), seen = new Set(), st = [vs[0]];
    seen.add(koord(vs[0]));
    while (st.length) { const a = st.pop(); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = `${a.x + dx},${a.y + dy},${a.z + dz}`; if (m.has(k) && !seen.has(k)) { seen.add(k); st.push(m.get(k)); } } }
    eq(m.size - seen.size, 0, `Bordhelm + ${f}: nichts schwebt`);
  }
  // 6. Zöpfe sichtbar von vorn (CHA-01-Befund: die alten Zöpfe hingen nur hinten); nichts geht durch Rumpf, Schulter, Arme
  {
    const n = zopfSichtbar(lib, 'zopfband');
    ok(n >= 10, `zopfband: ${n} Zopfvoxel außerhalb der Kopfbreite (x 4 und -5) bei z >= 2, von vorn frei sichtbar (mindestens 10)`);
    const ns = zopfSichtbar(lib, 'stirnband');
    ok(ns >= 5, `stirnband: der Zopf hängt vor der Schulter (x -5, z 3), ${ns} Voxel von vorn frei sichtbar (mindestens 5)`);
    eq(['kurz', 'offen', 'bartkurz'].map((f) => zopfSichtbar(lib, f)), [0, 0, 0], 'Kontrolle: Frisuren ohne Zopf haben 0 sichtbare Voxel außerhalb der Kopfbreite vorn');
    const schnitt = [];
    for (const f of G4) for (const o of [{ oberteil: 'bordtunika' }, { oberteil: 'plankenweste', umhang: 'fellumhang' }]) {
      const r = baueFigur(lib, 'cha/spieler', { params: { frisur: f, ...o } }), h = new Set(r.pro.head.map(koord));
      const n2 = Object.entries(r.pro).filter(([jn]) => jn !== 'head').flatMap(([, vs]) => vs).filter((v) => h.has(koord(v))).length;
      if (n2) schnitt.push(`${f}/${Object.values(o).join('+')}: ${n2}`);
    }
    eq(schnitt, [], 'kein Voxel der vier Frisuren liegt im selben Voxel wie Rumpf, Hüfte oder Arme (Ruhepose; Bordtunika bzw. Plankenweste mit Fellumhang)');
  }
  // 7. Mutationsproben der neuen Prüfungen
  {
    const l = await frischB2();
    for (const o of l.get('models', 'cha/frisur/zopfband/head_ops').ops) if (['Zopf', 'Zopf Ansatz', 'Zopfband'].includes(o.name)) o.at = [o.at[0], o.at[1], -5];
    ok(zopfSichtbar(l, 'zopfband') < 10, `Mutationsprobe: Zöpfe nach hinten (z -5) gelegt → Sichtbarkeitsprüfung rot (${zopfSichtbar(l, 'zopfband')} < 10)`);
    const l2 = await frischB2();
    for (const o of l2.get('models', 'cha/frisur/bartlang/head_ops').ops) if (['Kinn', 'Bart unten', 'Bart lang', 'Bart Spitze', 'Bart Wange', 'Bart Wange vorn', 'Oberlippe'].includes(o.name)) o.color = '#3B2416';
    ok(bartVoxel(l2, 'bartlang') < 8, `Mutationsprobe: Bart mit fester Farbe statt hair → Lecktest rot (${bartVoxel(l2, 'bartlang')} < 8)`);
    const l3 = await frischB2(), m = l3.get('models', 'cha/kopf/bordhelm/head_maske');
    m.ops = m.ops.filter((o) => !/\(B2\)/.test(o.name));
    ok(['zopfband', 'wild'].some((f) => aussenHelm(l3, f) > 0), `Mutationsprobe: Haarmaske ohne die B2-Boxen → Haar sticht durch den Helm (zopfband ${aussenHelm(l3, 'zopfband')}, wild ${aussenHelm(l3, 'wild')} Voxel)`);
    const l4 = await frischB2();
    l4.get('models', 'cha/frisur/bartlang/head_ops').ops.push({ op: 'box', name: 'Augenbinde', at: [1, 28, 3], size: [1, 2, 1], color: 'hair' });
    const h4 = new Map(kopf(l4, { frisur: 'bartlang' }).map((v) => [koord(v), v]));
    ok(!kopf(lib, { frisur: 'keine' }).filter((v) => v.z === 3 && v.x === 1 && [28, 29].includes(v.y)).every((v) => h4.get(koord(v)).c === v.c), 'Mutationsprobe: Haar über dem Auge → Augenprüfung rot');
  }
}

// =============================================================================================
// CHA-02 B (Nacharbeit): eigene Oberseite je Frisur, Bart kurz/lang, Zöpfe, wild ohne Einzelzacken
// =============================================================================================
console.log('\n== Frisuren unterscheidbar (Oberseite, Bart, wild)');
{
  const ALLE = ['kurz', 'stirnband', 'welle', 'offen', 'bartkurz', 'bartlang', 'zopfband', 'wild'];
  const HAARC = '#00FF00';
  const koord = (v) => `${v.x},${v.y},${v.z}`;
  const istGruen = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > 150 && r < 90 && b < 90; };
  const kopf = (l, frisur) => baueFigur(l, 'cha/spieler', { params: { frisur }, colors: { hair: HAARC } }).pro.head;
  const frisch = async () => { const l = nodeLibrary(root); for (const id of chaIds) await l.load('models', id); await l.load('figures', 'cha/spieler'); return l; };
  /** Höhenkarte der Oberseite: je Spalte (x, z) das höchste Haarvoxel mit y 32..34 (Draufsicht der Spielkamera) */
  const hoehe = (l, frisur) => { const m = new Map(); for (const v of kopf(l, frisur)) if (v.y >= 32 && istGruen(v.c)) { const k = v.x + ',' + v.z; m.set(k, Math.max(m.get(k) ?? 0, v.y)); } return m; };
  /** Unterschied zweier Oberseiten: Zahl der Spalten (x, z) mit verschiedener Haarhöhe */
  const unterschied = (a, b) => { let n = 0; for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) n++; return n; };
  const N_OBEN = 8;
  const karten = Object.fromEntries(ALLE.map((f) => [f, hoehe(lib, f)]));
  const paare = ALLE.flatMap((a, i) => ALLE.slice(i + 1).map((b) => [a, b, unterschied(karten[a], karten[b])]));
  const schlecht = paare.filter(([, , n]) => n < N_OBEN);
  eq(schlecht, [], `jede der ${paare.length} Frisurenpaare unterscheidet sich in der Oberseite (Höhenkarte y 32..34) in mindestens ${N_OBEN} Spalten (kleinster Wert ${Math.min(...paare.map((p) => p[2]))})`);
  // Mutationsprobe: zwei identische Kappen (bartkurz bekommt die Ops von stirnband, kurz die von offen) → Paarprüfung rot
  {
    const l = await frisch();
    l.get('models', 'cha/frisur/bartkurz/head_ops').ops = structuredClone(l.get('models', 'cha/frisur/stirnband/head_ops').ops);
    ok(unterschied(hoehe(l, 'bartkurz'), hoehe(l, 'stirnband')) < N_OBEN, 'Mutationsprobe: zwei identische Kappen (bartkurz = stirnband) → Oberseitenprüfung rot (Unterschied 0)');
    const l2 = await frisch();
    const kurz = l2.get('models', 'cha/frisur/kurz/head_ops').ops, offen = l2.get('models', 'cha/frisur/offen/head_ops').ops;
    l2.get('models', 'cha/frisur/kurz/head_ops').ops = structuredClone(offen);
    ok(unterschied(hoehe(l2, 'kurz'), hoehe(l2, 'offen')) < N_OBEN && kurz.length > 0, 'Mutationsprobe: kurz mit den Ops von offen → rot');
  }
  // bartkurz / bartlang: Frontsilhouette (Haarvoxel mit z >= 3 vor dem Gesicht, y <= 29) unterscheidet sich; bartlang steht vor (z >= 4), bartkurz ist flach
  {
    const front = (l, f) => new Set(kopf(l, f).filter((v) => v.z >= 3 && v.y <= 29 && istGruen(v.c)).map(koord));
    const vorn = (l, f) => kopf(l, f).filter((v) => v.z >= 4 && v.y <= 29 && istGruen(v.c)).length;
    const a = front(lib, 'bartkurz'), b = front(lib, 'bartlang');
    const diff = [...a].filter((k) => !b.has(k)).length + [...b].filter((k) => !a.has(k)).length;
    ok(diff >= 16, `bartkurz und bartlang unterscheiden sich in der Frontsilhouette (z >= 3) um ${diff} Voxel (mindestens 16)`);
    eq([vorn(lib, 'bartkurz'), vorn(lib, 'bartlang') >= 12], [0, true], `bartkurz ist flach (kein Bartvoxel bei z >= 4), bartlang steht vor (${vorn(lib, 'bartlang')} Voxel bei z >= 4)`);
    const mund = (f) => kopf(lib, f).filter((v) => v.z >= 3 && [-1, 0].includes(v.x) && v.y === 26 && istGruen(v.c)).length;
    eq([mund('bartkurz'), mund('bartlang')], [0, 0], 'Mund (x -1..0, y 26) bleibt bei beiden Bärten frei');
    const l = await frisch();
    l.get('models', 'cha/frisur/bartlang/head_ops').ops = structuredClone(l.get('models', 'cha/frisur/bartkurz/head_ops').ops);
    const a2 = front(l, 'bartkurz'), b2 = front(l, 'bartlang');
    ok([...a2].filter((k) => !b2.has(k)).length + [...b2].filter((k) => !a2.has(k)).length < 16, 'Mutationsprobe: bartlang mit den Ops von bartkurz → Frontsilhouettenprüfung rot');
  }
  // wild: keine Einzelzacken am Rand: kein 1×1×1-Haarvoxel auf y >= 33, das an x 4/-5 oder z -4/3 (bzw. weiter außen) liegt und in der Nachbarschaft (6er) frei ist
  {
    // "frei" = kein Nachbar außer dem darunterliegenden Haar; ein Einzelvoxel hängt also nur von unten an der Kappe
    const zacken = (l, f) => { const h = kopf(l, f), s = new Set(h.map(koord)); return h.filter((v) => v.y >= 33 && istGruen(v.c) && (v.x >= 4 || v.x <= -5 || v.z <= -4 || v.z >= 3) && [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].every(([a, b, c]) => !s.has(`${v.x + a},${v.y + b},${v.z + c}`))).map(koord); };
    eq(zacken(lib, 'wild'), [], 'wild: keine Einzelzacken (1×1×1-Haarvoxel mit freier Nachbarschaft auf y >= 33) am Rand (x 4/-5, z -4/3)');
    // Innere Buckel: höchstens drei Voxel-Cluster auf y 34, je höchstens 2×1×2
    const oben = kopf(lib, 'wild').filter((v) => v.y === 34 && istGruen(v.c));
    ok(oben.length <= 12 && oben.length >= 4, `wild: ${oben.length} Voxel auf y 34 (höchstens drei Buckel 2×1×2 im Inneren)`);
    ok(oben.every((v) => v.x >= -3 && v.x <= 1 && v.z >= -3 && v.z <= 1), 'wild: die Buckel liegen im Inneren (x -3..1, z -3..1), nicht am Rand');
    const l = await frisch();
    l.get('models', 'cha/frisur/wild/head_ops').ops.push({ op: 'box', name: 'Zacke Rand', at: [-4, 34, -4], size: [1, 1, 1], color: 'hair' }, { op: 'box', name: 'Zacke hinten', at: [1, 34, -4], size: [1, 1, 1], color: 'hair' });
    ok(zacken(l, 'wild').length >= 2, `Mutationsprobe: zwei Einzelzacken am Rand → Zackenprüfung rot (${zacken(l, 'wild').length} gefunden)`);
  }
}

console.log('\n== Schweben');
{
  const komp = (grid) => {
    const vs = [...grid.values()], m = new Map(vs.map((v) => [schluessel(v), v])), gesehen = new Set(), res = [];
    for (const v of vs) {
      if (gesehen.has(schluessel(v))) continue;
      const st = [v], c = []; gesehen.add(schluessel(v));
      while (st.length) { const a = st.pop(); c.push(a); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = schluessel({ x: a.x + dx, y: a.y + dy, z: a.z + dz }); if (m.has(k) && !gesehen.has(k)) { gesehen.add(k); st.push(m.get(k)); } } }
      res.push(c);
    }
    return res.sort((a, b) => b.length - a.length);
  };
  const lose = (params) => komp(baueFigur(lib, 'cha/spieler', { params }).grid).slice(1).flat().map(schluessel);
  eq(lose({}), [], 'Standardfigur: nichts schwebt');
  const schwebend = [];
  for (const [p, ws] of Object.entries(optionen)) for (const w of ws) { const l = lose(kombi(p, w)); if (l.length) schwebend.push(`${p}=${w}: ${l.join(' ')}`); }
  eq(schwebend, ['oberteil=plankenweste: -4,13,-4 -4,14,-4'], 'Einzelteile: nur die Werkzeugöse der Plankenweste schwebt (2 Voxel, Bestand fig/germanen/huefte, unverändert gelassen)');
  eq(['kurz', 'stirnband', 'welle', 'offen'].map((frisur) => lose({ frisur })), [[], [], [], []], 'alle vier Frisuren (Zopf, langes Haar, Strähnen, Ohrring) hängen am Kopf');
  const fell = [];
  for (const o of ['bordtunika', 'keine']) for (const h of ['bordhose', 'germanenhose']) { const l = lose({ umhang: 'fellumhang', oberteil: o, hose: h }); if (l.length) fell.push(`${o}/${h}: ${l.join(' ')}`); }
  eq(fell, [], 'Fellumhang ohne germanisches Oberteil: die Kette hängt an den Kettenhaltern');
  eq(['kurz', 'stirnband', 'welle', 'offen'].map((frisur) => lose({ kopf: 'bordhelm', frisur })), [[], [], [], []], 'Bordhelm mit jeder Frisur: nichts schwebt');
}

console.log('\n== Schichtfolge');
{
  const gleichAn = (A, B, fn = () => true) => { let n = 0, schlecht = 0; for (const v of A.grid.values()) { if (!fn(v)) continue; n++; const w = B.grid.get(v.x, v.y, v.z); if (!w || w.c !== v.c || w.e !== v.e) schlecht++; } return { n, schlecht }; };
  const L = (id) => lib.build(id), J = (g, params) => lib.build(`cha/joint/${g}`, { params });
  for (const hose of ['bordhose', 'germanenhose']) for (const schuhe of ['bordstiefel', 'germanenstiefel']) {
    const j = J('shin', { hose, schuhe }), s = L(`cha/schuhe/${schuhe}/shin`), h = L(`cha/hose/${hose}/shin`);
    const a = gleichAn(s, j), b = gleichAn(h, j, (v) => !s.grid.get(v.x, v.y, v.z));
    eq([a.schlecht, b.schlecht], [0, 0], `Unterschenkel ${schuhe} über ${hose}: ${a.n} Stiefelvoxel und ${b.n} freie Hosenvoxel stehen unverändert im Sammelmodell`);
  }
  for (const o of ['bordtunika', 'plankenweste']) for (const g of ['torso', 'hips', 'upperArm', 'lowerArm']) {
    const a = gleichAn(L(`cha/oberteil/${o}/${g}`), J(g, { oberteil: o }));
    eq(a.schlecht, 0, `${g}: alle ${a.n} Voxel von ${o} liegen über dem Körper (Saum über Körperhose, Ärmel über Körperarm)`);
  }
  for (const o of ['bordtunika', 'plankenweste']) {
    const a = gleichAn(L('cha/umhang/fellumhang/torso'), J('torso', { oberteil: o, umhang: 'fellumhang' }));
    eq(a.schlecht, 0, `torso: alle ${a.n} Voxel des Fellumhangs liegen über ${o}`);
    const b = gleichAn(L('cha/haende/armschiene/lowerArm'), J('lowerArm', { oberteil: o, haende: 'armschiene' }));
    eq(b.schlecht, 0, `lowerArm: alle ${b.n} Voxel der Armschiene liegen über dem Ärmel von ${o}`);
  }
  {
    const a = gleichAn(L('cha/hose/bordhose/shin'), J('shin', { hose: 'bordhose', schuhe: 'keine' })), b = gleichAn(L('cha/schuhe/bordstiefel/shin'), J('shin', { hose: 'keine', schuhe: 'bordstiefel' }));
    eq([a.schlecht, b.schlecht], [0, 0], 'Hose und Stiefel einzeln gewählt ergeben dieselben Voxel wie ihre Schichten (Schnitt bei y 6 stimmt)');
  }
  // Tunika-Saum und Hose liegen in verschiedenen Gelenken (Hüfte, Oberschenkel): die Überlappung der Gelenke bleibt im Rahmen des Bestands
  const ueber = (A, B) => { const s = new Set(A.map(schluessel)); return B.filter((v) => s.has(schluessel(v))).length; };
  let maxHT = 0, maxHL = 0, maxTU = 0;
  for (const o of optionen.oberteil) for (const h of optionen.hose) for (const u of optionen.umhang) {
    const r = baueFigur(lib, 'cha/spieler', { params: { oberteil: o, hose: h, umhang: u } });
    maxHT = Math.max(maxHT, ueber(r.pro.hips, [...r.pro.thighL, ...r.pro.thighR])); maxHL = Math.max(maxHL, ueber(r.pro.hips, [...r.pro.lowerArmL, ...r.pro.lowerArmR])); maxTU = Math.max(maxTU, ueber(r.pro.torso, [...r.pro.upperArmL, ...r.pro.upperArmR]));
  }
  ok(maxHT <= 28 && maxHL <= 24 && maxTU === 0, `Querüberlappung der Gelenke über alle Oberteil/Hose/Umhang-Kombinationen: Hüfte/Oberschenkel höchstens ${maxHT} (Bestand 24, Erkundung 28), Hüfte/Unterarm ${maxHL} (Bestand 24), Rumpf/Oberarm ${maxTU}`);
}

console.log('\n== Katalog');
const katalogPruefen = (k, o = optionen, f = fig) => pruefeKatalog(k, { modelIds: idx.models, optionen: o, figur: f });
{
  eq(katalogPruefen(katalog), [], 'Katalog ist konsistent mit Modellen und Figur');
  eq(Object.keys(katalog), ['version', 'figur', 'koerper', 'plaetze', 'teile', 'farben'], 'Katalog hat genau die Felder der Schnittstelle');
  eq(katalog.plaetze.map((p) => p.id), PLAETZE.filter((p) => p !== 'koerper'), 'plaetze in der Reihenfolge der Schnittstelle');
  eq(katalog.koerper, [{ id: 'standard', name: 'Standard' }], 'koerper: nur Standard');
  eq(katalog.version, 2, 'Katalog Version 2');
  ok(PLATZ_ENTFALLEN.every((p) => !katalog.plaetze.some((x) => x.id === p) && !katalog.teile.some((t) => t.platz === p || t.id.startsWith(p + '/'))), 'Katalog ohne Plätze und Teile von gesicht und bart');
  ok(!/"(gesicht|bart)"/.test(JSON.stringify(katalog)), 'im Katalog kommt weder gesicht noch bart als Schlüssel oder Wert vor');
  eq(katalog.teile.filter((t) => LEERE_WERTE.includes(t.id.split('/')[1])).map((t) => t.id), ['frisur/keine', 'kopf/keine', 'oberteil/keine', 'hose/keine', 'schuhe/keine', 'haende/keine', 'umhang/keiner'], 'keine/keiner je Platz im Katalog');
  ok(katalog.teile.filter((t) => t.gruppe === 'outfit').every((t) => t.herkunft === 'frei'), 'alle Outfit-Teile haben herkunft "frei"');
  ok(katalog.teile.every((t) => t.vorschau === `cha/vorschau/${t.platz}/${t.id.split('/')[1]}.png`), 'jedes Teil hat vorschau = cha/vorschau/<platz>/<name>.png (relativ zu assets/sprites/), auch die leeren Werte');
  eq(Object.fromEntries(katalog.teile.filter((t) => t.volk).map((t) => [t.id, t.volk])), {
    'frisur/kurz': 'rom', 'frisur/stirnband': 'rom', 'frisur/welle': 'rom', 'frisur/offen': 'rom', 'frisur/bartkurz': 'germanen', 'frisur/bartlang': 'germanen', 'frisur/zopfband': 'germanen', 'frisur/wild': 'germanen', 'kopf/bordhelm': 'crew',
    'oberteil/bordtunika': 'crew', 'oberteil/plankenweste': 'germanen', 'hose/bordhose': 'crew', 'hose/germanenhose': 'germanen', 'schuhe/bordstiefel': 'crew',
    'schuhe/germanenstiefel': 'germanen', 'haende/armschiene': 'rom', 'umhang/fellumhang': 'germanen',
  }, 'volk je Teil (lerche, crew, germanen, rom)');
  eq(Object.fromEntries(katalog.teile.map((t) => [t.id, t.name])), {
    'frisur/kurz': 'Kurzschnitt', 'frisur/stirnband': 'Stirnband mit Zopf', 'frisur/welle': 'Welle', 'frisur/offen': 'Offenes Haar', 'frisur/bartkurz': 'Kurzhaar mit Bart', 'frisur/bartlang': 'Langhaar mit Vollbart', 'frisur/zopfband': 'Zöpfe mit Stirnband', 'frisur/wild': 'Wildes Haar', 'frisur/keine': 'Kahl',
    'kopf/keine': 'Keine', 'kopf/bordhelm': 'Bordhelm', 'oberteil/bordtunika': 'Bordtunika', 'oberteil/plankenweste': 'Plankenweste', 'oberteil/keine': 'Unterzeug',
    'hose/bordhose': 'Bordhose', 'hose/germanenhose': 'Germanenhose', 'hose/keine': 'Unterzeug', 'schuhe/bordstiefel': 'Bordstiefel', 'schuhe/germanenstiefel': 'Germanenstiefel', 'schuhe/keine': 'Barfuß',
    'haende/keine': 'Keine', 'haende/armschiene': 'Armschiene', 'umhang/keiner': 'Keiner', 'umhang/fellumhang': 'Fellumhang',
  }, 'Anzeigenamen deutsch und kurz (leere Werte: Unterzeug bei Oberteil und Hose, Barfuß bei Schuhen)');
}

console.log('\n== Mutationsprobe Katalog (die Prüfung erkennt manipulierte Kataloge)');
{
  const kl = () => structuredClone(katalog);
  const rot = (k, re, msg, o, f) => ok(katalogPruefen(k, o, f).some((x) => re.test(x.msg)), msg);
  eq(katalogPruefen(kl()), [], 'Gegenprobe: unveränderter Katalog ohne Befund');
  { const k = kl(); k.teile.push({ id: 'hose/phantasiehose', platz: 'hose', name: 'Phantasie', gruppe: 'outfit', herkunft: 'frei' }); rot(k, /kein Modell/, 'Katalog-ID ohne Modell wird erkannt'); rot(k, /keine options/, '… und als Teil ohne options-Ausprägung der Figur erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'kopf/bordhelm').gruppe = 'charakter'; rot(k, /Gruppe des Platzes/, 'falsche Gruppe eines Teils wird erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'kopf/bordhelm').platz = 'hose'; rot(k, /passt nicht zur id/, 'falscher Platz eines Teils wird erkannt'); }
  { const k = kl(); k.teile = k.teile.filter((t) => t.id !== 'oberteil/plankenweste'); rot(k, /fehlt im Katalog/, 'options-Ausprägung der Figur ohne Katalogeintrag wird erkannt'); }
  { const k = kl(); k.plaetze.unshift({ id: 'gesicht', name: 'Gesicht', gruppe: 'charakter', standard: 'lerche' }); k.teile.unshift({ id: 'gesicht/lerche', platz: 'gesicht', name: 'Lerche', gruppe: 'charakter', vorschau: 'cha/vorschau/gesicht/lerche.png' }); rot(k, /Platz "gesicht" ist seit Version 2 kein Platz mehr/, 'Katalog mit Platz gesicht wird erkannt'); rot(k, /Teile von "gesicht" gibt es seit Version 2 nicht mehr/, '… samt seiner Teile'); }
  { const k = kl(); k.plaetze.push({ id: 'bart', name: 'Bart', gruppe: 'charakter', standard: 'keiner' }); rot(k, /Platz "bart" ist seit Version 2 kein Platz mehr/, 'Katalog mit Platz bart wird erkannt'); }
  { const f = structuredClone(fig); f.params = { ...f.params, bart: 'keiner' }; rot(kl(), /entfallenen Platz "bart"/, 'Figur-params mit dem entfallenen Platz bart werden erkannt', undefined, f); }
  { const k = kl(); k.version = 1; rot(k, /version 1 \(erwartet 2\)/, 'Katalogversion 1 wird erkannt'); }
  { const k = kl(); k.farben.haar.pop(); rot(k, /erwartet 8/, 'nur 7 Haarfarben werden erkannt'); }
  { const k = kl(); [k.plaetze[0], k.plaetze[1]] = [k.plaetze[1], k.plaetze[0]]; rot(k, /Reihenfolge/, 'vertauschte Plätze werden erkannt'); }
  { const k = kl(); k.plaetze.find((p) => p.id === 'umhang').standard = 'fellumhang'; rot(k, /Figurwert/, 'abweichender Standard eines Platzes wird erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'kopf/bordhelm').vorschau = 'cha/vorschau/kopf/anderer.png'; rot(k, /vorschau/, 'falscher vorschau-Pfad wird erkannt'); }
  { const k = kl(); delete k.teile.find((t) => t.id === 'hose/keine').vorschau; rot(k, /vorschau/, 'fehlende vorschau eines leeren Werts wird erkannt'); }
  { const k = kl(); k.farben.haut.pop(); rot(k, /erwartet 6/, 'nur 5 Hauttöne werden erkannt'); }
  { const k = kl(); k.farben.haar[1] = 'schwarz'; rot(k, /Hexwert/, 'Haarfarbe ohne Hexwert wird erkannt'); }
  { const k = kl(); k.farben.haut[0].skin = '#FFFFFF'; rot(k, /Hautton der Figur/, 'haut[0] ungleich Figurfarbe wird erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'hose/bordhose').herkunft = 'geschenkt'; rot(k, /herkunft/, 'ungültige herkunft wird erkannt'); }
  rot(kl(), /options-Ausprägung der Figur fehlt/, 'Figur mit zusätzlicher options-Ausprägung (umhang=drachenhaut) wird erkannt', { ...optionen, umhang: [...optionen.umhang, 'drachenhaut'] });
  { const f = structuredClone(fig); f.params.umhang = 'drachenhaut'; rot(kl(), /Figurwert/, 'Figur-Standard, den der Katalog nicht kennt, wird erkannt', undefined, f); }
  { const k = kl(); k.teile.find((t) => t.id === 'frisur/kurz').id = 'frisur/kurz/x'; rot(k, /<platz>\/<name>/, 'id mit drei Segmenten wird erkannt'); }
  // Rolle PINNEN: hair festnageln nur beim Umhang erlaubt
  const U = 'cha/umhang/fellumhang/torso', T = 'cha/oberteil/bordtunika/torso';
  ok(pruefeRollen(idx.models, get).every((f) => f.id !== U), 'Fellumhang darf hair festnageln (PINNEN), die Regel bleibt für ihn ohne Befund');
  { const w = klon(U); w.ops[0].colors = { ...w.ops[0].colors, skin: 'umhang_fellumhang' }; ok(hat(pruefeRollen(idx.models, mit({ [U]: w })), U, /colors setzt skin/), 'Fellumhang darf skin nicht festnageln'); }
  { const w = klon(T); w.ops[0].colors = { ...w.ops[0].colors, hair: 'top_bordtunika' }; ok(hat(pruefeRollen(idx.models, mit({ [T]: w })), T, /colors setzt hair/), 'andere Teile dürfen hair nicht festnageln'); }
}

// =============================================================================================
// A3: Posen in Node, Passprobe, Mutationsprobe
// =============================================================================================
console.log('\n== Posen in Node (tools/cha-pose.mjs) gegen three.js applyPose');
const posen = lib.get('poses', 'human') || (await lib.load('poses', 'human'));
{
  const nahe = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);
  // Ruhepose: jeder Punkt bleibt, wo er ist
  const M0 = gelenkMatrizen(rig, { joints: {}, lift: 0 });
  ok(Object.keys(rig.joints).every((j) => nahe(weltPunkt(rig, M0, j, [3.5, 9.25, -2]), [3.5, 9.25, -2])), 'ohne Winkel bleibt jeder Punkt aller Gelenke an seinem Platz');
  // Von Hand nachgerechnet: rechter Oberarm 90° nach vorn (x = -90°), Schulter bei (-5.5, 23, 0)
  const M1 = gelenkMatrizen(rig, { joints: { upperArmR: [-90, 0, 0] }, lift: 0 });
  ok(nahe(weltPunkt(rig, M1, 'lowerArmR', rig.joints.lowerArmR.at), [-5.5, 23, 6]), 'Ellbogen rechts bei 90° nach vorn: (-5,5 | 23 | 6) = 6 Voxel vor der Schulter');
  ok(nahe(weltPunkt(rig, M1, 'handR', rig.joints.handR.at), [-5.5, 23.5, 11]), 'Handgelenk rechts: (-5,5 | 23,5 | 11) (11 Voxel Armlänge vor der Schulter, 0,5 Versatz nach oben)');
  // Seitlich: z = +90° hebt den linken Arm seitlich (Ellbogen 6 Voxel neben der Schulter)
  const M2 = gelenkMatrizen(rig, { joints: { upperArmL: [0, 0, 90] }, lift: 0 });
  ok(nahe(weltPunkt(rig, M2, 'lowerArmL', rig.joints.lowerArmL.at), [11.5, 23, 0]), 'linker Arm z = +90°: Ellbogen 6 Voxel seitlich der Schulter (x 11,5)');
  // lift senkt die Hüfte und alles darunter in der Hierarchie
  const M3 = gelenkMatrizen(rig, { joints: {}, lift: -7 });
  ok(nahe(weltPunkt(rig, M3, 'head', [0, 25, 0]), [0, 18, 0]) && nahe(weltPunkt(rig, M3, 'shinL', [2, 3, 0]), [2, -4, 0]), 'lift -7 senkt Kopf und Schienbein um 7 Voxel (Hüfte, Kind-Gelenke folgen)');
  // aim: rechte Hand liegt vor der Schulter (Waffenarm)
  const Maim = gelenkMatrizen(rig, poseWerte(posen, 'aim'));
  const hand = weltPunkt(rig, Maim, 'handR', rig.joints.handR.at);
  ok(hand[2] > 8 && Math.abs(hand[1] - 23) < 3, `aim: rechte Hand (${hand.map((v) => v.toFixed(1))}) liegt 8+ Voxel vor der Wurzel auf Schulterhöhe`);
  eq(poseWerte(posen, 'walk', 0.25).joints.thighL, [-2 - 26, 0, 0], 'walk φ ¼: Oberschenkel links bei -28° (Umkehrpunkt des cycle)');
  eq(poseWerte(posen, 'walk', 0.75).joints.thighL, [-2 + 26, 0, 0], 'walk φ ¾: Oberschenkel links bei +24° (anderer Umkehrpunkt)');
  eq(poseWerte(posen, 'walk', 0).lift, -0.5 + 0.6 * 0.5, 'walk φ 0: lift = pose.lift + bob·0,5');
}
{
  // three.js (vendor/) ohne Browser laden: der bare Import 'three' wird auf vendor/three.module.js umgelenkt
  const tUrl = pathToFileURL(path.join(root, 'vendor', 'three.module.js')).href;
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){ if(s==='three') return {url:${JSON.stringify(tUrl)},shortCircuit:true}; return n(s,c); }`));
  const V = await import(pathToFileURL(path.join(root, 'render', 'voxel-three.js')).href);
  const fo = V.figureObject(lib, 'cha/spieler', { phase: 0 });
  const r = baueFigur(lib, 'cha/spieler');
  /** Eckpunkte aller Voxel nach meiner Transformation (auf 1/1000 Voxel gerundet) je Gelenk */
  const eckenVon = (jn, M) => {
    const set = new Set();
    for (const v of r.pro[jn]) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) set.add(weltPunkt(rig, M, jn, [v.x + dx, v.y + dy, v.z + dz]).map((a) => Math.round(a * 1e3)).join(','));
    return set;
  };
  const fehlend = (jn, ecken) => {   // Netz-Eckpunkte aus three.js (Weltposition in Voxeln), die keine Voxelecke meiner Transformation sind
    const modell = fo.joints[jn].children.find((c) => c.userData.voxels !== undefined), mesh = modell.children.find((c) => c.isMesh && !c.userData.bloom);
    const pos = mesh.geometry.getAttribute('position'), w = mesh.position.clone();
    let n = 0, gesamt = 0;
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      gesamt++; if (!ecken.has([w.x, w.y, w.z].map((a) => Math.round(a / fo.s * 1e3)).join(','))) n++;
    }
    return { n, gesamt };
  };
  const gelenke = Object.keys(r.pro);
  const abgleich = (pose, phi) => {
    const w = poseWerte(posen, pose, phi);
    fo.poses.__abgleich = { joints: w.joints, lift: w.lift, breathe: 0, look: false };
    V.applyPose(fo, '__abgleich', 0);
    fo.root.updateMatrixWorld(true);
    const M = gelenkMatrizen(rig, w);
    let n = 0, gesamt = 0;
    for (const jn of gelenke) { const x = fehlend(jn, eckenVon(jn, M)); n += x.n; gesamt += x.gesamt; }
    return { n, gesamt };
  };
  for (const [pose, phi] of [['aim'], ['sit'], ['aim_rifle'], ['kneel'], ['walk', 0.25], ['walk', 0.75]]) {
    const a = abgleich(pose, phi);
    eq([a.n, a.gesamt > 6000], [0, true], `${pose}${phi !== undefined ? ' φ ' + phi : ''}: alle ${a.gesamt} Netz-Eckpunkte der ${gelenke.length} Gelenke (three.js applyPose: YXZ, lift, Spiegelteile) liegen auf Voxelecken meiner Node-Transformation`);
  }
  // Positivkontrolle: three.js steht in aim, meine Matrizen sind die für sit → passt nicht
  abgleich('aim');
  const falsch = gelenke.reduce((n, jn) => n + fehlend(jn, eckenVon(jn, gelenkMatrizen(rig, poseWerte(posen, 'sit')))).n, 0);
  ok(falsch > 3000, `Positivkontrolle: three.js in aim gegen meine Matrizen für sit: ${falsch} Eckpunkte ohne Treffer`);
  const w = poseWerte(posen, 'aim'), a1 = eulerYXZ(w.joints.upperArmR), a2 = eulerYXZ([w.joints.upperArmR[0], 0, 0]);
  ok(a1.some((v, i) => Math.abs(v - a2[i]) > 0.01), 'aim (upperArmR hat x und y): die y-Drehung geht in die Matrix ein');
  ok(!('poses' in fig) && !('posen' in fig) && rig.poses === 'human', 'cha/spieler hat keine eigenen Posen: Posenquelle ist assets/poses/human.json (Rig human)');
}

console.log('\n== Passprobe (alle Kombinationen × Posen)');
for (const f of ['fig/germanen/grundtyp', 'rom/legionaer']) await ladeFigur(lib, f);
const BESTAND = ['lerche/crew_0', 'fig/germanen/grundtyp', 'rom/legionaer'];
const passe = (l) => pruefePassung(l, 'cha/spieler', idx.models, { bestand: BESTAND });
{
  const r = passe(lib);
  eq(r.fehler, [], `Passprobe über alle ${r.kombinationen} Kombinationen × ${Object.keys(r.messung).length} Posenzustände ohne Befund`);
  eq(r.kombinationen, 1944, '1944 Kombinationen (Produkt der options aller Plätze, ohne gesicht und bart)');
  ok(r.sekunden < 20, `Laufzeit ${r.sekunden.toFixed(1)} s (Grenze 20 s)`);
  console.log(`    Laufzeit ${r.sekunden.toFixed(1)} s`);
  const alle = Object.entries(r.messung);
  ok(alle.every(([, l]) => l.every((x) => x.max <= x.schwelle)), 'jede Messung (Prüfsatz-Maximum je Pose und Paar) liegt unter der Bestandsschwelle des Paares');
  ok(alle.some(([, l]) => l.some((x) => x.bestand > 20)), 'Positivkontrolle: die Bestandsfiguren zeigen selbst Durchdringungen (Schwelle ist nicht 0)');
  const ueberPose = alle.flatMap(([z, l]) => l.filter((x) => x.max > x.bestand).map((x) => `${z} ${x.paar} ${x.max}/${x.bestand}`));
  console.log(`    über dem Bestandswert derselben Pose (aber unter der Paarschwelle): ${ueberPose.length}${ueberPose.length ? ' – ' + ueberPose.join('; ') : ''}`);
}

console.log('\n== Mutationsprobe Passprobe (manipulierte Modelle im Speicher)');
{
  const frisch = async () => {
    const l = nodeLibrary(root);
    for (const id of chaIds) await l.load('models', id);
    await l.load('figures', 'cha/spieler'); await l.load('rigs', 'human'); await l.load('poses', 'human');
    for (const f of BESTAND) await ladeFigur(l, f);
    return l;
  };
  const rot = async (name, aendere, re, nurDiese) => {
    const l = await frisch(); aendere(l);
    const r = passe(l);
    ok(r.fehler.length > 0 && r.fehler.some((f) => re.test(f.msg)), `${name}: Passprobe rot (${r.fehler.length} Befunde, z. B. „${(r.fehler.find((f) => re.test(f.msg)) || r.fehler[0] || { msg: '–' }).msg.slice(0, 110)}“)`);
    if (nurDiese) ok(r.fehler.every((f) => nurDiese.test(f.msg)), `${name}: alle Befunde sind von dieser Art (die anderen Prüfungen bleiben grün)`);
  };
  eq(passe(await frisch()).fehler, [], 'Gegenprobe: unveränderte Modelle in frischer Bibliothek bleiben grün');
  await rot('(a) Hose-Oberschenkel mit einem Voxel bei x 10 (außerhalb des Gelenks)', (l) => l.get('models', 'cha/hose/bordhose/thigh').ops.push({ op: 'box', name: 'Ausreißer', at: [10, 7, 0], size: [1, 1, 1], color: '#ff0000' }), /Gelenk thighL: 1 Voxel außerhalb von Bereich/, /außerhalb von Bereich/);
  await rot('(b) Bordhelm ohne Haarmaske: Haar sticht durch den Helm', (l) => { l.get('models', 'cha/kopf/bordhelm/head_maske').ops = []; }, /Haar sticht durch bordhelm/, /Haar sticht durch/);
  await rot('(c) Armschiene als Block im erlaubten Bereich (3×7×5): ragt in Posen in Nachbargelenke', (l) => l.get('models', 'cha/haende/armschiene/lowerArm').ops.push({ op: 'box', name: 'Block', at: [4, 10, -2], size: [3, 7, 5], color: '#ff0000' }), /Pose \S+.*durchdringen sich/, /durchdringen sich/);
  await rot('(c2) Oberschenkel-Block der Hose im erlaubten Bereich: Durchdringung beim Sitzen und Knien', (l) => l.get('models', 'cha/hose/bordhose/thigh').ops.push({ op: 'box', name: 'Block', at: [0, 7, -2], size: [4, 7, 5], color: '#ff0000' }), /Pose (sit|kneel).*durchdringen sich/);
  await rot('(d) Sammelmodell mit kaputtem Teil: Kombinationen bauen nicht', (l) => { const op = l.get('models', 'cha/joint/torso').ops.find((o) => /oberteil/.test(o.model)); op.model = 'cha/oberteil/{oberteil}/gibtsnicht'; op.fallback = []; }, /Baufehler|leer/);
}

console.log('\n== Spielerfarbe nie in der Kleidung');
{
  const SPIELERFARBEN = ['#56B4E9', '#E69F00', '#CC79A7', '#7FE0C2'];   // Pantheon shared/protocol.js PLAYER_COLORS
  const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const hex2 = (h) => rgb(parseInt(h.slice(1), 16));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const farben = new Map();   // Farbwert → erste Kombination
  const alle = PLAETZE.map((p) => optionen[p]).reduce((acc, ws) => acc.flatMap((c) => ws.map((w) => [...c, w])), [[]]);
  for (const c of alle) {
    const r = baueFigur(lib, 'cha/spieler', { params: Object.fromEntries(PLAETZE.map((p, i) => [p, c[i]])) });
    for (const v of r.grid.values()) if (!farben.has(v.c)) farben.set(v.c, c.join('/'));
  }
  let kleinster = Infinity, wo = '';
  for (const [c, k] of farben) for (const s of SPIELERFARBEN) { const d = dist(rgb(c), hex2(s)); if (d < kleinster) { kleinster = d; wo = `#${c.toString(16).padStart(6, '0')} bei ${k}`; } }
  ok(kleinster >= 40, `kein Voxel aller ${alle.length} Kombinationen (${farben.size} Farbwerte) liegt im RGB-Abstand < 40 zu einer der vier Spielerfarben (kleinster Abstand ${kleinster.toFixed(0)}, ${wo})`);
  const pal = lib.get('palettes', 'cha').roles;
  ok(pal.hut_zier_bordhelm === '#B3342B', 'Bordhelm: Akzentstreifen fest in Crew-Rot (#B3342B), nicht mehr die Spielerfarbe');
  ok(SPIELERFARBEN.every((s) => dist(hex2('#B3342B'), hex2(s)) > 100), 'Crew-Rot ist keiner Spielerfarbe ähnlich (Abstand > 100)');
  const bestandHelm = lib.build('fig/crew/helm_offen', { palette: 'crew' });
  ok([...bestandHelm.grid.values()].some((v) => dist(rgb(v.c), hex2('#56B4E9')) < 40), 'Positivkontrolle: der Bestandshelm fig/crew/helm_offen hat Voxel in Spielerfarbe S1');
}

console.log('\n== Vorschaubilder und Porträt (A4)');
{
  const sprites = path.join(root, 'assets', 'sprites');
  const png = (t) => { try { return decodePng(fs.readFileSync(path.join(sprites, t.vorschau))); } catch (e) { return { fehler: e.message }; } };
  const alle = katalog.teile.map((t) => [t, png(t)]);
  eq(alle.filter(([, b]) => b.fehler).map(([t, b]) => `${t.id}: ${b.fehler}`), [], `jede Katalog-Vorschau (${alle.length}) existiert und ist ein gültiges PNG (Signatur, CRC, Daten)`);
  eq([...new Set(alle.filter(([, b]) => !b.fehler).map(([, b]) => `${b.w}x${b.h}`))], [`${KACHEL.w}x${KACHEL.h}`], `alle Vorschauen sind ${KACHEL.w} × ${KACHEL.h} (doppelte Bildfläche der Kachel 70 × 62 im Spielraster)`);
  const deckung = (b) => { let n = 0; for (let i = 3; i < b.rgba.length; i += 4) if (b.rgba[i]) n++; return n / (b.w * b.h); };
  ok(alle.every(([, b]) => !b.fehler && deckung(b) > 0.05 && deckung(b) < 0.8), 'jede Vorschau zeigt etwas (5 % bis 80 % der Fläche deckend), Rest transparent');
  ok(alle.every(([, b]) => !b.fehler && [0, b.w - 1].every((x) => [0, b.h - 1].every((y) => b.rgba[(y * b.w + x) * 4 + 3] === 0))), 'Ecken transparent (kein Hintergrund)');
  const bytes = alle.reduce((n, [t]) => n + fs.statSync(path.join(sprites, t.vorschau)).size, 0);
  ok(bytes < 200 * 1024, `alle Vorschauen zusammen ${(bytes / 1024).toFixed(1)} KB (unter 200 KB)`);
  const dateien = fs.readdirSync(path.join(sprites, 'cha', 'vorschau'), { recursive: true }).filter((f) => f.endsWith('.png')).map((f) => 'cha/vorschau/' + f.replace(/\\/g, '/')).sort();
  eq(dateien, alle.map(([t]) => t.vorschau).sort(), 'keine überzähligen Bilder im Ordner vorschau/');
  ok(katalog.plaetze.every((p) => FENSTER[p.id]), 'jeder Katalogplatz hat ein Vorschaufenster');
  // Unterscheidbar: je Platz sehen verschiedene Werte verschieden aus (sonst zeigt das Fenster den Platz nicht)
  for (const p of katalog.plaetze) {
    const bilder = katalog.teile.filter((t) => t.platz === p.id).map((t) => Buffer.from(png(t).rgba || []).toString('base64'));
    ok(new Set(bilder).size === bilder.length, `Platz ${p.id}: alle ${bilder.length} Werte haben verschiedene Bilder`);
  }
  // Wiederholbar: gleiches Teil zweimal gerendert gibt dieselben Bildpunkte, und die Datei im Repo ist der aktuelle Stand
  const teil = katalog.teile.find((t) => t.id === 'kopf/bordhelm'), b1 = vorschauBild(lib, katalog, teil.id), b2 = vorschauBild(lib, katalog, teil.id);
  ok(Buffer.from(b1.d).equals(Buffer.from(b2.d)), 'Rendern ist deterministisch (zweimal dasselbe Bild)');
  ok(Buffer.from(b1.d).equals(Buffer.from(png(teil).rgba)), 'eingechecktes kopf/bordhelm.png entspricht dem Renderer');
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [path.join(root, 'tools', 'gen-cha-vorschau.mjs'), '--check'], { encoding: 'utf8' }); } catch (e) { code = e.status; out = String(e.stdout); }
  ok(code === 0, `gen-cha-vorschau --check: Bilder stimmen mit dem Generator überein (${out.trim().split('\n').pop()})`);
  // --check erkennt veraltete Bilder (Mutationsprobe auf einer Kopie)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cha-vorschau-'));
  try {
    for (const d of ['assets', 'tools', 'core']) fs.cpSync(path.join(root, d), path.join(tmp, d), { recursive: true });
    const vz = path.join(tmp, 'assets', 'sprites', 'cha', 'vorschau'), f = path.join(vz, 'hose', 'bordhose.png'), b = fs.readFileSync(f);
    const px = decodePng(b); px.rgba[(60 * px.w + 70) * 4] ^= 0x40; px.rgba[(60 * px.w + 70) * 4 + 3] = 255;
    fs.writeFileSync(f, encodePng(px.w, px.h, px.rgba));
    fs.unlinkSync(path.join(vz, 'schuhe', 'keine.png'));
    fs.writeFileSync(path.join(vz, 'frisur', 'phantom.png'), b);
    let c2 = 0, o2 = '';
    try { o2 = execFileSync(process.execPath, [path.join(tmp, 'tools', 'gen-cha-vorschau.mjs'), '--check'], { encoding: 'utf8' }); } catch (e) { c2 = e.status; o2 = String(e.stdout); }
    ok(c2 === 1 && /hose\/bordhose\.png: veraltet/.test(o2) && /schuhe\/keine\.png: fehlt/.test(o2) && /frisur\/phantom\.png: überzählig/.test(o2), '--check meldet verändertes, fehlendes und überzähliges Bild (Exit 1)');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // Porträt aus einer Charakterkarte (Format der Spiel-Karte: Charakterplätze, haut, haar, outfit)
  const karte = { v: 2, name: 'Test', koerper: 'standard', frisur: 'stirnband', haut: 2, haar: 3, outfit: { kopf: 'bordhelm', oberteil: 'plankenweste' } };
  const o = kartenOptionen(katalog, karte);
  eq(o.params, { frisur: 'stirnband', kopf: 'bordhelm', oberteil: 'plankenweste', hose: 'bordhose', schuhe: 'bordstiefel', haende: 'keine', umhang: 'keiner', koerper: 'standard' }, 'Karte → Plätze: fehlende Plätze nehmen den Katalog-Standard');
  eq(o.colors, { ...katalog.farben.haut[2], hair: katalog.farben.haar[3] }, 'Karte → Farben: haut- und haar-Index aus dem Katalog');
  const pa = portraet(lib, katalog, karte), pb = portraet(lib, katalog, { ...karte, haar: 0, haut: 0 }), pc = portraet(lib, katalog, karte, { bg: [0, 4, 19, 255] });
  ok(pa.w === PORTRAET.w && pa.h === PORTRAET.h && PORTRAET.w === PORTRAET.h, `Porträt quadratisch ${PORTRAET.w} × ${PORTRAET.h} (Fenster 130 × 130 im Spielraster, doppelt)`);
  ok(!Buffer.from(pa.d).equals(Buffer.from(pb.d)), 'Porträt ändert sich mit Haut- und Haarindex');
  ok(pa.d[3] === 0 && pc.d[3] === 255, 'Porträt: transparent ohne bg, deckend mit bg');
}

console.log('\n== Generator und Rig');
{
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [path.join(root, 'tools', 'gen-cha.mjs'), '--check'], { encoding: 'utf8' }); } catch (e) { code = e.status; out = String(e.stdout); }
  ok(code === 0, `gen-cha --check: erzeugte Dateien stimmen mit dem Generator überein (${out.trim()})`);
}
{
  const gelenke = Object.keys(rig.joints).filter((j) => !['root', 'back', 'handL', 'handR'].includes(j));
  ok(gelenke.every((j) => rig.bereiche?.[j]), `Rig human: Bereich für alle ${gelenke.length} Körpergelenke`);
  ok(Object.values(rig.bereiche).every((b) => b.min.every((v, i) => v <= b.max[i])), 'Bereiche: min <= max');
  ok(Object.values(rig.toleranzen).every((g) => Object.entries(g).every(([gat, t]) => GELENK_LINKS[gat] && [...t.min, ...t.max].every((v) => v >= 0))), 'Toleranzen: bekannte Gattungen, nur nichtnegative Werte');
  const spiegel = (b) => [-b.max[0] - 1, -b.min[0] - 1];
  for (const [l, r] of [['upperArmL', 'upperArmR'], ['lowerArmL', 'lowerArmR'], ['thighL', 'thighR'], ['shinL', 'shinR']]) eq(spiegel(rig.bereiche[l]), [rig.bereiche[r].min[0], rig.bereiche[r].max[0]], `Bereich ${r} ist ${l} an x = 0 gespiegelt`);
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
