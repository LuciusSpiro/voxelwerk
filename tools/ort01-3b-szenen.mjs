// Szenen ORT-01 Paket 3b: je Raumtyp der Germanen-Station ein Raum-Ausschnitt (10x8 m, Licht hall_metall,
// Kameras uebersicht / spielnah / detail). Aufruf: node tools/ort01-3b-szenen.mjs
// Platzierungen, deren Modell (noch) nicht existiert, werden ausgelassen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.join(here, '..', 'assets', 'models') + path.sep;
const OUT = path.join(here, '..', 'assets', 'scenes') + path.sep;
const GS = 'ort/germanen/station/', GG = 'ort/germanen/gemein/', PS = 'prop/germanen/station/', PG = 'prop/germanen/gemein/';
const W = 10, D = 8;
const P = (model, x, z, rot = 0, params, extra = {}) => ({ model, at: [x, z], ...(rot ? { rot } : {}), ...(params ? { params } : {}), ...extra });
// Rückwand z=0.9 (rot 0), linke Wand x=1.0 (rot 90, Front nach +x)
const walls = [P(GS + 'wand', 5, 0.25, 0, { len: 40 }), P(GS + 'wand', 0.25, 4, 90, { len: 32 })];
const rooms = {
  kommando: { name: 'Kommando', hero: [4.6, 1.0, 4.0], items: [
    P(GS + 'kartentisch', 5, 4.1),
    P(GS + 'terminal', 2.6, 0.95), P(PS + 'wandmonitor', 5.2, 0.4), P(GG + 'verteiler', 8.6, 0.95),
    P(GG + 'schildantenne', 7.2, 0.95), P('prop/germanen/aussenposten/runenmast', 1.3, 6.6),
    P(GG + 'runenholz', 8.5, 6.2), P(PG + 'laterne', 9.2, 3.0),
  ] },
  reaktor: { name: 'Reaktor', hero: [6.6, 0.8, 4.4], items: [
    P(GS + 'reaktor', 5, 3.2), P(GS + 'terminal', 1.1, 3.5, 90), P(GG + 'verteiler', 2.6, 0.95),
    P(GS + 'blasebalg', 7.6, 5.0), P(GG + 'fasszelle', 8.4, 6.4, 0, { charge: 2 }), P(GG + 'fasszelle', 7.6, 6.7, 0, { charge: 4 }),
    P(GG + 'glutleitung', 8.0, 0.95),
  ] },
  lager: { name: 'Lager', hero: [4.0, 0.8, 3.0], items: [
    P(GG + 'fassregal', 2.3, 0.95), P(PS + 'regal', 4.4, 0.8), P(GS + 'ladebock', 7.6, 0.95),
    P(GG + 'fasszelle', 6.6, 0.95, 0, {}, { lift: 0.59 }), P(GG + 'fasszelle', 7.6, 0.95, 0, { charge: 2 }, { lift: 0.59 }),
    P(GS + 'kran', 1.1, 4.4, 90), P(PG + 'kiste_stapel', 5.2, 5.0, 15), P(GG + 'fasszelle', 7.4, 5.8, 0, { charge: 4 }),
    P(PG + 'kiste_stapel', 6.2, 5.8, -20),
  ] },
  quartier: { name: 'Quartier', hero: [3.0, 0.8, 1.8], items: [
    P(GS + 'koje', 2.4, 0.95), P(GS + 'spind', 4.9, 0.95), P(GS + 'glutofen', 6.1, 0.95),
    P(PS + 'wandmonitor', 8.2, 0.4), P(GS + 'spind', 1.1, 4.8, 90), P(PG + 'laterne', 9.0, 4.0),
    P(GG + 'runenholz', 6.0, 5.2), P(GS + 'koje', 1.1, 6.6, 90),
  ] },
  messe: { name: 'Messe', hero: [5.0, 0.7, 4.0], items: [
    P(GS + 'langtisch', 5, 4.0), P(GS + 'bank', 4.0, 5.3, 180), P(GS + 'bank', 6.0, 5.3, 180), P(GS + 'bank', 4.0, 2.7), P(GS + 'bank', 6.0, 2.7),
    P(PS + 'met_kessel', 8.6, 1.0), P(GS + 'kuehlfass', 1.6, 1.0), P(PG + 'laterne', 9.2, 5.6),
    P(GG + 'rationsbehaelter', 4.2, 4.0, 0, {}, { lift: 0.9 }), P(GG + 'rationsbehaelter', 5.8, 4.0, 20, {}, { lift: 0.9 }),
  ] },
  werkstatt: { name: 'Werkstatt', hero: [3.0, 0.8, 2.8], items: [
    P(GS + 'amboss', 3.2, 3.4), P(GS + 'kran', 7.4, 1.0), P(GS + 'ladegeraet', 1.4, 1.0), P(PS + 'regal', 5.4, 0.8),
    P(GS + 'schweisser', 8.8, 3.6, 90), P(GG + 'werkzeugkasten', 6.2, 5.4, 25), P(GS + 'ladegeraet', 1.0, 5.8, 90),
  ] },
  krankenstation: { name: 'Krankenstation', hero: [3.2, 0.8, 3.2], items: [
    P(GS + 'medliege', 3.4, 3.6), P(GS + 'medliege', 7.4, 3.6), P(GS + 'scanstele', 1.5, 1.0),
    P(GS + 'medfass', 5.5, 3.0), P(GS + 'spind', 5.6, 0.95, 0, { med: 1 }), P(PG + 'laterne', 9.2, 1.4),
    P(GG + 'medkiste', 7.6, 6.2, 15), P(GS + 'spind', 8.6, 0.95, 0, { med: 1 }),
  ] },
  zellen: { name: 'Zellen', hero: [3.0, 0.8, 3.0], items: [
    P(GS + 'feldzelle', 3.0, 1.6), P(GS + 'feldzelle', 5.0, 1.6), P(GS + 'feldzelle', 7.0, 1.6),
    P(GS + 'pritsche', 3.0, 1.2), P(GS + 'pritsche', 7.0, 1.2),
    P(GS + 'terminal', 4.0, 5.2, 0, { state: 2 }), P(GS + 'runenschloss', 5.9, 3.3),
    P(PG + 'bake_abholpunkt', 8.9, 5.8),
  ] },
};
const floor = ['#6A6864', '#5A5854'];
const exists = (m) => fs.existsSync(MOD + m + '.json');
for (const [id, r] of Object.entries(rooms)) {
  const leg = { a: { h: 1, top: floor[0], fill: '#2A2A2E' }, b: { h: 1, top: floor[1], fill: '#2A2A2E' } };
  const rows = [...Array(D)].map((_, z) => [...Array(W)].map((_, x) => ((x + z) % 2 === 0 ? 'a' : 'b')).join(''));
  const place = [...walls, ...r.items].filter((p) => exists(p.model));
  const missing = [...walls, ...r.items].filter((p) => !exists(p.model)).map((p) => p.model);
  const [hx, hy, hz] = r.hero;
  const cams = {
    uebersicht: { target: [W / 2, 0.8, D / 2], dist: W * 1.25, elev: 48, az: 28, fov: 36 },
    spielnah: { target: [W / 2, 0.5, D / 2 + 0.5], dist: W * 1.15, elev: 72, az: 0, fov: 36 },
    detail: { target: [hx, hy, hz], dist: 5.5, elev: 32, az: 30, fov: 36 },
  };
  const sc = { id: 'ort-ger-st-' + id, name: 'ORT-01 Germanen Station: ' + r.name, palette: 'nord', mood: 'hall_metall',
    terrain: { palette: 'planet_mediterran', depth: 2, jitter: 0, legend: leg, rows, heights: Array(D).fill('1'.repeat(W)) },
    place, cameras: cams };
  fs.writeFileSync(OUT + sc.id + '.json', JSON.stringify(sc, null, 1));
  console.log(sc.id, place.length + '/' + (walls.length + r.items.length), missing.length ? 'fehlt: ' + missing.join(', ') : '');
}
