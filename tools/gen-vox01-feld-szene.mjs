// VOX-01 Paket 3: erzeugt die Abnahme-Szene assets/scenes/vox01-feld.json (Feldbefestigung im Spiel-Maßstab).
// node tools/gen-vox01-feld-szene.mjs
import fs from 'node:fs';
const W = 24, D = 14;
const rows = Array.from({ length: D }, () => Array(W).fill('m'));
const place = [], figures = [];
const ART = 'aussenposten';

// Grabensohle: 2 x 2 Kacheln (x 3..4, z 8..9)
for (let z = 8; z <= 9; z++) for (let x = 3; x <= 4; x++) {
  rows[z][x] = 'g';
  place.push({ model: 'kit/rom_feld/boden', at: [x + 0.5, z + 0.5], lift: 0.03, params: { conn: 0, belag: 0, par: (x % 2) + 2 * (z % 2), art: ART, seed: 11 + x * 7 + z * 3 } });
}

// Wall: Posten-Plateau wie in der Grabenkarte, 3 x 1 Kacheln (x 13..15, z 3), 0,5 m, Kante (0,75 m) rundum, Rampe im Osten (x 16)
place.push({ model: 'test/vox01-sockel', at: [13, 3], params: { w: 3, d: 1 } });
for (let x = 13; x <= 15; x++) place.push({ model: 'kit/rom_feld/boden', at: [x + 0.5, 3.5], lift: 0.53, params: { conn: 0, belag: 1, par: x % 2, art: ART, seed: 31 + x * 5 } });
const kante = [[12, 2, 6], [13, 2, 10], [14, 2, 10], [15, 2, 10], [16, 2, 8], [12, 3, 5], [12, 4, 3], [13, 4, 10], [14, 4, 10], [15, 4, 10], [16, 4, 8]];
for (const [x, z, c] of kante) place.push({ model: 'kit/rom_feld/kante', at: [x + 0.5, z + 0.5], params: { conn: c, art: ART, seed: 3 + x } });
place.push({ model: 'kit/rom_feld/rampe', at: [16.5, 3.5], rot: 90 });
// Wachposten (VOX-01 5c): Aufbau 3 x 1 auf dem Plateau, Anker in der Mitte der Kachel (14,5 | 3,5), y = 0 liegt auf der Plateau-Oberkante (0,5 m, im Spiel lift 0,5)
place.push({ model: 'leit/rom/feld/wachposten', at: [14.5, 3.5], lift: 0.5 });
figures.push({ figure: 'rom/legionaer', at: [14.5, 3.5], lift: 0.5, rot: 0, pose: 'aim' });

// Bunkereingang (VOX-01 5c): Nische wie am Ziel der Grabenkarte, Front nach Westen. Mauerblock x 5..8 (Wandfläche bei x = 5), Seitenwände z 3 und 6,
// offene Tasche x 3..4, z 4..5. Portal: Anker in der Mitte der Wandfläche (5,01 | 5,0), Drehung so, dass +z (Front) nach Westen zeigt.
const wand = new Set();
for (let z = 3; z <= 6; z++) for (let x = 5; x <= 8; x++) wand.add(x + ',' + z);
for (let x = 3; x <= 4; x++) { wand.add(x + ',3'); wand.add(x + ',6'); }
for (const k of wand) {
  const [x, z] = k.split(',').map(Number);
  const c = (wand.has(x + ',' + (z - 1)) ? 1 : 0) | (wand.has((x + 1) + ',' + z) ? 2 : 0) | (wand.has(x + ',' + (z + 1)) ? 4 : 0) | (wand.has((x - 1) + ',' + z) ? 8 : 0);
  place.push({ model: 'kit/rom/wand', at: [x + 0.5, z + 0.5], params: { conn: c, art: ART, seed: x * 3 + z } });
}
place.push({ model: 'leit/rom/feld/bunkereingang', at: [5.01, 5], rot: -90 });
figures.push({ figure: 'rom/legionaer', at: [3.6, 4.5], rot: 90, pose: 'guard' });

// Brustwehr: Reihe z 10 (Ende, 4 Mittelstücke, Ecke nach Süden), 2 Stücke nach Süden, Ende
const bw = [[6, 10, 2], [7, 10, 10], [8, 10, 10], [9, 10, 10], [10, 10, 10], [11, 10, 12], [11, 11, 5], [11, 12, 1],
  // Kreuz und Ecke zum Prüfen der Anschlüsse
  [18, 10, 15], [18, 9, 4], [17, 10, 2], [19, 10, 8], [18, 11, 1], [14, 9, 6], [15, 9, 8], [14, 10, 1]];
for (const [x, z, c] of bw) place.push({ model: 'kit/rom_feld/brustwehr', at: [x + 0.5, z + 0.5], params: { conn: c, art: ART, seed: x * 3 + z } });
// Vergleich: Zaun (kit/rom/zaun) in zwei Kacheln Abstand
for (const [x, c] of [[8, 2], [9, 10], [10, 8]]) place.push({ model: 'kit/rom/zaun', at: [x + 0.5, 7.5], params: { conn: c, art: ART } });

// Figuren: hinter der Brustwehr (Norden der Reihe) und im Graben-Bereich
figures.push({ figure: 'rom/legionaer', at: [8.5, 9.5], rot: 0, pose: 'guard' });
figures.push({ figure: 'rom/legionaer', at: [4, 7.6], rot: 0, pose: 'guard' });

const scene = {
  id: 'vox01-feld',
  name: 'VOX-01 Paket 3/5c: Römische Feldbefestigung (Brustwehr, Grabensohle, Wall mit Kante und Rampe, Wachposten-Aufbau, Bunkereingang als Fassade)',
  palette: 'sommer_wald',
  mood: 'planet_day',
  terrain: {
    palette: 'sommer_wald', depth: 2, jitter: 0,
    legend: {
      m: { h: 1, top: 'grass', fill: 'soil' },
      g: { h: 1, top: 'soil', fill: 'soil_dark' },
    },
    rows: rows.map((r) => r.join('')),
  },
  place,
  scatter: [{ model: ['natur/gras'], on: 'm', density: 0.15, perCell: 2, palette: 'sommer_wald' }],
  figures,
  cameras: {
    spiel: { target: [12, 1, 7.2], dist: 21.0, elev: 57, az: 0, fov: 30 },
    schraeg: { target: [10, 1.2, 7.5], dist: 15, elev: 30, az: 25, fov: 30 },
    brustwehr: { target: [9, 1, 10.5], dist: 9, elev: 40, az: 15, fov: 30 },
    wall: { target: [15.5, 1.2, 4.5], dist: 11, elev: 40, az: 20, fov: 30 },
    bunker: { target: [4.5, 1.2, 5], dist: 9, elev: 40, az: -60, fov: 30 },
    posten: { target: [14.5, 1.2, 3.8], dist: 10, elev: 57, az: 0, fov: 30 },
    postenschraeg: { target: [14.5, 1.5, 3.5], dist: 8, elev: 30, az: 25, fov: 30 },
    bunkerspiel: { target: [5.5, 1, 5], dist: 12, elev: 57, az: 0, fov: 30 },
  },
};
fs.writeFileSync(new URL('../assets/scenes/vox01-feld.json', import.meta.url), JSON.stringify(scene, null, 1) + '\n');
console.log('Szene geschrieben:', place.length, 'Platzierungen');
