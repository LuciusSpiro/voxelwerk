// Tests der Spielerfigur aus Schichten (cha/): Standardfigur, Voxelgleichheit zu lerche/crew_0, Farbrollen (Lecktest),
// Haut/Haar über Figur-colors, Prüfregeln samt Mutationsprobe, Generator wiederholbar, Rig-Bereiche.
// Aufruf: node tools/test-cha.mjs        (Exit-Code 1 bei Fehlern)
// Liest assets/ aus dem Repo (nichts wird geschrieben).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nodeLibrary, listAssets } from './fs-io.js';
import { pruefeAnker, pruefeRollen, pruefeBereiche, pruefeFigur, baueFigur, vergleiche, FIGURFARBEN, GELENK_LINKS } from './cha-lib.mjs';

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
eq(Object.keys(fig.params), ['koerper', 'gesicht', 'frisur', 'bart', 'kopf', 'oberteil', 'hose', 'schuhe', 'haende', 'umhang'], 'params genau mit den Platzschlüsseln der Schnittstelle (Reihenfolge der Plätze)');
eq(fig.params, { koerper: 'standard', gesicht: 'lerche', frisur: 'dutt', bart: 'keiner', kopf: 'keine', oberteil: 'bordtunika', hose: 'bordhose', schuhe: 'bordstiefel', haende: 'keine', umhang: 'keiner' }, 'Standardwerte laut Schnittstelle');
eq(Object.keys(fig.colors).sort(), ['hair', 'skin', 'skin_shadow'], 'Figur-colors setzen nur Haut und Haar');
const std = baueFigur(lib, 'cha/spieler');
ok(std.grid.size > 1000, `Standardfigur baut (${std.grid.size} Voxel)`);

console.log('\n== Voxelgleich zu lerche/crew_0');
const ref = baueFigur(lib, 'lerche/crew_0');
const d = vergleiche(ref.grid, std.grid);
console.log(`    crew_0 ${d.a} Voxel, cha/spieler ${d.b} Voxel, gleich ${d.gleich}, nur crew_0 ${d.nurA}, nur cha ${d.nurB}, andere Farbe ${d.farbe}`);
ok(d.nurA === 0 && d.nurB === 0, `Geometrie identisch (${d.gleich} von ${d.a} Voxeln)`);
ok(d.farbe === 0, `Farben identisch (${d.farbe} Abweichungen; die frühere Spielerfarbe cloth2 steht als feste Teilfarbe in der Palette cha)`);
for (const jn of Object.keys(ref.pro)) eq(std.pro[jn].length, ref.pro[jn].length, `Gelenk ${jn}: gleiche Voxelzahl`);

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
  const g = klon('cha/gesicht/lerche/head'); g.ops[0].colors = { hair: 'schmuck' };
  ok(hat(pruefeRollen(idx.models, mit({ 'cha/gesicht/lerche/head': g })), 'cha/gesicht/lerche/head', /hair/), 'colors.hair in einer Kopf-Schicht wird erkannt');
}
{
  // Bereiche: Rig-Daten manipulieren (Bereich verkleinert bzw. Toleranz entfernt), die Schichten müssen rot werden
  const S = 'cha/hose/bordhose/thigh', D = 'cha/frisur/dutt/head', bauen = (id) => lib.build(id);
  const rig2 = structuredClone(rig); rig2.bereiche.thighL.max[1] = 9;
  ok(hat(pruefeBereiche(idx.models, get, bauen, rig2), S, /y max 13 > 9/), 'Schicht außerhalb des (verkleinerten) Bereichs wird erkannt');
  const rig3 = structuredClone(rig); delete rig3.toleranzen.frisur;
  const f3 = pruefeBereiche(idx.models, get, bauen, rig3);
  ok(hat(f3, D, /y max 33 > 30/) && hat(f3, D, /z min -5 < -3/), 'Dutt ohne Toleranz für frisur verletzt den Kopfbereich (Toleranz wird gebraucht und benutzt)');
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
