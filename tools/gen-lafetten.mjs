// Erzeugt die Lafetten-Familie der Lerche (PAN-01 Paket C): assets/models/lerche/station/lafette_*.json
//   node tools/gen-lafetten.mjs           schreibt die Dateien
//   node tools/gen-lafetten.mjs --check   vergleicht nur (Exit 1 bei Abweichung)
// Quelle der Wahrheit ist dieses Skript, die JSON nicht von Hand aendern.
// Gemeinsam: Detail-Stufe, 1x1 Kachel, Anker [8,0,8], Rohr zeigt nach -z (zur Aussenwand), Rueckseite z = 15.
// Parameter: state 0 verschlossen (Plane, Gitter) / 1 frei, leer / 2 aktiv bestueckt; side 0 Bb / 1 Stb (spiegelt Anbauten und Marke).
// Farbcode: Waffen-Rot (primary) und Messing (trim) auf dunklem Metall; keine Glow-Rollen (Mint/Bernstein sind Funktionsfarben).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(root, 'assets', 'models', 'lerche', 'station');
const check = process.argv.includes('--check');

const box = (name, at, size, color, x = {}) => ({ op: 'box', name, at, size, color, ...x });
const cyl = (name, at, r, h, color, x = {}) => ({ op: 'cyl', name, at, r, h, color, ...x });
const cylz = (name, at, r, h, color, x = {}) => ({ op: 'cyl', name, axis: 'z', at, r, h, color, ...x });
const line = (name, from, to, r, color, x = {}) => ({ op: 'line', name, from, to, r, color, ...x });
const fr = (f, fill, axes, width = 1) => ({ frame: f, fill, axes, width });
const KAPPE = { shade: 'trim', f: 1.2 };

// ---------------------------------------------------------------------------------------------
// Gemeinsame Teile
// ---------------------------------------------------------------------------------------------
const basis = (rr) => [
  box('Bodenplatte', [0, 0, 0], [16, 2, 16], fr('trim', 'metal_dark', 'xz')),
  box('Rand vorn', [1, 1, 13], [14, 1, 2], { stripes: ['primary', 'trim'], axis: 'x', period: 2 }, { mode: 'paint', jitter: false }),
  cyl('Lagerring', [8, 2, 7], `${rr} + 0.5`, 2, 'metal'),
  cyl('Zahnkranz', [8, 4, 7], rr, 1, { checker: ['metal_light', 'dark'], period: 1 }, { hollow: 1, jitter: false }),
  cyl('Kranzscheibe', [8, 4, 7], `${rr} - 1`, 1, 'metal_dark'),
  box('Seitenmarke Bb', [1, 2, 13], [1, 2, 1], 'trim', { if: 'side == 0' }),
  box('Seitenmarke Stb', [14, 2, 13], [1, 2, 1], 'trim', { if: 'side == 1' }),
];
const zu = (rr) => ({
  op: 'group', name: 'Verschlossen: Plane und Gitter', if: 'state == 0', ops: [
    { op: 'ellipsoid', name: 'Plane', at: [8, 4, 7], r: [rr, 6, `${rr} - 1`], half: '+y', color: { noise: ['leather', { shade: 'leather', f: 0.8 }], weights: [3, 1], cell: 1 } },
    box('Gurt laengs', [7, 4, 0], [2, 11, 16], 'trim', { mode: 'paint' }),
    box('Gurt quer', [0, 4, 6], [16, 11, 2], { shade: 'trim', f: 0.8 }, { mode: 'paint' }),
    box('Siegel', [7, 9, 7], [2, 2, 2], 'primary'),
    box('Gitterstab', [1, 2, 13], [1, 9, 1], 'metal_light', { repeat: { count: 5, step: [3, 0, 0], var: 'g' } }),
    box('Gitterholm', [1, 9, 13], [14, 1, 1], 'metal_light'),
    box('Gitterholm unten', [1, 3, 13], [14, 1, 1], 'metal_light'),
    box('Zeichentafel', [6, 5, 14], [4, 3, 1], fr('trim', 'dark', 'xy')),
    box('Zeichen', [7, 6, 15], [2, 1, 1], 'primary'),
  ],
});
const frei = () => ({
  op: 'group', name: 'Frei: leerer Sockel', if: 'state == 1', ops: [
    cyl('Zapfen', [8, 5, 7], 2, 3, 'metal'),
    cyl('Zapfenkappe', [8, 8, 7], 2.5, 1, 'trim'),
    box('Zeiger frei', [7, 5, 1], [2, 1, 4], 'trim', { jitter: false }),
    box('Gleitschienen', [2, 2, 2], [1, 1, 10], 'metal_light', { mirror: 'x', mirrorAt: 8 }),
  ],
});

// ---------------------------------------------------------------------------------------------
// Waffen (state 2)
// ---------------------------------------------------------------------------------------------
const W = {};
W.batterie = {
  titel: 'Batterie (Seite, Standard): breites Gehäuse, zwei kurze dicke Rohre, ruhig',
  art: 'Seite', rr: 6, extra: {}, ops: [
    cyl('Drehteller', [8, 5, 7], 5.5, 2, 'metal'),
    box('Gehaeuse', [2, 7, 3], [12, 5, 10], fr('trim', 'metal_dark', 'xz')),
    box('Haube', [3, 12, 4], [10, 2, 8], 'primary'),
    box('Haubengrat', [7, 14, 4], [2, 1, 8], KAPPE, { jitter: false }),
    cylz('Rohr links', [5.5, 10, 0], 2.4, 4, 'metal_dark'),
    cylz('Rohr rechts', [10.5, 10, 0], 2.4, 4, 'metal_dark'),
    cylz('Muendungsring links', [5.5, 10, 0], 3, 1, KAPPE, { jitter: false }),
    cylz('Muendungsring rechts', [10.5, 10, 0], 3, 1, KAPPE, { jitter: false }),
    box('Seitenblende', [1, 8, 5], [1, 3, 6], 'metal_light', { mirror: 'x', mirrorAt: 8 }),
  ],
};
W.sturm = {
  titel: 'Sturmbatterie (Seite): schmaler Block, Gatling-Bündel aus sechs dünnen Rohren, Kühlrippen, Munitionskasten mit Gurt',
  art: 'Seite', rr: 5, extra: {}, ops: [
    cyl('Drehteller', [8, 5, 7], 4, 2, 'metal'),
    box('Gehaeuse', [5, 7, 6], [6, 6, 8], fr('trim', 'metal_dark', 'xz')),
    box('Kuehlrippen', [4, 8, 7], [1, 5, 1], 'metal_light', { repeat: { count: 4, step: [0, 0, 2], var: 'k' }, mirror: 'x', mirrorAt: 8 }),
    box('Haube', [6, 13, 7], [4, 1, 6], 'primary'),
    cylz('Kernstab', [8, 10, 2], 0.9, 6, 'metal'),
    line('Rohr', [`8 + 2.4 * cos(i * 1.0472)`, `10 + 2.4 * sin(i * 1.0472)`, 8], [`8 + 2.4 * cos(i * 1.0472)`, `10 + 2.4 * sin(i * 1.0472)`, 0], 0.75, 'metal_light', { repeat: { count: 6, var: 'i' } }),
    cylz('Scheibe vorn', [8, 10, 0], 3.6, 1, KAPPE, { jitter: false, hollow: 1 }),
    cylz('Scheibe mitte', [8, 10, 4], 3.4, 1, 'primary', { hollow: 1 }),
    box('Munitionskasten', ['cx == 1 ? 11 : 1', 7, 8], [4, 4, 5], fr('trim', 'primary', 'xy')),
    line('Gurt', ['cx == 1 ? 11 : 5', 10, 10], ['cx == 1 ? 10 : 6', 12, 10], 0.8, KAPPE),
    box('Gurtglieder', ['cx == 1 ? 10 : 5', 11, 9], [1, 1, 3], KAPPE, { jitter: false }),
  ],
};
W.streu = {
  titel: 'Streubatterie (Seite): dicker Mörser mit weitem Trichter, Granatentrommel obenauf',
  art: 'Seite', rr: 5.5, extra: {}, ops: [
    cyl('Drehteller', [8, 5, 7], 5, 2, 'metal'),
    box('Sockel', [4, 7, 4], [8, 3, 9], fr('trim', 'metal_dark', 'xz')),
    cylz('Moersers', [8, 11, 1], 3.8, 9, 'metal_dark'),
    cylz('Trichter', [8, 11, 0], 5, 2, KAPPE, { jitter: false, hollow: 1 }),
    cylz('Bohrung', [8, 11, 0], 2.6, 4, 'dark', { mode: 'carve' }),
    cylz('Rohrband', [8, 11, 6], 4, 1, 'primary', { mode: 'paint' }),
    cylz('Rohrband 2', [8, 11, 3], 4, 1, 'trim', { mode: 'paint' }),
    cyl('Trommel', ['cx == 1 ? 9 : 4', 15, 9], 3.4, 3, 'metal', { axis: 'x' }),
    cyl('Trommelband', ['cx == 1 ? 9 : 4', 15, 9], 3.6, 1, 'primary', { axis: 'x' }),
    box('Trommelauflage', ['cx == 1 ? 8 : 4', 11, 8], [4, 2, 4], 'metal_dark'),
    box('Granate', ['cx == 1 ? 12 : 3', 14, 8], [1, 2, 2], 'trim'),
  ],
};
W.lanzen = {
  titel: 'Lanzenbatterie (Seite): zwei lange schlanke Rohre mit Fokusspulen, flaches Gehäuse',
  art: 'Seite', rr: 5, extra: {}, ops: [
    cyl('Drehteller', [8, 5, 7], 4.5, 2, 'metal'),
    box('Gehaeuse', [3, 7, 7], [10, 4, 8], fr('trim', 'metal_dark', 'xz')),
    box('Haube', [4, 11, 8], [8, 1, 6], 'primary'),
    cylz('Lauf links', [4.5, 10, 0], 1.2, 12, 'metal_light'),
    cylz('Lauf rechts', [11.5, 10, 0], 1.2, 12, 'metal_light'),
    cylz('Spule links', [4.5, 10, 2], 2.4, 1, KAPPE, { jitter: false, repeat: { count: 4, step: [0, 0, 2.6], var: 's' } }),
    cylz('Spule rechts', [11.5, 10, 2], 2.4, 1, KAPPE, { jitter: false, repeat: { count: 4, step: [0, 0, 2.6], var: 's' } }),
    cylz('Spitze links', [4.5, 10, 0], 1.7, 1, 'primary'),
    cylz('Spitze rechts', [11.5, 10, 0], 1.7, 1, 'primary'),
    box('Bruecke', [5, 9, 11], [6, 2, 2], 'primary'),
  ],
};
W.kanone = {
  titel: 'Kanone (Bug, Standard): hoher Drehsockel, Turmkuppel mit Schildplatte, einzelnes längeres Rohr mit Mündungsbremse',
  art: 'Bug', rr: 6, extra: {}, ops: [
    cyl('Drehsockel', [8, 5, 7], 4.5, 5, 'metal_dark'),
    cyl('Sockelring', [8, 10, 7], 5.2, 1, KAPPE, { jitter: false }),
    { op: 'ellipsoid', name: 'Kuppel', at: [8, 12, 8], r: [5, 3.5, 5], half: '+y', color: 'metal' },
    box('Schildplatte', [4, 11, 2], [8, 5, 2], fr('trim', 'primary', 'xy')),
    cylz('Rohr', [8, 13, 0], 1.8, 10, 'metal_dark'),
    cylz('Kuehlmanschette', [8, 13, 4], 2.5, 3, KAPPE, { jitter: false }),
    box('Muendungsbremse', [6, 11, 0], [4, 4, 2], KAPPE, { jitter: false }),
    box('Ladeklappe', [6, 14, 9], [4, 1, 3], 'primary'),
  ],
};
W.lanze_bug = {
  titel: 'Lanze (Bug, Platz 8): ein dicker Lauf mit Fokusringen und Spitze, Kondensatorbank hinten',
  art: 'Bug', rr: 6, extra: {}, ops: [
    cyl('Drehteller', [8, 5, 7], 5.5, 2, 'metal'),
    box('Kondensatorbank', [3, 7, 9], [10, 6, 6], fr('trim', 'primary', 'xz')),
    box('Kondensator Streifen', [4, 13, 10], [8, 1, 4], KAPPE, { jitter: false }),
    cylz('Lauf', [8, 10, 2], 3, 11, 'metal_dark'),
    cylz('Windung', [8, 10, 2], 3.2, 11, { stripes: ['trim', 'metal_dark'], axis: 'z', period: 2 }, { mode: 'paint', jitter: false }),
    cylz('Fokusring', [8, 10, 3], 4.4, 1, KAPPE, { jitter: false, repeat: { count: 4, step: [0, 0, 2.5], var: 'f' } }),
    cylz('Spitze', [8, 10, 0], 0.9, 2, 'primary', { r2: 3 }),
    cylz('Spitzenkappe', [8, 10, 0], 1, 1, 'primary'),
  ],
};
W.torpedo = {
  titel: 'Torpedowerfer (Heck): dickes Rohr mit offener Verschlussklappe, Torpedo sichtbar, Munitionsregal',
  art: 'Heck', rr: 6, extra: {}, ops: [
    box('Bock', [2, 5, 3], [3, 6, 10], 'metal_dark', { mirror: 'x', mirrorAt: 8 }),
    cylz('Rohr', [8, 11, 0], 4.8, 13, 'metal', { hollow: 1.2 }),
    cylz('Rohrband', [8, 11, 4], 5.1, 1, KAPPE, { jitter: false, repeat: { count: 3, step: [0, 0, 4], var: 'b' } }),
    cylz('Torpedokoerper', [8, 11, 2], 3, 9, 'metal_light'),
    cylz('Torpedoband', [8, 11, 7], 3.2, 1, 'primary'),
    cylz('Sprengkopf', [8, 11, 0], 0.6, 2, 'primary', { r2: 3 }),
    cylz('Heckverschluss', [8, 11, 13], 5.2, 2, KAPPE, { jitter: false }),
    box('Klappe offen', [3, 15, 0], [10, 4, 1], fr('trim', 'primary', 'xy')),
    box('Klappenscharnier', [4, 15, 1], [8, 1, 1], 'metal_dark'),
    box('Regal', ['cx == 1 ? 12 : 1', 5, 5], [3, 10, 9], fr('trim', 'metal_dark', 'yz')),
    cylz('Reservetorpedo unten', ['cx == 1 ? 13.5 : 2.5', 8, 6], 1.2, 7, 'metal_light'),
    cylz('Reservetorpedo oben', ['cx == 1 ? 13.5 : 2.5', 11.5, 6], 1.2, 7, 'metal_light'),
    cylz('Reservekopf unten', ['cx == 1 ? 13.5 : 2.5', 8, 5], 0.4, 1, 'primary', { r2: 1.2 }),
    cylz('Reservekopf oben', ['cx == 1 ? 13.5 : 2.5', 11.5, 5], 0.4, 1, 'primary', { r2: 1.2 }),
  ],
};
// Abwehrturm: drehbar ueber winkel (Grad, 0 = Rohr nach -z). Gehaeuse rund, damit die Drehung stimmt.
const aw = 'winkel * 0.0174533';
W.abwehr = {
  titel: 'Abwehrturm (Heck): kleine runde Kuppel mit Doppelläufen (Flak), drehbar über winkel',
  art: 'Heck', rr: 5, extra: { winkel: { default: 0, min: 0, max: 345, step: 15, label: 'Drehwinkel in Grad (0 = Rohr nach -z); das Spiel dreht den Turm selbst' } },
  variants: { winkel90: { state: 2, winkel: 90 }, winkel180: { state: 2, winkel: 180 }, winkel270: { state: 2, winkel: 270 } },
  ops: [
    cyl('Sockel', [8, 5, 7], 3.2, 3, 'metal'),
    cyl('Drehkranz', [8, 8, 7], 4.8, 1, KAPPE, { jitter: false }),
    { op: 'ellipsoid', name: 'Kuppel', at: [8, 9, 7], r: [4.4, 3.4, 4.4], half: '+y', color: 'primary' },
    cyl('Kuppelband', [8, 9, 7], 4.5, 1, 'metal_dark', { mode: 'paint' }),
    line('Lauf links', [`8 + sin(${aw}) * 3 + cos(${aw}) * -1.7`, 11.5, `7 - cos(${aw}) * 3 + sin(${aw}) * -1.7`], [`8 + sin(${aw}) * 5.5 + cos(${aw}) * -1.7`, 11.5, `7 - cos(${aw}) * 5.5 + sin(${aw}) * -1.7`], 0.9, 'metal_dark'),
    line('Lauf rechts', [`8 + sin(${aw}) * 3 + cos(${aw}) * 1.7`, 11.5, `7 - cos(${aw}) * 3 + sin(${aw}) * 1.7`], [`8 + sin(${aw}) * 5.5 + cos(${aw}) * 1.7`, 11.5, `7 - cos(${aw}) * 5.5 + sin(${aw}) * 1.7`], 0.9, 'metal_dark'),
    line('Muendung links', [`8 + sin(${aw}) * 5 + cos(${aw}) * -1.7`, 11.5, `7 - cos(${aw}) * 5 + sin(${aw}) * -1.7`], [`8 + sin(${aw}) * 6 + cos(${aw}) * -1.7`, 11.5, `7 - cos(${aw}) * 6 + sin(${aw}) * -1.7`], 1.5, KAPPE),
    line('Muendung rechts', [`8 + sin(${aw}) * 5 + cos(${aw}) * 1.7`, 11.5, `7 - cos(${aw}) * 5 + sin(${aw}) * 1.7`], [`8 + sin(${aw}) * 6 + cos(${aw}) * 1.7`, 11.5, `7 - cos(${aw}) * 6 + sin(${aw}) * 1.7`], 1.5, KAPPE),
    cyl('Magazintrommel', [`8 - sin(${aw}) * 3.8`, 9, `7 + cos(${aw}) * 3.8`], 2, 3, KAPPE, { jitter: false }),
    line('Visier', [8, 12, 7], [`8 + sin(${aw}) * 3`, 13, `7 - cos(${aw}) * 3`], 0.6, 'metal_light'),
  ],
};

const out = {};
for (const [k, w] of Object.entries(W)) {
  const id = `lerche/station/lafette_${k}`;
  const recipe = {
    id,
    name: `Lafette ${w.titel}; state 0 verschlossen, 1 frei, 2 aktiv; Rohr nach -z`,
    tier: 'detail', palette: 'lerche_rom',
    tags: ['lerche', 'station', 'waffe', 'lafette', 'paket-c', w.art.toLowerCase()],
    footprint: [1, 1], jitter: 0,
    params: {
      state: { default: 2, min: 0, max: 2, step: 1, label: '0 verschlossen (Plane, Gitter) · 1 frei/leer · 2 aktiv bestückt' },
      side: { default: 0, min: 0, max: 1, step: 1, label: 'Seite 0 Bb / 1 Stb (spiegelt Anbauten und Marke)' },
      ...w.extra,
    },
    let: { cx: 'side == 1 ? 1 : -1' },
    variants: { verschlossen: { state: 0 }, frei: { state: 1 }, aktiv: { state: 2 }, stb: { state: 2, side: 1 }, ...(w.variants || {}) },
    ops: [...basis(w.rr), zu(w.rr), frei(), { op: 'group', name: 'Aktiv', if: 'state == 2', ops: w.ops }],
    anchor: [8, 0, 8],
  };
  out[path.join(DIR, `lafette_${k}.json`)] = JSON.stringify(recipe, null, 1) + '\n';
}
let bad = 0;
for (const [f, text] of Object.entries(out)) {
  if (check) { if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== text) { console.log('✗ weicht ab: ' + path.basename(f)); bad++; } }
  else fs.writeFileSync(f, text);
}
console.log(check ? (bad ? `✗ ${bad} Abweichungen` : '✓ lafette_* unveraendert') : `✓ ${Object.keys(out).length} Lafetten geschrieben`);
if (bad) process.exit(1);
