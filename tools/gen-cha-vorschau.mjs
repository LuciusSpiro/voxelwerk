// Vorschaubilder je Teil der Spielerfigur (cha/) für die Teile-Kacheln im Spiel (Kleiderkammer, Charaktererstellung).
//
//   node tools/gen-cha-vorschau.mjs            schreibt assets/sprites/cha/vorschau/<platz>/<name>.png (eingecheckt), entfernt überzählige
//   node tools/gen-cha-vorschau.mjs --check    erzeugt im Speicher und vergleicht die Bildpunkte mit den Dateien (Exit 1 bei Abweichung)
//   node tools/gen-cha-vorschau.mjs <teilId>   nur dieses Teil, z. B. kopf/bordhelm (nur im Schreibmodus sinnvoll)
//
// Ein Bild je Katalog-Teil (assets/katalog/charakter.json), auch für die leeren Werte (keine, keiner): Standardfigur mit genau diesem Teil,
// Ausschnitt des Platzes (FENSTER in tools/cha-ansicht.mjs), 140 × 124 px transparent (= doppelte Bildfläche der Kachel, 70 × 62 im Spielraster).
// Das Katalogfeld `vorschau` setzt tools/gen-cha.mjs aus derselben Namensregel (cha/vorschau/<platz>/<name>.png, relativ zu assets/sprites/).
// Die Bilder stehen nicht im manifest.json der Drehsprites (npm run sprites): das beschreibt nur Schiffs-Spritesheets.
// Verglichen werden Bildpunkte, nicht Dateibytes (Bytes hängen von der zlib-Version ab). Nach jeder Änderung an Teilen: gen-cha.mjs, dann dieses Werkzeug.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLibrary, listAssets } from './fs-io.js';
import { encodePng, decodePng } from './cha-render.mjs';
import { vorschauBild, KACHEL } from './cha-ansicht.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets', 'sprites', 'cha', 'vorschau');
const args = process.argv.slice(2), checkOnly = args.includes('--check'), filter = args.find((a) => !a.startsWith('--'));

const lib = nodeLibrary(root), idx = await listAssets(root);
for (const id of idx.models.filter((i) => i.startsWith('cha/'))) await lib.load('models', id);
await lib.load('figures', 'cha/spieler');
const katalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'katalog', 'charakter.json'), 'utf8'));

const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const rel = (f) => path.relative(OUT, f).replace(/\\/g, '/');
let bad = 0, bytes = 0, n = 0;
const soll = new Set();
for (const t of katalog.teile) {
  const file = `${t.id}.png`;
  soll.add(file);
  if (filter && !t.id.includes(filter)) continue;
  const cv = vorschauBild(lib, katalog, t.id), png = encodePng(cv.w, cv.h, cv.d), abs = path.join(OUT, file);
  lib.buildCache?.clear();
  let gleich = false;
  if (fs.existsSync(abs)) {
    try { const alt = decodePng(fs.readFileSync(abs)); gleich = alt.w === cv.w && alt.h === cv.h && Buffer.from(alt.rgba).equals(Buffer.from(cv.d)); } catch { gleich = false; }
  }
  bytes += gleich ? fs.statSync(abs).size : png.length; n++;
  if (gleich) continue;
  if (checkOnly) { bad++; console.log(`  ✗ ${file}: ${fs.existsSync(abs) ? 'veraltet' : 'fehlt'}`); continue; }
  fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, png);
  console.log(`  ✓ ${file}  ${(png.length / 1024).toFixed(1)} KB`);
}
if (!filter) for (const f of walk(OUT)) if (!soll.has(rel(f))) {
  if (checkOnly) { bad++; console.log(`  ✗ ${rel(f)}: überzählig (kein Katalog-Teil)`); continue; }
  fs.unlinkSync(f); console.log(`  - ${rel(f)} entfernt (kein Katalog-Teil)`);
}
console.log(`${bad ? '✗' : '✓'} cha-vorschau: ${n} Bilder à ${KACHEL.w}×${KACHEL.h}, zusammen ${(bytes / 1024).toFixed(1)} KB${checkOnly ? (bad ? `, ${bad} Abweichungen` : ' aktuell') : ''}`);
process.exit(bad ? 1 : 0);
