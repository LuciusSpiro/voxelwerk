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

// Wall: Plateau x 12..19, z 3..4 (0,5 m), Kante z 5 mit Rampe bei x 16
place.push({ model: 'test/vox01-sockel', at: [12, 3], params: { w: 8, d: 2 } });
for (let z = 3; z <= 4; z++) for (let x = 12; x <= 19; x++) {
  const par = (x % 2) + 2 * (z % 2);
  place.push({ model: 'kit/rom_feld/boden', at: [x + 0.5, z + 0.5], lift: 0.53, params: { conn: 0, belag: z === 3 ? 1 : 3, par, art: ART, seed: 31 + x * 5 + z } });
}
const kante = [[12, 2], [13, 10], [14, 10], [15, 8], [17, 2], [18, 10], [19, 8]];
for (const [x, c] of kante) place.push({ model: 'kit/rom_feld/kante', at: [x + 0.5, 5.5], params: { conn: c, art: ART, seed: 3 + x } });
place.push({ model: 'kit/rom_feld/rampe', at: [16.5, 5.5] });
// Wachposten auf dem Plateau (2 x 2, Mitte bei 14,4), Figur oben
place.push({ model: 'leit/rom/feld/wachposten', at: [14, 4], lift: 0.5, params: { h: 1 } });
figures.push({ figure: 'rom/legionaer', at: [14, 4], lift: 1.5, rot: 0, pose: 'aim' });

// Bunkereingang (4 x 3 Kacheln, Mitte bei 4,3,5)
place.push({ model: 'leit/rom/feld/bunkereingang', at: [5, 4.5] });

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
  name: 'VOX-01 Paket 3: Römische Feldbefestigung (Brustwehr, Grabensohle, Wall mit Kante und Rampe, Wachposten, Bunkereingang)',
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
    bunker: { target: [5, 1.5, 5], dist: 11, elev: 40, az: 15, fov: 30 },
  },
};
fs.writeFileSync(new URL('../assets/scenes/vox01-feld.json', import.meta.url), JSON.stringify(scene, null, 1) + '\n');
console.log('Szene geschrieben:', place.length, 'Platzierungen');
