// VOX-01 Paket 3: erzeugt die Brustwehr (Gerüst kit/geruest/brustwehr, Hülle kit/rom_feld/brustwehr, Steckplätze
// kit/rom_feld/gemein/brustwehr_* und neutral kit/geruest/slot/brustwehr_*). Stufe detail (6,25 cm), 1 Kachel = 16 Voxel.
// node tools/gen-vox01-feld.mjs   (die JSON-Dateien sind maßgeblich, der Generator hält die Bedingungen von Körper und Oberkante gleich)
//
// Aufbau (conn N1 O2 S4 W8, N = -z, Schauseite +z):
//  - gerade Reihe (nur O/W oder nur N/S, auch Einzelstück): Pfähle im 4-Voxel-Raster über die ganze Kachel, an freien Enden ein Endpfosten
//  - Knoten (Ecke, T, Kreuz): Eckpfosten 4x4 in der Mitte, Arme nur zu den gesetzten Seiten
//  - alle Pfahlreihen sitzen auf demselben Raster (x bzw. z = 4*i), daher schließen Nachbarkacheln ohne Versatz an
import fs from 'node:fs';
const dir = (p) => new URL('../assets/models/' + p, import.meta.url);
const W = (p, j) => { fs.mkdirSync(new URL('.', dir(p + '.json')), { recursive: true }); fs.writeFileSync(dir(p + '.json'), JSON.stringify(j, null, 2) + '\n'); };

const P = (def, min, max, label) => ({ default: def, min, max, step: 1, label });
const BAUWEISEN = ['neutral', 'test', 'germanen', 'rom', 'rom_feld', 'vorlaeufer', 'konkordat'];
const slotParams = (h) => ({
  w: P(16, 1, 16, 'Breite (Voxel)'), h: P(h, 1, 16, 'Höhe (Voxel)'), d: P(16, 1, 16, 'Tiefe (Voxel)'),
  conn: P(10, 0, 15, 'Nachbarn gleicher Klasse (N1 O2 S4 W8)'),
});
// gemeinsame Bedingungen (Körper und Oberkante müssen dieselben Pfähle meinen)
const LET = {
  cn: 'floor(conn) % 2', ce: 'floor(conn / 2) % 2', cs: 'floor(conn / 4) % 2', cw: 'floor(conn / 8) % 2',
  hr: 'max(ce, cw)', vr: 'max(cn, cs)', both: 'hr * vr',
  hs: '(both == 0 && (hr == 1 || conn == 0)) ? 1 : 0',   // gerade O-W-Reihe oder Einzelstück
  vs: '(both == 0 && hr == 0 && vr == 1) ? 1 : 0',       // gerade N-S-Reihe
};
// Pfähle sitzen auf dem globalen Raster x = 4*i - 1 (Breite 3, Lücke 1); die Pfähle i = 0 und i = 4 liegen auf der Kachelgrenze
// (je 2 + 1 Voxel in den Nachbarkacheln), damit an jeder Anschlusskante ein Pfahl steht (Naht) und beide Hälften gleich hoch sind.
const POST = (c0, c4, mid) => `(i == 0 && (${mid[0]}) && ${c0}) || (i == 1 && (${mid[1]})) || (i == 2 && ${mid[2]}) || (i == 3 && (${mid[3]})) || (i == 4 && (${mid[4]}) && ${c4})`;
const HPOST = POST('cw', 'ce', ['hs || both', 'hs || (both && cw)', 'hs', 'hs || (both && ce)', 'hs || both']);
const VPOST = POST('cn', 'cs', ['vs || both', 'vs || (both && cn)', 'vs', 'vs || (both && cs)', 'vs || both']);
const WI = (c4) => `i == 0 ? 2 : (i == 1 ? (both ? 2 : 3) : (i == 2 ? 3 : (i == 3 ? (${c4} ? 3 : 2) : 1)))`;   // Breite entlang der Reihe
const W_H = WI('ce'), W_V = WI('cs');
const X_I = 'max(4 * i - 1, 0)';
const R5 = { count: 5, step: [0, 0, 0], var: 'i' };
const R4 = (dx, dz) => ({ count: 4, step: [dx, 0, dz], var: 'i' });

// ------------------------------------------------------------------------------------------------ Steckplatz rom_feld: Körper
const koerper = {
  id: 'kit/rom_feld/gemein/brustwehr_koerper', name: 'Rom-Feld-Steckplatz brustwehr_koerper: Erdfuß, Holzpfähle, Messingband mit Amber-Nieten, Endpfosten',
  tier: 'detail', palette: 'sommer_wald', tags: ['rom_feld', 'slot', 'gemein', 'vox01'], jitter: 0,
  notes: 'VOX-01 Paket 3, Entwurf A (Pfahlreihe). Kasten 16 x 10 x 16 Voxel. Erzeugt von tools/gen-vox01-feld.mjs.',
  params: slotParams(10), let: LET,
  variants: { einzeln: { conn: 0 }, ende_o: { conn: 2 }, ende_w: { conn: 8 }, gerade_ns: { conn: 5 }, ecke_no: { conn: 3 }, t: { conn: 7 }, kreuz: { conn: 15 } },
  ops: [
    // Erdfuß: drei Stufen, je Stufe 1 Voxel höher und 1 Voxel schmaler (Vereinigung der Arme, Ecken schließen von selbst)
    { name: 'Fuß O-W gerade', op: 'box', if: 'hs', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: [0, 0, 'k + 2'], size: [16, 1, '12 - 2 * k'], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß N-S gerade', op: 'box', if: 'vs', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: ['k + 2', 0, 0], size: ['12 - 2 * k', 1, 16], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß Knoten', op: 'box', if: 'both', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: ['k + 2', 0, 'k + 2'], size: ['12 - 2 * k', 1, '12 - 2 * k'], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß Arm O', op: 'box', if: 'both && ce', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: [8, 0, 'k + 2'], size: [8, 1, '12 - 2 * k'], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß Arm W', op: 'box', if: 'both && cw', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: [0, 0, 'k + 2'], size: [8, 1, '12 - 2 * k'], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß Arm N', op: 'box', if: 'both && cn', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: ['k + 2', 0, 0], size: ['12 - 2 * k', 1, 8], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    { name: 'Fuß Arm S', op: 'box', if: 'both && cs', repeat: { count: 3, step: [0, 1, 0], var: 'k' }, at: ['k + 2', 0, 8], size: ['12 - 2 * k', 1, 8], color: { shade: 'soil', f: '0.8 + k * 0.1' } },
    // Pfähle (Schaft bis y 10, Spitzen in der Oberkante)
    { name: 'Pfahl O-W', op: 'box', if: HPOST, repeat: R5, at: [X_I, 3, 6], size: [W_H, 7, 4], color: { gradient: ['wood_dark', 'wood'], axis: 'y' } },
    { name: 'Pfahl N-S', op: 'box', if: VPOST, repeat: R5, at: [6, 3, X_I], size: [4, 7, W_V], color: { gradient: ['wood_dark', 'wood'], axis: 'y' } },
    // Endpfosten und Eckpfosten (unterer Teil, dunkles Metall)
    { name: 'Eckpfosten', op: 'box', if: 'both', at: [6, 3, 6], size: [4, 7, 4], color: 'metal_dark' },
    { name: 'Endpfosten W', op: 'box', if: 'hs && cw == 0', at: [0, 3, 6], size: [2, 7, 4], color: 'metal_dark' },
    { name: 'Endpfosten O', op: 'box', if: 'hs && ce == 0', at: [14, 3, 6], size: [2, 7, 4], color: 'metal_dark' },
    { name: 'Endpfosten N', op: 'box', if: 'vs && cn == 0', at: [6, 3, 0], size: [4, 7, 2], color: 'metal_dark' },
    { name: 'Endpfosten S', op: 'box', if: 'vs && cs == 0', at: [6, 3, 14], size: [4, 7, 2], color: 'metal_dark' },
    // Messingband beidseitig (Schauseite in jede Richtung)
    { name: 'Band O-W gerade', op: 'box', if: 'hs', at: [0, 6, 10], size: [16, 2, 1], color: 'trim', mirror: 'z', mirrorAt: 8 },
    { name: 'Band O-W Arm W', op: 'box', if: 'both && cw', at: [0, 6, 10], size: [6, 2, 1], color: 'trim', mirror: 'z', mirrorAt: 8 },
    { name: 'Band O-W Arm O', op: 'box', if: 'both && ce', at: [10, 6, 10], size: [6, 2, 1], color: 'trim', mirror: 'z', mirrorAt: 8 },
    { name: 'Band N-S gerade', op: 'box', if: 'vs', at: [10, 6, 0], size: [1, 2, 16], color: 'trim', mirror: 'x', mirrorAt: 8 },
    { name: 'Band N-S Arm N', op: 'box', if: 'both && cn', at: [10, 6, 0], size: [1, 2, 6], color: 'trim', mirror: 'x', mirrorAt: 8 },
    { name: 'Band N-S Arm S', op: 'box', if: 'both && cs', at: [10, 6, 10], size: [1, 2, 6], color: 'trim', mirror: 'x', mirrorAt: 8 },
    // Amber-Nieten im Band, je Pfahlmitte
    { name: 'Niete O-W', op: 'box', repeat: R4(4, 0), if: 'hs || (both && ((cw && i < 2) || (ce && i == 3)))', at: [0, 7, 10], size: [1, 1, 1], color: { role: 'glow2', emit: 1.0 }, jitter: false, mirror: 'z', mirrorAt: 8 },
    { name: 'Niete N-S', op: 'box', repeat: R4(0, 4), if: 'vs || (both && ((cn && i < 2) || (cs && i == 3)))', at: [10, 7, 0], size: [1, 1, 1], color: { role: 'glow2', emit: 1.0 }, jitter: false, mirror: 'x', mirrorAt: 8 },
  ],
  anchor: [0, 0, 0],
};

// ------------------------------------------------------------------------------------------------ Steckplatz rom_feld: Oberkante
const PAR = '(i + 1) % 2';   // gerade i: hoch (Schaftende bei 2 Voxeln über y 10), ungerade: niedrig
const spitzen = (axis) => {
  const ps = axis === 'h';
  const cond = ps ? HPOST : VPOST, W_ = ps ? W_H : W_V;
  const at = (a, y, z) => (ps ? [a, y, z] : [z, y, a]);        // a = Position entlang der Reihe, z = quer
  const sz = (len, hh, q) => (ps ? [len, hh, q] : [q, hh, len]);
  const n = ps ? 'O-W' : 'N-S';
  return [
    { name: `Schaftende ${n}`, op: 'box', if: cond, repeat: R5, at: at(X_I, 0, 6), size: sz(W_, `2 * (${PAR})`, 4), color: { gradient: ['wood_dark', 'wood'], axis: 'y' } },
    { name: `Spitze unten ${n}`, op: 'box', if: cond, repeat: R5, at: at(X_I, `2 * (${PAR})`, 6), size: sz(W_, 2, 4), color: 'wood_light' },
    { name: `Spitze oben ${n}`, op: 'box', if: cond, repeat: R5, at: at('i == 4 ? 15 : 4 * i', `2 * (${PAR}) + 2`, 7), size: sz(1, 2, 2), color: 'wood_light' },
  ];
};
const kappen = (name, cond, x, z, bx, bz) => [
  { name: `${name} Schaft`, op: 'box', if: cond, at: [x, 0, z], size: [bx, 5, bz], color: 'metal_dark' },
  { name: `${name} Kappe`, op: 'box', if: cond, at: [x, 5, z], size: [bx, 1, bz], color: 'trim' },
  { name: `${name} Lampe`, op: 'box', if: cond, at: [x + Math.floor(bx / 2) - 1, 2, z + bz - 1], size: [2, 2, 1], color: { role: 'glow2', emit: 1.0 }, jitter: false },
];
const oberkante = {
  id: 'kit/rom_feld/gemein/brustwehr_oberkante', name: 'Rom-Feld-Steckplatz brustwehr_oberkante: helle Pfahlspitzen, Kappen der Endpfosten mit Amberlampe',
  tier: 'detail', palette: 'sommer_wald', tags: ['rom_feld', 'slot', 'gemein', 'vox01'], jitter: 0,
  notes: 'VOX-01 Paket 3. Kasten 16 x 6 x 16 Voxel ab y 10: Pfähle enden bei y 14 oder 16 (Höhe 0,875 bzw. 1,0 m), Endpfosten bei 1,0 m.',
  params: slotParams(6), let: LET,
  variants: { einzeln: { conn: 0 }, ende_o: { conn: 2 }, gerade_ns: { conn: 5 }, ecke_no: { conn: 3 }, kreuz: { conn: 15 } },
  ops: [
    ...spitzen('h'), ...spitzen('v'),
    ...kappen('Eckpfosten', 'both', 6, 6, 4, 4),
    ...kappen('Endpfosten W', 'hs && cw == 0', 0, 6, 2, 4),
    ...kappen('Endpfosten O', 'hs && ce == 0', 14, 6, 2, 4),
    ...kappen('Endpfosten N', 'vs && cn == 0', 6, 0, 4, 2),
    ...kappen('Endpfosten S', 'vs && cs == 0', 6, 14, 4, 2),
  ],
  anchor: [0, 0, 0],
};

// ------------------------------------------------------------------------------------------------ neutrale Steckplätze (Gerüst-Vorgabe)
const neutralBody = (id, name, h, color) => ({
  id, name, tier: 'detail', palette: 'base', tags: ['geruest', 'slot', 'vox01'], jitter: 0, params: slotParams(h),
  let: { cn: 'floor(conn) % 2', ce: 'floor(conn / 2) % 2', cs: 'floor(conn / 4) % 2', cw: 'floor(conn / 8) % 2' },
  ops: [
    { name: 'Mitte', op: 'box', at: [6, 0, 6], size: [4, 'h', 4], color },
    { name: 'Arm N', op: 'box', if: 'cn', at: [6, 0, 0], size: [4, 'h', 6], color },
    { name: 'Arm S', op: 'box', if: 'cs', at: [6, 0, 10], size: [4, 'h', 6], color },
    { name: 'Arm O', op: 'box', if: 'ce', at: [10, 0, 6], size: [6, 'h', 4], color },
    { name: 'Arm W', op: 'box', if: 'cw', at: [0, 0, 6], size: [6, 'h', 4], color },
  ],
  anchor: [0, 0, 0],
});

// ------------------------------------------------------------------------------------------------ Gerüst und Hülle
const geruest = {
  id: 'kit/geruest/brustwehr', name: 'Bausatz-Gerüst – Brustwehr/Palisade (≤ 1,0 m, Stufe detail, helle Oberkante)',
  tier: 'detail', palette: 'base', tags: ['kit', 'geruest', 'brustwehr'], footprint: [1, 1], jitter: 0,
  slots: ['brustwehr_koerper', 'brustwehr_oberkante'],
  notes: 'VOX-01 Paket 3. Neues Gerüst-kind brustwehr nach dem Muster deckung_halb, aber Stufe detail (16 Voxel je Kachel). cut und zustand sind ohne Wirkung (nur für gleiche Aufrufer-Parameter).',
  params: {
    conn: P(10, 0, 15, 'Nachbarn gleicher Klasse (N1 O2 S4 W8)'),
    cut: P(0, 0, 1, 'ohne Wirkung'),
    zustand: P(0, 0, 2, 'ohne Wirkung'),
    art: { default: 'aussenposten', options: ['aussenposten', 'station', 'ruine', 'schiff'], label: 'Kartenart' },
    bauweise: { default: 'neutral', options: BAUWEISEN, label: 'Bauweise (füllt die Steckplätze)' },
  },
  variants: {
    frei: { conn: 0 }, ende: { conn: 2 }, ende_w: { conn: 8 }, gerade_ns: { conn: 5 }, ecke: { conn: 6 }, ecke_no: { conn: 3 }, t: { conn: 7 }, kreuz: { conn: 15 },
    probe: { bauweise: 'neutral' }, probe_ecke: { bauweise: 'neutral', conn: 6 },
  },
  ops: [
    { name: 'Steckplatz brustwehr_koerper', op: 'use', model: 'kit/{bauweise}/{art}/brustwehr_koerper', fallback: ['kit/{bauweise}/gemein/brustwehr_koerper', 'kit/geruest/slot/brustwehr_koerper'], at: [0, 0, 0], params: { conn: 'conn', seed: 'seed', w: 16, h: 10, d: 16 } },
    { name: 'Steckplatz brustwehr_oberkante', op: 'use', model: 'kit/{bauweise}/{art}/brustwehr_oberkante', fallback: ['kit/{bauweise}/gemein/brustwehr_oberkante', 'kit/geruest/slot/brustwehr_oberkante'], at: [0, 10, 0], params: { conn: 'conn', seed: 'seed', w: 16, h: 6, d: 16 } },
  ],
  anchor: [8, 0, 8],
};
const huelle = {
  id: 'kit/rom_feld/brustwehr', name: 'Rom-Feld – brustwehr: Palisade/Brustwehr (Holzpfähle auf Erdfuß, Messingband, Amber-Nieten, 1,0 m)',
  tier: 'detail', palette: 'sommer_wald', tags: ['kit', 'rom_feld', 'brustwehr'], footprint: [1, 1], jitter: 0,
  notes: 'VOX-01 Paket 3, Entwurf A. conn absolut (N1 O2 S4 W8, N = -z), Kachel nicht drehen: Reihen in alle Richtungen, Ecken, T und Kreuz sind im Teil gebaut.',
  params: {
    conn: P(10, 0, 15, 'Nachbarn gleicher Klasse (N1 O2 S4 W8)'),
    cut: P(0, 0, 1, 'ohne Wirkung'),
    zustand: P(0, 0, 2, 'ohne Wirkung'),
    art: { default: 'aussenposten', options: ['aussenposten', 'station', 'ruine', 'schiff'], label: 'Kartenart' },
  },
  variants: { frei: { conn: 0 }, ende: { conn: 2 }, ende_w: { conn: 8 }, gerade_ns: { conn: 5 }, ecke: { conn: 6 }, ecke_no: { conn: 3 }, t: { conn: 7 }, kreuz: { conn: 15 } },
  ops: [{ name: 'Gerüst (Bauweise rom_feld) brustwehr', op: 'use', model: 'kit/geruest/brustwehr', at: [8, 0, 8], params: { conn: 'conn', cut: 'cut', zustand: 'zustand', art: '{art}', bauweise: 'rom_feld', seed: 'seed' } }],
  anchor: [8, 0, 8],
};

W('kit/rom_feld/gemein/brustwehr_koerper', koerper);
W('kit/rom_feld/gemein/brustwehr_oberkante', oberkante);
W('kit/geruest/slot/brustwehr_koerper', neutralBody('kit/geruest/slot/brustwehr_koerper', 'Gerüst-Steckplatz brustwehr_koerper (neutral): Klotzreihe', 10, 'stone'));
W('kit/geruest/slot/brustwehr_oberkante', neutralBody('kit/geruest/slot/brustwehr_oberkante', 'Gerüst-Steckplatz brustwehr_oberkante (neutral): helle Klotzreihe', 6, 'stone_light'));
W('kit/geruest/brustwehr', geruest);
W('kit/rom_feld/brustwehr', huelle);
console.log('Brustwehr geschrieben');
