// Biome (VOX-02 Paket 1): Prüfung der Gelände-Paletten und -Stimmungen nach der "Wertleiter".
// Verwendet von tools/check.js (Abschnitt "Biome") und tools/test-biom.mjs (Mutationsproben, Gegenprobe).
// Regeln siehe AUTHORING.md, Abschnitt "Biom-Paletten".
//
// Messgröße: CIE-L* (0 = schwarz, 100 = weiß) aus der Relativ-Luminanz Y der sRGB-Farbe (Rec.709-Gewichte).
// Begründung: Die Wertleiter ist eine Regel über *gesehene Helligkeit* (Graustufenprobe der Mockups). L* ist
// wahrnehmungsgleich, gleiche L*-Abstände sind überall auf der Skala gleich gut zu sehen. HSL-L dagegen
// behandelt Grün und Blau wie Gelb (Gelb 50 % wirkt viel heller als Blau 50 %) und würde z. B. Wiese und
// Wüste verschieden streng messen. Die Prüfung nutzt die Rollenfarbe selbst, nicht die belichtete
// Bildfarbe (Stimmung, Schatten): Die Leiter gilt für die Palette, die Stimmung bekommt eigene Grenzen.

export const BIOME = ['biom_wueste', 'biom_wiesenwald', 'biom_vulkan'];

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
/** CIE-L* einer Farbe als Zahl 0xRRGGBB. */
export function lstar(c) {
  const Y = 0.2126 * lin((c >> 16) & 255) + 0.7152 * lin((c >> 8) & 255) + 0.0722 * lin(c & 255);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (24389 / 27) * Y;
}

/**
 * Schwellen in L*-Punkten. Mockup A (Entwurf GEL-01) zum Vergleich (gemessen): Boden 52 (Vulkan) bis 76 (Wüste), Fels 23 bis 39,
 * Die Schwellen liegen mit Abstand um diese Werte; der Entwurf hatte keine Teppich-Stufe und eine helle Kappe, beides ist hier neu.
 */
export const SCHWELLEN = {
  bodenMin: 42, bodenMax: 74,        // Boden mittelhell: weder zu dunkel noch zu hell
  bodenSpreizung: 5,                 // größter Unterschied zwischen Bodenrollen (kein Schachbrett aus Bodenvarianten: gemessen 6–7 L* je Kachel fiel auf)
  teppichMin: 8, teppichMax: 14,     // Teppich eine Stufe dunkler als der dunkelste Boden: deutlich sichtbar (mind. 8), aber nicht so dunkel wie Fest
  steinAbweichung: 10,               // Stein am Boden angeglichen (Betrag zur mittleren Bodenhelligkeit)
  steinKappe: 3,                     // stone_light höchstens so viel heller als der hellste Boden (keine helle Kappe)
  steinBand: 14,                     // stone_light minus stone_dark höchstens (kein Sockel-/Kappen-Kontrast im Stein)
  festAbstand: 6,                    // Fels dunkler als Teppich und stone_dark um mindestens so viel
  felsUeberAbgrund: 20,              // rock mindestens so viel heller als abgrund (in Graustufen kein schwarzer Block)
  wasserUnterBoden: 8,               // Wasser (fluid ohne Leuchten) mindestens so viel dunkler als der dunkelste Boden (Treibsand, Sand)
  bewuchsUeber: 2,                   // Bewuchs (plant*) nie heller als der dunkelste Boden plus so viel
};

/** Geländerollen, die ein Biom setzen darf (alles andere gehört der Kultur-Palette). */
export const BIOM_ROLLEN = /^(grass(_dark|_light)?|soil(_dark)?|sand|plant(_dark|_light)?|flower2?|rock(_dark)?|stone(_dark|_light)?|wood(_dark)?|teppich|fluid(_v)?|abgrund)$/;
/** Rollen, die jede Biom-Palette selbst setzen muss. */
export const BIOM_PFLICHT = ['grass', 'grass_dark', 'grass_light', 'sand', 'soil', 'soil_dark', 'plant', 'plant_dark', 'plant_light',
  'stone', 'stone_dark', 'stone_light', 'rock', 'rock_dark', 'teppich', 'fluid', 'fluid_v', 'abgrund'];
/** Rollen, die die Bodenfläche bilden (die Oberfläche, auf der gespielt wird). */
export const BODEN_ROLLEN = ['grass', 'grass_dark', 'grass_light', 'sand', 'soil'];

const f1 = (x) => x.toFixed(1);
/** Farbton (0 bis 360) und HSV-Sättigung (0 bis 1) einer Farbe als Zahl 0xRRGGBB. */
function hueSat(c) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return [0, 0];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / mx];
}

/**
 * Prüft eine Biom-Palette. `roh` = Palettendatei (extends, adjust, roles), `aufgeloest` = lib.palette(id).roles.
 * Gibt eine Liste von Meldungen zurück (leer = sauber).
 */
export function pruefeBiomPalette(roh, aufgeloest) {
  const m = [], S = SCHWELLEN, id = roh.id;
  const eigen = Object.keys(roh.roles || {});
  const L = (r) => lstar(aufgeloest[r].c);
  // Aufbau: erbt von base, kein adjust, nur Geländerollen
  if (roh.extends !== 'base') m.push(`${id}: erbt von "${roh.extends}", muss von "base" erben (ein Biom ist keine Kultur-Variante)`);
  if (roh.adjust) m.push(`${id}: adjust ist nicht erlaubt (ein Biom setzt Rollen ausdrücklich)`);
  for (const r of eigen) if (!BIOM_ROLLEN.test(r)) m.push(`${id}: Rolle "${r}" ist keine Geländerolle (ein Biom setzt nur Gelände, sonst färbt es Mauern und Figuren um)`);
  for (const r of BIOM_PFLICHT) if (!eigen.includes(r)) m.push(`${id}: Pflichtrolle "${r}" fehlt`);
  if (m.length) return m;   // ohne vollständige Rollen sind die Helligkeitsregeln sinnlos
  // Leuchten: nur Wasser/Lava; Lava leuchtet, Wasser nicht
  for (const r of eigen) if (aufgeloest[r].e > 0 && !/^fluid(_v)?$/.test(r)) m.push(`${id}: Rolle "${r}" leuchtet (emit ${aufgeloest[r].e}); Leuchten ist nur bei fluid erlaubt`);
  if (id === 'biom_vulkan' && !(aufgeloest.fluid.e > 0)) m.push(`${id}: fluid (Lava) muss leuchten (emit > 0)`);
  if (id !== 'biom_vulkan' && aufgeloest.fluid.e > 0) m.push(`${id}: fluid (Wasser) darf nicht leuchten`);
  // Vulkan: Blumen dürfen nicht wie Glut lesen (Glut ist nur Lava): Farbton nicht Rot bis Gelb bei hoher Sättigung
  if (id === 'biom_vulkan') for (const r of ['flower', 'flower2']) {
    const [h, sat] = hueSat(aufgeloest[r].c);
    if (sat > 0.35 && (h >= 345 || h <= 70)) m.push(`${id}: ${r} (Farbton ${Math.round(h)}°, Sättigung ${sat.toFixed(2)}) liest sich als Glutpunkt; Glut gibt es nur in der Lava (kühle, blasse Blumen)`);
  }
  // Boden: Band und Ruhe
  const boden = BODEN_ROLLEN.map((r) => [r, L(r)]);
  const bMin = Math.min(...boden.map((x) => x[1])), bMax = Math.max(...boden.map((x) => x[1])), bMitte = boden.reduce((a, x) => a + x[1], 0) / boden.length;
  for (const [r, l] of boden) if (l < S.bodenMin || l > S.bodenMax) m.push(`${id}: Boden ${r} L* ${f1(l)} liegt außerhalb ${S.bodenMin} bis ${S.bodenMax} (mittelhell)`);
  if (bMax - bMin > S.bodenSpreizung) m.push(`${id}: Bodenrollen streuen um ${f1(bMax - bMin)} L* (höchstens ${S.bodenSpreizung}, sonst Schachbrett aus Bodenvarianten)`);
  // Teppich: eine Stufe dunkler als der dunkelste Boden
  const tL = L('teppich'), stufe = bMin - tL;
  if (stufe < S.teppichMin) m.push(`${id}: Teppich L* ${f1(tL)} ist ${stufe <= 0 ? `nicht dunkler, sondern ${f1(-stufe)} heller` : `nur ${f1(stufe)} dunkler`} als der dunkelste Boden (${f1(bMin)}); verlangt mindestens ${S.teppichMin} dunkler`);
  if (stufe > S.teppichMax) m.push(`${id}: Teppich L* ${f1(tL)} ist ${f1(stufe)} dunkler als der Boden (${f1(bMin)}); höchstens ${S.teppichMax}, sonst liest er sich als Fels`);
  // Stein: am Boden angeglichen, keine helle Kappe
  for (const r of ['stone', 'stone_dark', 'stone_light']) {
    const d = L(r) - bMitte;
    if (Math.abs(d) > S.steinAbweichung) m.push(`${id}: ${r} L* ${f1(L(r))} weicht ${f1(Math.abs(d))} vom Boden (${f1(bMitte)}) ab (höchstens ${S.steinAbweichung}, Stein ist an den Hintergrund angeglichen)`);
  }
  if (L('stone_light') > bMax + S.steinKappe) m.push(`${id}: stone_light L* ${f1(L('stone_light'))} ist heller als der hellste Boden (${f1(bMax)}) plus ${S.steinKappe}: helle Kappe nicht erlaubt`);
  if (L('stone_light') - L('stone_dark') > S.steinBand) m.push(`${id}: Stein spannt ${f1(L('stone_light') - L('stone_dark'))} L* zwischen stone_dark und stone_light (höchstens ${S.steinBand}, sonst Kappe/Sockel)`);
  // Fest und hoch am dunkelsten
  const fest = Math.max(L('rock'), L('rock_dark')), drueber = Math.min(tL, L('stone_dark'), L('stone'));
  if (fest > drueber - S.festAbstand) m.push(`${id}: Fels (höchstens ${f1(fest)} L*) ist nicht ${S.festAbstand} dunkler als Teppich/Stein (${f1(drueber)}); Fest-und-hoch muss die dunkelste Stufe sein`);
  if (L('rock_dark') > L('rock')) m.push(`${id}: rock_dark ist heller als rock`);
  if (L('abgrund') > L('rock_dark')) m.push(`${id}: abgrund L* ${f1(L('abgrund'))} ist heller als rock_dark (${f1(L('rock_dark'))}); die Tiefe ist das Dunkelste`);
  // Fels gegen Abgrund: in Graustufen muss die Felsoberseite vom Abgrund abgesetzt sein
  if (L('rock') - L('abgrund') < S.felsUeberAbgrund) m.push(`${id}: rock L* ${f1(L('rock'))} liegt nur ${f1(L('rock') - L('abgrund'))} über abgrund (${f1(L('abgrund'))}); verlangt mindestens ${S.felsUeberAbgrund} (sonst ein schwarzer Block)`);
  // Wasser (nicht leuchtend) dunkler als aller Boden einschließlich Treibsand
  if (!(aufgeloest.fluid.e > 0) && bMin - L('fluid') < S.wasserUnterBoden) m.push(`${id}: Wasser (fluid) L* ${f1(L('fluid'))} ist nur ${f1(bMin - L('fluid'))} dunkler als der dunkelste Boden (${f1(bMin)}); verlangt mindestens ${S.wasserUnterBoden} (Wasser ist in Graustufen nicht von Sand/Treibsand zu unterscheiden)`);
  // Bewuchs hebt sich nie hell vom Boden ab
  for (const r of ['plant', 'plant_dark', 'plant_light']) if (L(r) > bMin + S.bewuchsUeber) m.push(`${id}: ${r} L* ${f1(L(r))} ist heller als der dunkelste Boden (${f1(bMin)}) plus ${S.bewuchsUeber}`);
  return m;
}

/** Grenzen der Biom-Stimmungen (Mittagslicht): kein Dunst, Sonne farbneutral genug, Belichtung wie planet_day. */
export const STIMMUNG = { sonneSat: 0.22, nebelNah: 2.2, nebelFern: 6, expMin: 0.9, expMax: 1.1, sonneMin: 2.5, sonneMax: 3.6, hemiMin: 0.9, hemiMax: 1.3, bloomMax: 0.35 };
const hexInt = (s) => parseInt(s.slice(1), 16);
const hsvS = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };

/** Prüft eine Biom-Stimmung (Objekt aus assets/moods). Meldungen wie bei pruefeBiomPalette. */
export function pruefeBiomStimmung(mood) {
  const m = [], T = STIMMUNG, id = mood.id;
  for (const k of ['background', 'fog', 'hemi', 'sun', 'exposure', 'bloom']) if (mood[k] === undefined) m.push(`${id}: Feld "${k}" fehlt`);
  if (m.length) return m;
  const s = hsvS(hexInt(mood.sun.color));
  if (s > T.sonneSat) m.push(`${id}: Sonnenfarbe ${mood.sun.color} ist zu satt (Sättigung ${s.toFixed(2)}, höchstens ${T.sonneSat}); sie färbt sonst den Boden um (Asche wird braun)`);
  if (mood.fog.near < T.nebelNah || mood.fog.far < T.nebelFern) m.push(`${id}: Nebel (near ${mood.fog.near}, far ${mood.fog.far}) ist dichter als ${T.nebelNah}/${T.nebelFern} (planet_day): kein Dunst, der alles milchig macht`);
  if (mood.exposure < T.expMin || mood.exposure > T.expMax) m.push(`${id}: exposure ${mood.exposure} außerhalb ${T.expMin} bis ${T.expMax} (Boden würde zu dunkel oder zu hell)`);
  if (mood.sun.intensity < T.sonneMin || mood.sun.intensity > T.sonneMax) m.push(`${id}: Sonnenstärke ${mood.sun.intensity} außerhalb ${T.sonneMin} bis ${T.sonneMax}`);
  if (mood.hemi.intensity < T.hemiMin || mood.hemi.intensity > T.hemiMax) m.push(`${id}: Himmelslicht ${mood.hemi.intensity} außerhalb ${T.hemiMin} bis ${T.hemiMax}`);
  if (mood.bloom.strength > T.bloomMax) m.push(`${id}: bloom ${mood.bloom.strength} über ${T.bloomMax} (Leuchtschleier)`);
  return m;
}

/** Fingerabdruck der aufgelösten Rollen (FNV-1a über sortierte Name:Farbe:Leuchten) für die Gegenprobe der Kulturpaletten. */
export function rollenHash(aufgeloest) {
  const s = Object.keys(aufgeloest).sort().map((k) => `${k}:${aufgeloest[k].c}:${aufgeloest[k].e}`).join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
/** Hash aller Paletten außer den Biomen: { id: hash } und Gesamthash. */
export function kulturHashes(lib, ids) {
  const out = {};
  for (const id of ids) if (!BIOME.includes(id)) out[id] = rollenHash(lib.palette(id).roles);
  return out;
}
export function gesamtHash(hashes) {
  const s = Object.keys(hashes).sort().map((k) => `${k}=${hashes[k]}`).join(';');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + Object.keys(hashes).length;
}
