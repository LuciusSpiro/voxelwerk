// ORT-01 K2 (Gruppe 2b): erzeugt tor_rahmen, tor_blatt, boden_belag, boden_fuge, gitter_pfosten, gitter_feld
// unter assets/models/kit/germanen/aussenposten/. node tools/gen-kit-k2.mjs
import fs from 'node:fs';
const dir = new URL('../assets/models/kit/germanen/aussenposten/', import.meta.url);
const P = (def, min, max, label) => ({ default: def, min, max, step: 1, label });
const base = (id, name, notes, params, extra) => Object.assign({
  id: 'kit/germanen/aussenposten/' + id, name, tier: 'architecture', palette: 'nord',
  tags: ['germanen', 'aussenposten', 'slot', 'stabbau', 'ort01'], notes, jitter: 0, params, anchor: [0, 0, 0],
}, extra);
const zust = P(0, 0, 2, '0 intakt · 1 verfallen · 2 umkämpft');
const EMB = () => '#FF8A1A';
const ART = { default: 'aussenposten', options: ['aussenposten', 'station', 'ruine', 'schiff'], label: 'Kartenart' };
const W = (f, j) => fs.writeFileSync(new URL(f + '.json', dir), JSON.stringify(j, null, 2) + '\n');
const soot = (b) => ({ noise: [{ shade: b, f: 0.85 }, { shade: b, f: 1.0 }, 'dark'], weights: [4, 3, 1], seed: 'seed' });

W('tor_rahmen', base('tor_rahmen',
  'Außenposten Stabbau – tor_rahmen: Eisenschwelle mit Glutlinie (teil 0), Sturz aus Eisen mit Kupferbalken und Runenzeichen (teil 1); 2 bis 4 Kacheln breit',
  'ORT-01 K2 (Gruppe 2b). Wie tuer_rahmen, breiter. Glut erloschen bei gesprengt (state 2) oder umkämpft.',
  { w: P(8, 1, 16, 'Breite (Voxel)'), h: P(3, 1, 16, 'Höhe (Voxel)'), d: P(4, 1, 4, 'Tiefe (Voxel)'), zustand: zust, teil: P(1, 0, 1, '0 Schwelle · 1 Sturz'), state: P(0, 0, 3, 'Torzustand') },
  {
    let: { dk: '1 - zustand * 0.06', em: '(state == 2 || zustand == 2) ? 0 : 0.6' },
    variants: { schwelle: { teil: 0, h: 1 }, gesprengt: { state: 2 }, breit: { w: 16 } },
    ops: [
      { name: 'Schwelle', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal_dark', f: 'dk' }, if: 'teil == 0' },
      { name: 'Schwelle Glutlinie', op: 'box', at: [1, 'h - 1', 'd - 2'], size: ['w - 2', 1, 1], mode: 'paint', color: EMB(), emit: 'em', if: 'teil == 0 && w >= 4 && em > 0' },
      { name: 'Sturz', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal', f: '0.9 * dk' }, if: 'teil == 1' },
      { name: 'Sturzbalken Kupfer', op: 'box', at: [0, 0, 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'copper', f: 'dk' }, if: 'teil == 1' },
      { name: 'Krone dunkel', op: 'box', at: [0, 'h - 1', 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'metal_dark', f: 'dk' }, if: 'teil == 1 && h >= 3' },
      { name: 'Runenzeichen links', op: 'box', at: [1, 1, 'd - 1'], size: [2, 1, 1], mode: 'paint', color: { role: 'rune' }, emit: 'em', if: 'teil == 1 && h >= 3 && w >= 6 && em > 0' },
      { name: 'Runenzeichen rechts', op: 'box', at: ['w - 3', 1, 'd - 1'], size: [2, 1, 1], mode: 'paint', color: { role: 'rune' }, emit: 'em', if: 'teil == 1 && h >= 3 && w >= 6 && em > 0' },
      { name: 'Runenzeichen Mitte', op: 'box', at: ['floor(w / 2) - 1', 1, 'd - 1'], size: [2, 1, 1], mode: 'paint', color: { role: 'rune' }, emit: 'em', if: 'teil == 1 && h >= 3 && w >= 12 && em > 0' },
      { name: 'Ruß (gesprengt/umkämpft)', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], mode: 'paint', color: soot('metal_dark'), if: 'teil == 1 && (state == 2 || zustand == 2)' },
    ],
  }));

W('tor_blatt', base('tor_blatt',
  'Außenposten Stabbau – tor_blatt: Torflügel aus Eisenplanken, Kupfer-Streben und -bänder, Glutfuge zwischen den Flügeln',
  'ORT-01 K2 (Gruppe 2b). Nur im geschlossenen Zustand (state 0).',
  { w: P(8, 1, 16, 'Breite (Voxel)'), h: P(9, 1, 16, 'Höhe (Voxel)'), d: P(2, 1, 4, 'Tiefe (Voxel)'), zustand: zust, state: P(0, 0, 3, 'Torzustand') },
  {
    let: { dk: '1 - zustand * 0.06', em: 'zustand == 2 ? 0 : 0.6' },
    variants: {},
    ops: [
      { name: 'Planken', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { stripes: [{ shade: 'metal', f: 'dk' }, { shade: 'metal_dark', f: '1.1 * dk' }], axis: 'x', period: 2 } },
      { name: 'Strebe links', op: 'line', from: [1.5, 1.5, 'd - 0.5'], to: ['floor(w / 2) - 2.5', 'h - 2.5', 'd - 0.5'], r: 0.5, mode: 'paint', color: { shade: 'copper_dark', f: 'dk' }, if: 'w >= 8 && h >= 6' },
      { name: 'Strebe rechts', op: 'line', from: ['w - 1.5', 1.5, 'd - 0.5'], to: ['floor(w / 2) + 1.5', 'h - 2.5', 'd - 0.5'], r: 0.5, mode: 'paint', color: { shade: 'copper_dark', f: 'dk' }, if: 'w >= 8 && h >= 6' },
      { name: 'Kupferband', op: 'box', at: [0, '1 + i * floor((h - 2) / 2)', 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'copper_dark', f: 'dk' }, if: 'h >= 4', repeat: { count: 3, step: [0, 0, 0], var: 'i' } },
      { name: 'Glutfuge Mitte', op: 'box', at: ['floor(w / 2) - 1', 0, 'd - 1'], size: [1, 'h', 1], mode: 'paint', color: EMB(), emit: 'em', if: 'w >= 6 && zustand < 2' },
      { name: 'Ruß (umkämpft)', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], mode: 'paint', color: soot('metal'), if: 'zustand == 2' },
    ],
  }));

W('boden_belag', base('boden_belag',
  'Außenposten Stabbau – boden_belag: Eisenplatten (belag 2 Innenraum, Weg und Rampe: mittleres Eisen; belag 0 Plateau und Hof: helles Eisen)',
  'ORT-01 K2 (Gruppe 2b). Fläche einfarbig, das Plattenraster malt boden_fuge (N- und W-Rand).',
  { w: P(4, 1, 16, 'Breite (Voxel)'), h: P(1, 1, 16, 'Höhe (Voxel)'), d: P(4, 1, 4, 'Tiefe (Voxel)'), zustand: zust, belag: P(0, 0, 3, 'Belag'), art: ART },
  {
    let: { dk: '1 - zustand * 0.06' },
    ops: [
      { name: 'Eisenplatte Innenraum und Weg', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal', f: '0.78 * dk' }, if: 'belag == 2' },
      { name: 'Eisenplatte Hof und Plateau', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal_light', f: '0.8 * dk' }, if: 'belag != 2' },
    ],
  }));

W('boden_fuge', base('boden_fuge',
  'Außenposten Stabbau – boden_fuge: Glutfuge im Plattenraster (belag 2), dunkle Plattenfuge sonst',
  'ORT-01 K2 (Gruppe 2b). paint am N- und W-Rand → 1-m-Raster; Glut erloschen bei umkämpft.',
  { w: P(4, 1, 16, 'Breite (Voxel)'), h: P(1, 1, 16, 'Höhe (Voxel)'), d: P(4, 1, 4, 'Tiefe (Voxel)'), zustand: zust, belag: P(0, 0, 3, 'Belag'), art: ART },
  {
    let: { dk: '1 - zustand * 0.06', em: 'zustand < 2 ? 0.45 : 0' },
    ops: [
      { name: 'Platte (für sich allein, im Gerüst nur Anstrich)', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal', f: '0.78 * dk' }, if: 'belag == 2' },
      { name: 'Platte Hof', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal_light', f: '0.8 * dk' }, if: 'belag != 2' },
      { name: 'Glutfuge N', op: 'box', at: [0, 'h - 1', 0], size: ['w', 1, 1], mode: 'paint', color: EMB(), emit: 'em', if: 'belag == 2 && zustand < 2' },
      { name: 'Glutfuge W', op: 'box', at: [0, 'h - 1', 1], size: [1, 1, 'd - 1'], mode: 'paint', color: EMB(), emit: 'em', if: 'belag == 2 && zustand < 2' },
      { name: 'Fuge kalt N', op: 'box', at: [0, 'h - 1', 0], size: ['w', 1, 1], mode: 'paint', color: { shade: 'metal_dark', f: 'dk' }, if: 'belag != 2 || zustand == 2' },
      { name: 'Fuge kalt W', op: 'box', at: [0, 'h - 1', 1], size: [1, 1, 'd - 1'], mode: 'paint', color: { shade: 'metal_dark', f: 'dk' }, if: 'belag != 2 || zustand == 2' },
    ],
  }));

W('gitter_pfosten', base('gitter_pfosten',
  'Außenposten Stabbau – gitter_pfosten: Eisenpfosten mit Granitfuß und Kupferkappe, Glutband unter der Kappe',
  'ORT-01 K2 (Gruppe 2b).',
  { w: P(2, 1, 16, 'Breite (Voxel)'), h: P(10, 1, 16, 'Höhe (Voxel)'), d: P(2, 1, 4, 'Tiefe (Voxel)'), zustand: zust },
  {
    let: { dk: '1 - zustand * 0.06', em: 'zustand < 2 ? 0.6 : 0' },
    ops: [
      { name: 'Pfosten', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { shade: 'metal', f: '0.8 * dk' } },
      { name: 'Fuß', op: 'box', at: [0, 0, 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'stone_dark', f: 'dk' } },
      { name: 'Kupferkappe', op: 'box', at: [0, 'h - 1', 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'copper', f: 'dk' }, if: 'h >= 4' },
      { name: 'Glutband', op: 'box', at: [0, 'h - 3', 0], size: ['w', 1, 'd'], mode: 'paint', color: EMB(), emit: 'em', if: 'h >= 5 && zustand < 2' },
    ],
  }));

W('gitter_feld', base('gitter_feld',
  'Außenposten Stabbau – gitter_feld: Stabgitter aus Eisenstäben mit Kupferriegel und Glut-Feldlinie',
  'ORT-01 K2 (Gruppe 2b). Sicht frei laut Kachelart: dunkle Zwischenräume lesen sich als durchlässig, Voxel bleiben voll wegen der Naht.',
  { w: P(2, 1, 16, 'Breite (Voxel)'), h: P(9, 1, 16, 'Höhe (Voxel)'), d: P(1, 1, 4, 'Tiefe (Voxel)'), zustand: zust },
  {
    let: { dk: '1 - zustand * 0.06', em: 'zustand < 2 ? 0.6 : 0' },
    ops: [
      { name: 'Stäbe', op: 'box', at: [0, 0, 0], size: ['w', 'h', 'd'], color: { stripes: [{ shade: 'metal_light', f: '0.8 * dk' }, 'dark'], axis: 'x', period: 1 } },
      { name: 'Kupferriegel oben', op: 'box', at: [0, 'h - 1', 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'copper_dark', f: 'dk' } },
      { name: 'Fußriegel', op: 'box', at: [0, 0, 0], size: ['w', 1, 'd'], mode: 'paint', color: { shade: 'metal_dark', f: 'dk' } },
      { name: 'Feldlinie', op: 'box', at: [0, 'floor(h / 2)', 'd - 1'], size: ['w', 1, 1], mode: 'paint', color: EMB(), emit: 'em', if: 'h >= 5 && zustand < 2' },
    ],
  }));
console.log('K2-Teile geschrieben');
