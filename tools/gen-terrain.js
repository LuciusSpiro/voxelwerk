// Hilfsskript: erzeugt Terrain-Zeichenkarten aus Funktionen und gibt sie als JSON aus.
// Aufruf: node tools/gen-terrain.js rom-aussenposten  → druckt { rows, heights } zum Einfügen in die Szene.
// Neue Szenen-Generatoren hier als Funktion ergänzen.
import { hash3 } from '../core/color.js';

const GENERATORS = {
  // 36 × 28 m: Lager im Norden (z < 10), Mauer bei z = 10, außen Wiese, Hang im Westen, Weg zum Tor
  'rom-aussenposten': () => {
    const W = 36, D = 28, rows = [], heights = [];
    for (let z = 0; z < D; z++) {
      let r = '', h = '';
      for (let x = 0; x < W; x++) {
        const n = hash3(x, 0, z, 11);
        let ch = '.', hh = 1;
        if (z < 10) ch = '#';                                          // Lagerboden
        else {
          const dHill = Math.max(0, 9 - x) + (x < 13 ? Math.max(0, z - 20) * 0.6 : 0);  // Hang im Westen, nach Süden auslaufend
          hh = 1 + (dHill > 6 ? 2 : dHill > 3 ? 1 : 0);
          if (x >= 16 && x <= 19) ch = ':';                              // Weg zum Tor
          else if (n < 0.18) ch = ',';                                   // trockene Wiese
          if (hh >= 3 && n > 0.82) ch = '^';                             // Fels am Hang
          if (x >= 15 && x <= 20 && z <= 12) ch = ':';                   // Vorplatz am Tor
        }
        r += ch; h += hh.toString(36);
      }
      rows.push(r); heights.push(h);
    }
    return { rows, heights };
  },
};

const name = process.argv[2];
if (!GENERATORS[name]) { console.log('Bekannt: ' + Object.keys(GENERATORS).join(', ')); process.exit(1); }
console.log(JSON.stringify(GENERATORS[name](), null, 2));
