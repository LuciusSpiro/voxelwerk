// Vergleicht die Dreiecke je Fall zweier Prüfbogen-Berichte (alt/neu): node tools/pruefbogen-vergleich.mjs <alt.json> <neu.json>
import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const m = new Map(a.cases.map((c) => [c.key, c]));
const rows = [];
let sa = 0, sb = 0;
for (const c of b.cases) {
  const o = m.get(c.key);
  if (!o) continue;
  rows.push([c.row + ' ' + c.label, o.tris, c.tris]);
  sa += o.tris; sb += c.tris;
}
const pick = process.argv[4] ? new RegExp(process.argv[4]) : /conn (0|1|3|5|6|7|10|15)$/;
for (const r of rows) if (pick.test(r[0])) console.log(r[0].padEnd(34), String(r[1]).padStart(5), '->', String(r[2]).padStart(5));
console.log('Summe alle Fälle', sa, '->', sb, `(${(((sb - sa) / sa) * 100).toFixed(1)} %)`);
