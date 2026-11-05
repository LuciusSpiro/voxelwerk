// Prüfbogen der Biom-Paletten (VOX-02): je Biom eine Szene `biom-bogen-<biom>` mit allen Geländerollen nebeneinander
// (Boden, Teppich, Sand, Erde, Stein halb, Fels hoch, Wasser/Lava, Abgrund). Reine Sichtprobe, kein Teil der Prüfung.
// Aufruf: node tools/gen-biom-bogen.mjs   dann   node tools/shots.cjs --port 34xx scene=biom-bogen-biom_wueste
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIOME } from './biom-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPALTEN = [   // Zeichen, Höhe, Oberseite, Füllung
  ['g', 1, 'grass', 'soil_dark'], ['t', 1, 'teppich', 'soil_dark'], ['G', 1, 'grass_dark', 'soil_dark'], ['s', 1, 'sand', 'soil_dark'], ['o', 1, 'soil', 'soil_dark'],
  ['k', 2, 'stone', 'stone_dark'], ['r', 4, 'rock', 'rock_dark'], ['f', 1, 'soil_dark', 'soil_dark'], ['a', 1, 'abgrund', 'rock_dark'],
];
const BREITE = 2, TIEFE = 7;
for (const id of BIOME) {
  const legend = {}; for (const [c, h, top, fill] of SPALTEN) legend[c] = { h, top, fill };
  const rows = [], heights = [];
  for (let z = 0; z < TIEFE; z++) {
    // Mittelstreifen (z 3): helle Kappe wäre hier sichtbar; Reihe 3 zeigt stone_light/dark als Kästchen nebeneinander
    rows.push(SPALTEN.map(([c]) => c.repeat(BREITE)).join(''));
    heights.push(SPALTEN.map(([, h]) => String(h).repeat(BREITE)).join(''));
  }
  const W = SPALTEN.length * BREITE;
  const scene = { id: `biom-bogen-${id}`, name: `Prüfbogen ${id} (VOX-02)`, palette: id, mood: id,
    terrain: { palette: id, depth: 2, jitter: 0.03, legend, rows, heights },
    place: [{ model: 'biom/bogen_fluid', at: [(SPALTEN.findIndex((x) => x[0] === 'f') * BREITE) + BREITE / 2, TIEFE / 2], y: 0.78, palette: id }], cameras: { bogen: { target: [W / 2, 0.5, TIEFE / 2], dist: 40, elev: 52, az: 0, fov: 30 } } };
  fs.writeFileSync(path.join(root, 'assets', 'scenes', scene.id + '.json'), JSON.stringify(scene));
  console.log('geschrieben', scene.id);
}
