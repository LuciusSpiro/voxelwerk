// Tests der Spielerfigur aus Schichten (cha/): Standardfigur, Voxelgleichheit zu lerche/crew_0, Farbrollen (Lecktest),
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
import { pruefeAnker, pruefeRollen, pruefeBereiche, pruefeFigur, pruefeKatalog, platzOptionen, baueFigur, vergleiche, FIGURFARBEN, GELENK_LINKS, LEERE_WERTE, pruefePassung, ladeFigur } from './cha-lib.mjs';
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
  koerper: ['standard'], gesicht: ['lerche', 'narbe'], frisur: ['dutt', 'zoepfe', 'keine'], bart: ['keiner', 'vollbart'], kopf: ['keine', 'bordhelm'],
  oberteil: ['bordtunika', 'plankenweste', 'keine'], hose: ['bordhose', 'germanenhose', 'keine'], schuhe: ['bordstiefel', 'germanenstiefel', 'keine'],
  haende: ['keine', 'armschiene'], umhang: ['keiner', 'fellumhang'],
}, 'options der Sammelmodelle: Teilenamen exakt wie in der Schnittstelle, Standard zuerst, leerer Wert zuletzt');
ok(!optionen.gesicht.includes('keine'), 'Gesicht ist Pflicht: kein Wert "keine"');

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
  eq(ff.slice(0, 3), [], `Farben: ${gebaut} Figuren (4 Hauttöne × 4 Haarfarben × ${probe.length} Kombinationen) bauen fehlerfrei`);
  console.log(`    Kombinationen: ${alle.length} (Teile), ${gebaut} mit Farben`);
}

console.log('\n== Lecktest über alle Teile');
{
  const konfigs = [['Standard', {}], ...PLAETZE.flatMap((p) => optionen[p].map((w) => [`${p}=${w}`, kombi(p, w)]))];
  konfigs.push(['alles germanisch', { frisur: 'zoepfe', bart: 'vollbart', oberteil: 'plankenweste', hose: 'germanenhose', schuhe: 'germanenstiefel', haende: 'armschiene', umhang: 'fellumhang' }]);
  konfigs.push(['Bordhelm, Fellumhang, Narbe, Vollbart', { kopf: 'bordhelm', umhang: 'fellumhang', gesicht: 'narbe', bart: 'vollbart' }]);
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
  eq([haut.length, haar.length], [4, 4], '4 Hauttöne, 4 Haarfarben');
  eq([haut[0].skin, haut[0].skin_shadow, haar[0]], [fig.colors.skin, fig.colors.skin_shadow, fig.colors.hair], 'Index 0 = heutige Standardfarben der Figur');
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const abstand = (xs) => Math.min(...xs.flatMap((a, i) => xs.slice(i + 1).map((b) => Math.abs(lum(a) - lum(b)))));
  ok(abstand(haut.map((h) => h.skin)) >= 25, `Hauttöne deutlich unterscheidbar (kleinster Helligkeitsabstand ${abstand(haut.map((h) => h.skin)).toFixed(0)} von 255)`);
  ok(abstand(haar) >= 20, `Haarfarben deutlich unterscheidbar (kleinster Helligkeitsabstand ${abstand(haar).toFixed(0)} von 255)`);
  ok(haut.every((h) => lum(h.skin_shadow) < lum(h.skin)), 'skin_shadow ist je Hautton dunkler als skin');
  const a = baueFigur(lib, 'cha/spieler', { colors: { ...haut[1], hair: haar[2] } });
  const dd = vergleiche(std.grid, a.grid);
  ok(dd.farbe > 30 && dd.nurA + dd.nurB === 0, `Hautton 1 und Haarfarbe 2 färben ${dd.farbe} Voxel um, Geometrie unverändert`);
}

console.log('\n== Bordhelm: Haar und Haut unter der Schale');
{
  const HAARC = '#00FF00', HAUTC = '#FF8800', SCHC = '#CC5500';
  const cls = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; if (g > 150 && r < 90 && b < 90) return 'haar'; if (r > 140 && g > 40 && g < 150 && b < 25) return 'haut'; return 'sonst'; };
  const offen = (v) => v.z >= 2 && v.x >= -2 && v.x <= 1 && v.y >= 26 && v.y <= 31;   // Gesichtsöffnung des Helms (vor der Schale)
  const flaeche = (vox) => { const s = new Set(vox.map(schluessel)); return vox.filter((v) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => !s.has(schluessel({ x: v.x + a, y: v.y + b, z: v.z + c })))); };
  const messe = (params) => {
    const r = baueFigur(lib, 'cha/spieler', { params, colors: { hair: HAARC, skin: HAUTC, skin_shadow: SCHC } });
    const f = flaeche(r.pro.head.filter((v) => v.y >= 24));   // sichtbare Voxel des Kopfes
    return { haarAussen: f.filter((v) => cls(v.c) === 'haar' && !offen(v)), haarOffen: f.filter((v) => cls(v.c) === 'haar' && offen(v)), hautAussen: f.filter((v) => cls(v.c) === 'haut' && v.y >= 26 && !offen(v)), gesicht: f.filter((v) => cls(v.c) === 'haut' && offen(v)).map(schluessel).sort() };
  };
  const rep = [];
  for (const frisur of ['dutt', 'zoepfe', 'keine']) for (const gesicht of ['lerche', 'narbe']) {
    const m = messe({ kopf: 'bordhelm', frisur, gesicht }), o = messe({ kopf: 'keine', frisur, gesicht });
    eq([m.haarAussen.length, m.hautAussen.length], [0, 0], `Bordhelm + ${frisur} + ${gesicht}: 0 Haar- und 0 Hautvoxel außerhalb der Gesichtsöffnung (Schale, Ohren, hinten, unten)`);
    eq(m.gesicht, o.gesicht, `Bordhelm + ${frisur} + ${gesicht}: Haut in der Gesichtsöffnung unverändert (die Maske schneidet nur das Haar)`);
    ok(frisur === 'keine' || o.haarAussen.length > 40, `Kontrolle ohne Helm (${frisur}/${gesicht}): ${o.haarAussen.length} Haar- und ${o.hautAussen.length} Hautvoxel außen`);
    rep.push(`${frisur}/${gesicht} ${m.haarOffen.length}`);
  }
  console.log('    Haar in der Gesichtsöffnung (Stirnfransen, Brauen, gewollt): ' + rep.join(', '));
  const ohren = (params) => baueFigur(lib, 'cha/spieler', { params, colors: { skin: HAUTC, skin_shadow: SCHC } }).pro.head.filter((v) => (v.x === 3 || v.x === -4) && v.y >= 26 && v.y <= 28 && v.z === 0 && cls(v.c) === 'haut');
  eq([ohren({ kopf: 'bordhelm' }).length, ohren({ kopf: 'keine' }).length > 0], [0, true], 'Ohren: ohne Helm sichtbar, unter dem Bordhelm abgedeckt');
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
  eq(lose({ bart: 'vollbart', gesicht: 'narbe', frisur: 'zoepfe' }), [], 'Vollbart: der Bartzopf hängt am Kinn');
  const fell = [];
  for (const o of ['bordtunika', 'keine']) for (const h of ['bordhose', 'germanenhose']) { const l = lose({ umhang: 'fellumhang', oberteil: o, hose: h }); if (l.length) fell.push(`${o}/${h}: ${l.join(' ')}`); }
  eq(fell, [], 'Fellumhang ohne germanisches Oberteil: die Kette hängt an den Kettenhaltern');
  eq(lose({ kopf: 'bordhelm', frisur: 'zoepfe', bart: 'vollbart' }), [], 'Bordhelm mit Zöpfen und Vollbart: nichts schwebt (Ohrring und Ohren sind mit abgeschnitten)');
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
  eq(katalog.teile.filter((t) => t.platz === 'gesicht').map((t) => t.id), ['gesicht/lerche', 'gesicht/narbe'], 'Gesicht: lerche und narbe, kein leerer Wert');
  eq(katalog.teile.filter((t) => LEERE_WERTE.includes(t.id.split('/')[1])).map((t) => t.id), ['frisur/keine', 'bart/keiner', 'kopf/keine', 'oberteil/keine', 'hose/keine', 'schuhe/keine', 'haende/keine', 'umhang/keiner'], 'keine/keiner je Platz im Katalog, außer beim Gesicht');
  ok(katalog.teile.filter((t) => t.gruppe === 'outfit').every((t) => t.herkunft === 'frei'), 'alle Outfit-Teile haben herkunft "frei"');
  ok(katalog.teile.every((t) => t.vorschau === `cha/vorschau/${t.platz}/${t.id.split('/')[1]}.png`), 'jedes Teil hat vorschau = cha/vorschau/<platz>/<name>.png (relativ zu assets/sprites/), auch die leeren Werte');
  eq(Object.fromEntries(katalog.teile.filter((t) => t.volk).map((t) => [t.id, t.volk])), {
    'gesicht/lerche': 'lerche', 'gesicht/narbe': 'lerche', 'frisur/dutt': 'lerche', 'frisur/zoepfe': 'germanen', 'bart/vollbart': 'germanen', 'kopf/bordhelm': 'crew',
    'oberteil/bordtunika': 'crew', 'oberteil/plankenweste': 'germanen', 'hose/bordhose': 'crew', 'hose/germanenhose': 'germanen', 'schuhe/bordstiefel': 'crew',
    'schuhe/germanenstiefel': 'germanen', 'haende/armschiene': 'rom', 'umhang/fellumhang': 'germanen',
  }, 'volk je Teil (lerche, crew, germanen, rom)');
  eq(Object.fromEntries(katalog.teile.map((t) => [t.id, t.name])), {
    'gesicht/lerche': 'Lerche', 'gesicht/narbe': 'Narbe', 'frisur/dutt': 'Dutt', 'frisur/zoepfe': 'Zöpfe', 'frisur/keine': 'Kahl', 'bart/keiner': 'Kein Bart', 'bart/vollbart': 'Vollbart',
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
  { const k = kl(); k.teile.push({ id: 'gesicht/keine', platz: 'gesicht', name: 'Keines', gruppe: 'charakter' }); rot(k, /keine options/, 'gesicht/keine im Katalog (Gesicht ist Pflicht) wird erkannt'); }
  { const k = kl(); [k.plaetze[0], k.plaetze[1]] = [k.plaetze[1], k.plaetze[0]]; rot(k, /Reihenfolge/, 'vertauschte Plätze werden erkannt'); }
  { const k = kl(); k.plaetze.find((p) => p.id === 'umhang').standard = 'fellumhang'; rot(k, /Figurwert/, 'abweichender Standard eines Platzes wird erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'kopf/bordhelm').vorschau = 'cha/vorschau/kopf/anderer.png'; rot(k, /vorschau/, 'falscher vorschau-Pfad wird erkannt'); }
  { const k = kl(); delete k.teile.find((t) => t.id === 'hose/keine').vorschau; rot(k, /vorschau/, 'fehlende vorschau eines leeren Werts wird erkannt'); }
  { const k = kl(); k.farben.haut.pop(); rot(k, /erwartet 4/, 'nur 3 Hauttöne werden erkannt'); }
  { const k = kl(); k.farben.haar[1] = 'schwarz'; rot(k, /Hexwert/, 'Haarfarbe ohne Hexwert wird erkannt'); }
  { const k = kl(); k.farben.haut[0].skin = '#FFFFFF'; rot(k, /Hautton der Figur/, 'haut[0] ungleich Figurfarbe wird erkannt'); }
  { const k = kl(); k.teile.find((t) => t.id === 'hose/bordhose').herkunft = 'geschenkt'; rot(k, /herkunft/, 'ungültige herkunft wird erkannt'); }
  rot(kl(), /options-Ausprägung der Figur fehlt/, 'Figur mit zusätzlicher options-Ausprägung (umhang=drachenhaut) wird erkannt', { ...optionen, umhang: [...optionen.umhang, 'drachenhaut'] });
  { const f = structuredClone(fig); f.params.bart = 'zopfbart'; rot(kl(), /Figurwert/, 'Figur-Standard, den der Katalog nicht kennt, wird erkannt', undefined, f); }
  { const k = kl(); k.teile.find((t) => t.id === 'frisur/dutt').id = 'frisur/dutt/x'; rot(k, /<platz>\/<name>/, 'id mit drei Segmenten wird erkannt'); }
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
  eq(r.kombinationen, 2592, '2592 Kombinationen (Produkt der options aller Plätze)');
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
    fs.writeFileSync(path.join(vz, 'bart', 'phantom.png'), b);
    let c2 = 0, o2 = '';
    try { o2 = execFileSync(process.execPath, [path.join(tmp, 'tools', 'gen-cha-vorschau.mjs'), '--check'], { encoding: 'utf8' }); } catch (e) { c2 = e.status; o2 = String(e.stdout); }
    ok(c2 === 1 && /hose\/bordhose\.png: veraltet/.test(o2) && /schuhe\/keine\.png: fehlt/.test(o2) && /bart\/phantom\.png: überzählig/.test(o2), '--check meldet verändertes, fehlendes und überzähliges Bild (Exit 1)');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // Porträt aus einer Charakterkarte (Format der Spiel-Karte: Charakterplätze, haut, haar, outfit)
  const karte = { v: 1, name: 'Test', koerper: 'standard', gesicht: 'narbe', frisur: 'zoepfe', bart: 'vollbart', haut: 2, haar: 3, outfit: { kopf: 'bordhelm', oberteil: 'plankenweste' } };
  const o = kartenOptionen(katalog, karte);
  eq(o.params, { gesicht: 'narbe', frisur: 'zoepfe', bart: 'vollbart', kopf: 'bordhelm', oberteil: 'plankenweste', hose: 'bordhose', schuhe: 'bordstiefel', haende: 'keine', umhang: 'keiner', koerper: 'standard' }, 'Karte → Plätze: fehlende Plätze nehmen den Katalog-Standard');
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
