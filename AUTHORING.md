# Voxelwerk – Assets erstellen (Format-Vertrag)

Dieses Dokument ist der Vertrag für alle, die Modelle, Figuren und Szenen bauen – Menschen wie Agents.
Bei Widerspruch gilt der Code in `core/`.

## Grundidee

Modelle sind **Rezepte** (JSON), keine fertigen Voxelhaufen. Ein Rezept beschreibt Formen, Farben aus
einer **Palette mit Rollen** und **Parameter**. Dadurch:

- ein Rezept → viele Varianten (Parameter, `seed`)
- Palette tauschen → dasselbe Modell für ein anderes Volk
- Teilmodelle (`use`) → Baukasten statt Kopieren
- von Hand Poliertes (MagicaVoxel `.vox`) lässt sich per `vox`-Schritt einbinden

## Auflösungsstufen (Stonehearth-Prinzip)

1 Kachel = 1 m = 1 three.js-Einheit.

| Stufe | Voxel/m | 1 Voxel | Wofür | typische Größe |
|---|---|---|---|---|
| `terrain` | 1 | 1 m | Boden, Gelände (nur über Szenen-`terrain`) | – |
| `architecture` | 4 | 25 cm | Wände, Türme, Tore, Säulen, Gebäude, Plattformen, große Felsen | Wandsegment 4 m = 16 Voxel |
| `detail` | 16 | 6,25 cm | Figuren, Props, Waffen, Konsolen, Pflanzen, Bäume | Figur 31 Voxel, Kiste 12 Voxel |

Stufen werden **nicht in einem Modell gemischt** (`use` nur innerhalb derselben Stufe). Gemischt wird in der Szene.
Faustregel: Detail gehört dorthin, wo man hinschaut. Große Flächen ruhig halten (wenig Rauschen),
kleine Dinge reich ausgestalten.

## Ordner und IDs

```
assets/
  palettes/<id>.json     Farbrollen (base, rom, planet_mediterran …)
  models/<ordner>/<name>.json   Rezepte; ID = Pfad ohne .json, z. B. "rom/kiste"
  rigs/human.json        Skelett der Figuren
  poses/human.json       Posen
  figures/<ordner>/<name>.json  Figur = Rig + Teile + Anbauten
  moods/<id>.json        Stimmung (Licht, Nebel, Bloom)
  scenes/<id>.json       Szene
  vox/…                  .vox-Dateien
```

IDs: Kleinbuchstaben, Ziffern, `_`, `-`, Ordner mit `/`. Umlaute ausschreiben (`saeule`). Das Feld `"id"` in der
Datei muss genau zur Datei passen.

## Modell (Rezept)

```json
{
  "id": "rom/kiste",
  "name": "Versorgungskiste (Rom)",
  "tier": "detail",
  "palette": "rom",
  "tags": ["prop", "rom", "deckung"],
  "footprint": [0.75, 0.6],
  "params": {
    "w": { "default": 12, "min": 6, "max": 24, "step": 1, "label": "Breite (Voxel)" },
    "style": { "default": "a", "options": ["a", "b"], "label": "Ausführung" }
  },
  "let": { "half": "floor(w/2)" },
  "variants": { "lang": { "w": 20 }, "klein": { "w": 8 } },
  "ops": [ … ],
  "anchor": ["w/2", 0, "d/2"]
}
```

- `footprint` [Breite x, Tiefe z] in **Metern**: Grundfläche, damit Streuung (Gras …) nicht hineinwächst.
- `params`: Zahlen (mit min/max/step → Regler im Editor) oder `options` (Auswahlliste, Strings).
  `seed` gibt es immer (Varianten von Rauschen und Zufall); nicht selbst deklarieren.
- `let`: abgeleitete Werte, der Reihe nach ausgewertet.
- `variants`: benannte Parameter-Sätze (Buttons im Editor, werden von `npm run check` mitgebaut).
- `anchor`: Platzierungspunkt in Voxeln (Pivot). Ohne Angabe: Mitte der Grundfläche, unterste Voxelschicht.
  **Konvention: Anker = Mitte unten (am Boden)**, damit Szenen das Modell auf das Terrain stellen.
- Ausrichtung: **Vorderseite zeigt nach +z**, oben = +y. Eine Szene dreht mit `rot` (Grad, gegen den Uhrzeigersinn von oben).

### Ausdrücke

Jede Zahl darf ein String-Ausdruck sein: `"h-2"`, `"floor(w/2)"`, `"max(1, d-4)"`, `"i*4"`, `"style == 1 ? 3 : 0"`.
Erlaubt: + − * / %, Vergleiche, `&& || !`, `?:`, `min max floor ceil round abs sqrt sin cos hash` (siehe „Ausdrücke in emit und Farbangaben“).
Strings aus `options` lassen sich **nicht** in Ausdrücken vergleichen – für Schalter Zahlen-Parameter (0/1) nehmen.

### Bauschritte (`ops`)

Gemeinsame Felder jeder Form:

| Feld | Bedeutung |
|---|---|
| `name` | Beschriftung (erscheint in Fehlermeldungen) – immer setzen |
| `color` | Farbangabe (siehe unten), Default `"primary"` |
| `mode` | `add` (Standard, überschreibt), `under` (nur in leere Zellen), `paint` (nur vorhandene Voxel umfärben), `carve` (löschen) |
| `if` | Ausdruck; Schritt entfällt, wenn 0 |
| `repeat` | `{ "count": 5, "step": [4,0,0], "var": "i" }` – wiederholt den Schritt, `i` im Ausdruck verfügbar |
| `mirror` | `"x"`, `"z"` oder `"xz"` + `mirrorAt` (Ebene, z. B. `"w/2"`, bei `"xz"` auch `{ "x": …, "z": … }`) – fügt eine Spiegelkopie hinzu |
| `jitter` | `false` = keine Helligkeitsstreuung je Voxel (z. B. für Glas, Leuchten, Schrift) |
| `emit` | Leuchtstärke (überschreibt die der Rolle) |

Formen (Koordinaten in Voxeln der Modellstufe; `at` ist bei `box`/`wedge` die Ecke mit kleinsten Werten):

| op | Felder |
|---|---|
| `box` | `at` [x,y,z], `size` [w,h,d] |
| `wedge` | wie box, dazu `slope` (`"+x"` … fällt zur +x-Seite ab) **oder** `gable` (`"x"` = Satteldach, First in der Mitte, fällt nach ±x ab) |
| `cyl` | `at` = Mittelpunkt der Grundfläche (Halbzahlen erlaubt: `[0, 0, 0]` = Mitte zwischen 4 Voxeln), `r`, `h`, optional `axis` (`y` Standard, `x`, `z`), `r2` (Radius am Ende → Kegel), `hollow` (Wandstärke), `arc` [von, bis] Grad |
| `ellipsoid` | `at` = Mittelpunkt, `r` (Zahl oder [rx,ry,rz]), optional `half` (`"+y"` = nur obere Hälfte) |
| `line` | `from`, `to` (Punkte), `r` (Dicke als Radius, 0.5 = ein Voxel) – Kabel, Streben, Speere, Äste |
| `loft` | Rumpf aus Querschnitten entlang z: `sections` [{ `z`, `w`, `up`, `down` (oder `h`), `x`, `y`, `bevel`, `round` }] – zwischen den z-Werten linear interpoliert. Querschnitt = Rechteck `w` breit von `y-down` bis `y+up`, Mitte `x`; `bevel` = Fase an den Ecken (Voxel), `round` 1 = Ellipse. Für Schiffsrümpfe, Gondeln, Hälse |
| `group` | `ops`, optional `at` (Verschiebung), `rot` (90er-Schritte um y) mit `pivot` [x,z] |
| `use` | Teilmodell: `model`, `params`, `at` (wohin der **Anker** des Teilmodells kommt), `rot`, `pivot`, optional `palette`/`colors` |
| `vox` | `.vox` einsetzen: `file` (relativ zu `assets/`, z. B. `"vox/rom/helm.vox"`), `at`, `remap` { "Paletten-Index": Farbangabe } |
| `erode` | Verfall: trägt Kanten des bisher Gebauten ab, `density`, `depth`, `edges`, optional `at`/`size` (siehe Abschnitt „erode“) |

Achtung `mirror` + `repeat` mit Schritt quer zur Spiegelebene: Die Spiegelkopie wird in **dieselbe** Richtung
weitergeschoben (läuft also nach außen weg). Solche Reihen in eine `group` mit `mirror` packen – dann stimmt es.

Hinweis: Bei kleinen Radien treffen `arc`/`hollow` oft keine Voxelmitte. Für schmale Streifen auf runden
Körpern lieber eine dünne `box` mit `mode: "paint"` durch den Körper legen.

### Farben

Palette = Rollen. Modelle verwenden **Rollen**, keine festen Farben (feste Hexwerte nur in Ausnahmen):

`primary secondary trim metal metal_dark metal_light stone stone_dark stone_light paving paving_dark cloth
cloth2 leather skin skin_shadow hair glow glow2 warning glass dark rubber white black wood wood_dark plant
plant_dark plant_light flower flower2 soil soil_dark sand rock rock_dark grass grass_dark grass_light water`

Rollennamen sind frei (`base` definiert die Standardrollen, jede Palette darf eigene ergänzen, z. B. `nadel`,
`soil_graben`). Neu mit den Biomen: `teppich`, `fluid`, `fluid_v`, `abgrund` (nur in `biom_*`, siehe „Biom-Paletten“).

Bedeutung in `rom`: primary = Purpurrot (Rüstung, Paneele), secondary = Marmorweiß (Keramikplatten),
trim = Gold, metal* = Gunmetal, stone* = Travertin/Marmor, cloth = rotes Tuch, cloth2 = Kaiserpurpur,
glow = kaltweißes Energielicht (leuchtet), glow2 = warmes Amber (leuchtet).

Farbangaben (verschachtelbar):

```json
"primary"                                             Rolle
"#C0FFEE"                                             feste Farbe (sparsam)
{ "role": "glow", "emit": 2.2 }                        Rolle, stärker leuchtend
{ "shade": "primary", "f": 0.75 }                      abgedunkelt (<1) / aufgehellt (>1)
{ "noise": ["stone", "stone_light"], "weights": [3,1], "cell": 1 }   Zufall je Voxel (cell = Blockgröße)
{ "stripes": ["primary", "trim"], "axis": "y", "period": 2 }         Bänder (lokal in der Form)
{ "checker": ["a", "b"], "period": 1 }
{ "gradient": ["soil", "grass"], "axis": "y" }
{ "frame": "trim", "fill": "primary", "axes": "xy", "width": 1 }       Rand der Form (z. B. Paneel mit Goldkante)
```

Jedes Voxel bekommt automatisch eine leichte Helligkeitsstreuung (Stufe abhängig) – das ergibt den
„handbemalten“ Stonehearth-Look. Zusätzliches Rauschen gezielt und sparsam einsetzen.

### Vorlagen in use

Ein `use` darf eine **Modellvorlage** sein: Platzhalter `{name}` im Modellnamen werden beim Bauen durch den
Wert des gleichnamigen Parameters ersetzt. Optional `fallback` (eine ID oder eine Liste, ebenfalls mit Platzhaltern):
Es gewinnt der **erste Kandidat, den es gibt**.

```json
"params": {
  "bauweise": { "default": "test", "options": ["test", "germanen", "rom"] },
  "art": { "default": "station", "options": ["aussenposten", "station", "ruine", "schiff"] }
},
"ops": [
  { "name": "Füllung", "op": "use", "model": "kit/{bauweise}/{art}/wand_fuellung",
    "fallback": ["kit/{bauweise}/gemein/wand_fuellung", "kit/geruest/slot/wand_fuellung"],
    "params": { "zustand": "zustand", "len": "len", "art": "{art}" } }
]
```

- **Platzhalter müssen `options`-Parameter des Modells sein, das den Schritt enthält** (keine Zahlen, kein `let`,
  keine `repeat`-Variable). Sonst bricht schon das Laden mit einer Meldung ab.
- Beim Laden werden **alle Kombinationen** der `options` aufgelöst und geladen. Fehlende Dateien sind dabei kein
  Fehler (höchstens 1024 Kombinationen je Schritt).
- Beim Bauen fehlt für die gewählten Werte jeder Kandidat → Fehler mit Vorlage, Werten und allen versuchten IDs,
  z. B. `Vorlage "kit/{bauweise}/{art}/wand_fuellung" mit bauweise=rom, art=schiff: kein Modell vorhanden (versucht: …)`.
- **Parameter an Vorlagen:** Übergeben wird nur, was das gewählte Teil auch deklariert (`seed` immer). Ein
  Steckplatz-Teil darf also weniger Parameter haben als das Gerüst schickt. Tippfehler in Parameternamen fallen
  dadurch nicht auf; Prüfbogen ansehen.
- **`options`-Werte durchreichen:** `"art": "{art}"` gibt den eigenen Wert weiter (gilt in jedem `use`, nicht nur in
  Vorlagen). Ein String ohne Platzhalter an einen `options`-Parameter ist wie bisher ein fester Wert.
- `use` ohne Platzhalter und ohne `fallback` bleibt eine Pflicht-Abhängigkeit wie bisher.
- Werkzeug: `lib.templateGaps(id)` listet die Kombinationen, für die kein Kandidat existiert (für Prüfwerkzeuge).

### erode

Bauschritt für Verfall: trägt Voxel an freiliegenden Kanten ab, **deterministisch** (gleicher `seed` → gleiche Voxel).
Wirkt auf alles, was das Modell **bis zu diesem Schritt** gebaut hat (auch Teile aus `use`), also ans Ende stellen.

```json
{ "name": "Verfall", "op": "erode", "density": "zustand * 0.25", "depth": 2, "if": "zustand > 0" }
{ "name": "Krone bröckelt", "op": "erode", "density": 0.5, "depth": 3, "at": [0, 8, 0], "size": ["len", 4, 3], "salt": 2 }
```

| Feld | Bedeutung |
|---|---|
| `density` | 0–1, Anteil der Kandidaten, der wegfällt (Standard 0,3) |
| `depth` | 1–3 (bis 8): Durchgänge. Durchgang 1 trifft die Kanten, jeder weitere die freiliegenden Nachbarn der eben entfernten Voxel → Ausbrüche werden tiefer |
| `edges` | Standard `true`: nur Kanten und Ecken (an mindestens zwei Achsen frei). `false`: jede freie Fläche (löchrig) |
| `at`/`size` | optionaler Bereich wie bei `box` (lokal, `rot`/`group` gelten). Nur Voxel darin werden abgetragen, Nachbarn außerhalb zählen trotzdem |
| `ground` | Standard `true`: unter der untersten Schicht ist Boden → die Unterkante bröckelt nicht |
| `salt` | Zahl, damit zwei `erode`-Schritte im selben Modell nicht dieselben Stellen treffen |

- Zum Schluss fallen Voxel ohne jeden Nachbarn weg (keine schwebenden Krümel).
- **Anschlussnähte schützen:** Ein Kit-Teil, das mit `conn` an die Zellkante reicht, mit `at`/`size` nur innerhalb der
  Kante erodieren, sonst entstehen Lücken zum Nachbarteil.
- Ruß und Moos: danach ein Schritt mit `"mode": "paint"` und `{ "noise": [...] }` über den Bereich (färbt nur Vorhandenes).

### Paletten-adjust

Eine Palette mit `extends` kann die **geerbten** Rollen verändern, statt sie alle neu anzugeben:

```json
{ "id": "nord_verfallen", "extends": "nord",
  "adjust": { "sat": 0.6, "light": 0.85, "tint": "#556B2F", "mix": 0.15, "except": ["glow", "glow2"] } }
```

- Reihenfolge: Sättigung × `sat`, Helligkeit × `light` (beides HSL, auf 0–1 begrenzt), dann Mischung zur Farbe `tint`
  mit Anteil `mix` (`tint` ohne `mix` ist ein Fehler).
- `roles` (Liste) beschränkt auf diese Rollen, `except` nimmt Rollen aus. Unbekannte Rollennamen sind ein Fehler.
- Das Leuchten (`emit`) einer Rolle bleibt unverändert, nur die Farbe ändert sich. Leuchtrollen bei Bedarf mit `except` schützen.
- Rollen, die die Palette **selbst** unter `roles` angibt, werden **nicht** verändert (sie gelten genau so).
  Overrides aus Figur/Szene (`colors`) ebenfalls nicht.
- Vererbung stapelt: `extends` auf eine Palette mit `adjust` erbt die veränderten Farben.

### Ausdrücke in emit und Farbangaben

`emit` und die Zahlen in Farbangaben (`f`, `emit`, `weights`, `cell`, `seed`, `period`, `offset`, `width`) dürfen
Ausdrücke über die Parameter sein:

```json
{ "name": "Lauf", "op": "cyl", "color": "metal", "emit": "heat > 0 ? 0.3 + heat * 0.5 : 0", … }
{ "name": "Blech", "op": "box", "color": { "shade": "metal", "f": "1 + heat * 0.08" }, … }
{ "name": "Ader", "op": "line", "color": { "role": "glow", "emit": "0.6 + hash(seed, 3) * 0.6" }, … }
```

- **Ein gesetztes `emit` gilt immer, auch 0** (z. B. `heat` 0 → glow-Rolle leuchtet nicht). Ohne `emit` gilt das Leuchten der Rolle.
- Neue Funktion `hash(a, b, c, d)` (1–4 Argumente, werden abgerundet) → stabile Zufallszahl in [0, 1).
  Beispiel: `"if": "hash(seed, i) < 0.3"` in einer `repeat`-Reihe lässt ~30 % der Elemente weg.
- Die Ausdrücke werden **je Schritt** ausgewertet, nicht je Voxel (Zufall je Voxel weiter über `noise`).

## Figuren

**Rig** `human` (`assets/rigs/human.json`): ~31 Voxel hoch (1,94 m), Blick nach **+z**, links = **+x**.
Gelenke stehen dort mit **absoluten** Koordinaten (Füße bei y = 0):

| Gelenk | Position | Teil reicht von … bis |
|---|---|---|
| hips | (0,14,0) | y 13–16, x −4..3 |
| thighL / thighR | (±2,14,0) | y 7–14 |
| shinL / shinR | (±2,7,0) | y 0–7 inkl. Fuß (Fußspitze bis z ≈ +3) |
| torso | (0,16,0) | y 16–25, Schulterbreite 8–10, Tiefe z −2..2 |
| head | (0,25,0) | y 25–31, ca. 6×6×6, Gesicht bei z = +2/+3 |
| upperArmL / R | (±5.5,23,0) | y 17–23, 3 breit (links x 4..6) |
| lowerArmL / R | (±5.5,17,0) | y 12–17 inkl. Hand |
| handL / handR | (±5.5,12,0.5) | Anbaupunkt für Waffen/Werkzeug |
| back | (0,20,−3) | Anbaupunkt Rücken |

**Teile werden in Figur-Koordinaten modelliert** (genau dort, wo sie im Stehen sind) mit `"anchor": [0,0,0]`.
Die Engine verschiebt sie selbst an ihr Gelenk. Linke Teile modellieren, rechte per `"mirror": true` in der
Figur spiegeln (Spiegelebene x = 0). Die Mitte liegt zwischen den Voxeln −1 und 0: Rumpf 8 breit = x −4..3.

Proportionen: **gestreckt und ernsthaft**, keine Chibi-Köpfe. Kopf ~6 Voxel (mit Helm 7–8).

Figur (`assets/figures/<ordner>/<name>.json`):

```json
{
  "id": "rom/legionaer",
  "name": "Legionär (Sci-Fi)",
  "rig": "human",
  "palette": "rom",
  "params": { },
  "parts": {
    "hips": { "model": "fig/rom/legionaer_hips" },
    "upperArmL": { "model": "fig/rom/legionaer_upperarm" },
    "upperArmR": { "model": "fig/rom/legionaer_upperarm", "mirror": true }
  },
  "attach": { "handR": { "model": "fig/rom/pilum" }, "handL": { "model": "fig/rom/scutum", "rot": [0, 0, 0] } }
}
```

- `params` der Figur gehen an jedes Teil, **das diesen Parameter deklariert** (gemeinsame Schalter, z. B. Rang).
  Zusätzlich kann jedes Teil eigene `params` haben.
- `colors` (Rolle → Farbe/Rolle) färbt die ganze Figur um, z. B. Crew-Akzentfarben. In Szenen auch pro Figur.

**Anbauten** (Waffen, Werkzeuge, Schilde): normales Detail-Modell mit **Anker = Griffpunkt**.
Konvention: **entlang der Armachse modellieren** – die Mündung/Klinge zeigt nach **−y** (unten), die Oberseite
der Waffe nach **+z**. So hängt die Waffe in Ruhe am Arm herab und zielt mit, wenn der Arm sich hebt.
Stangenwaffen (Pilum, Standarte) verlaufen entlang **y** (senkrecht, Griff am Anker). Schilde: Vorderseite nach −x
(links gehalten nach außen) oder per `rot` drehen.

**Posen** (`assets/poses/human.json`): Winkel in Grad je Gelenk `[x, y, z]`. x negativ = Glied nach vorn heben,
z positiv hebt den linken Arm seitlich. `lift` senkt/hebt die Hüfte (Voxel), `breathe` 0–1, `look: false` = Kopf still.
Vorhandene Posen: stand, attention, guard (Pilum senkrecht), aim, walk, talk, point, kneel, inspect, arms_crossed.

**Figur-Felder zusätzlich:** `scale` (Zahl, Standard 1) skaliert die ganze Figur; `figureObject(lib, id, { params })`
überschreibt `params` der Figur (z. B. `rank`, `role`), Teil-`params` gehen weiterhin vor.

## Figurenbaukasten (Rolle × Fraktion)

Gegnerfiguren werden **nicht von Hand** als Figur-JSON geschrieben, sondern aus zwei Datenarten erzeugt:
**Rolle = Silhouette** (fraktionsneutral), **Fraktion = Teile + Palette**. Jede Rolle passt zu jeder Fraktion.

```
assets/baukasten/fraktionen/<f>.json     Teile, Palette, Kopfvarianten, Mantel, Waffen-Bauweise
assets/baukasten/rollen/<rolle>.json     eine Datei je Rolle (Teams arbeiten parallel)
assets/models/fig/<f>/**                 Fraktionsteile (Rumpf, Kopf, Helme, Fellumhang …)
assets/models/fig/rolle/<rolle>/**       Rollenteile, fraktionsneutral mit Palettenrollen
assets/figures/fig/<f>/<rolle>.json      ERZEUGT ("generated": true) – nie von Hand bearbeiten
```

Erzeugen: `node tools/gen-figuren.mjs [--fraktion germanen] [--rolle niederhalter] [--check]`.
Ohne Filter entstehen alle Kombinationen; erzeugte Dateien ohne Quelle werden gelöscht (nur `"generated": true`).
`--check` schreibt nichts und meldet fehlende/veraltete Dateien (Exit 1). Gleiche Eingaben ergeben byte-gleiche
Dateien. Danach wie immer `npm run check -- fig/<f>`. Rollen-IDs sind neutral: `grundtyp`, `niederhalter`,
`grenadier`, `schuetze`, `enterer`, `haescher`, `waechter`; Anzeigenamen kommen aus dem Spiel-Lexikon.

**Fraktion:**

```json
{
  "id": "germanen", "name": "Germanen", "rig": "human", "palette": "nord",
  "params": { "rank": 0 },
  "teile": {
    "hips": "fig/germanen/huefte", "torso": "fig/germanen/rumpf", "head": "fig/germanen/kopf",
    "upperArm": "fig/germanen/oberarm", "lowerArm": "fig/germanen/unterarm",
    "thigh": "fig/germanen/oberschenkel", "shin": "fig/germanen/unterschenkel"
  },
  "kopf_varianten": { "helm_a": "fig/germanen/helm_a", "helm_b": "fig/germanen/helm_b" },
  "mantel": "fig/germanen/fellumhang",
  "waffen_bauweise": "germanen"
}
```

- `teile`: alle sieben Gattungen Pflicht. Wert = Modell-ID oder `{ "model", "params", "palette" }`.
  Arme und Beine **links** modellieren; der Generator setzt rechts dasselbe Teil mit `"mirror": true`.
- `kopf_varianten`: benannte Köpfe; eine Rolle wählt per `"kopf": "<name>"`. Fehlt die Variante → Standardkopf + Warnung.
- `mantel` (optional): Umhang für Rollen mit `"mantel": true`, hängt am Gelenk `back`, `anchor` = `[0, 20, -3]`.
- `params`/`colors` (optional): Figur-Defaults, die Rolle kann sie ergänzen.

**Rolle:**

```json
{
  "id": "niederhalter", "name": "Niederhalter",
  "groesse": 1.0,
  "kopf": "helm_b",
  "ersetzt": { "upperArmL": "fig/rolle/niederhalter/schulter_gross" },
  "aufsatz": { "back": "fig/rolle/niederhalter/munitionskasten" },
  "waffe": "sturmgewehr", "waffe_platzhalter": "lerche/item/scav_rifle",
  "pose_ruhe": "guard", "pose_ziel": "aim_heavy",
  "mantel": false
}
```

| Feld | Bedeutung |
|---|---|
| `groesse` | Skalierung der ganzen Figur (0,5–1,5), z. B. Enterer 1.1 → Figur-Feld `scale` |
| `ersetzt` | Gelenk-Teile ersetzen. Schlüssel = Gattung (`upperArm` = beide Seiten) oder einzelnes Gelenk (`upperArmL`). Ein Teil an `…R` wird immer gespiegelt, also links modellieren. `null` = Teil weglassen |
| `aufsatz` | `back` (Gelenk `back`, anchor `[0,20,-3]`), `head_top` (Gelenk `head`, anchor `[0,25,0]`), `shoulder` (Gelenk `torso`, anchor `[0,16,0]`). In Figur-Koordinaten modellieren, `anchor` = Gelenkposition – dann sitzt der Aufsatz genau dort, wo er modelliert ist |
| `waffe` | Waffentyp → `item/waffe/<typ>` in `handR`, mit `bauweise` = `waffen_bauweise` der Fraktion (wenn das Modell den Parameter hat). Gibt es das Modell noch nicht, wird `waffe_platzhalter` genommen (Figur-Feld `waffe.platzhalter: true`); nach Lieferung neu erzeugen genügt |
| `pose_ruhe`, `pose_ziel` | Posen-Namen für das Spiel (Figur-Feld `posen`); fehlende Posen nur Warnung |
| `mantel` | `true` → `mantel` der Fraktion an `back`. Nicht zusammen mit `aufsatz.back` |
| `kopf` | Name aus `kopf_varianten` der Fraktion |
| `fraktionen` | optional: nur für diese Fraktionen erzeugen (Testrollen) |
| `params`, `colors` | optional, ergänzen die der Fraktion |

Rollenteile sind **fraktionsneutral**: nur Palettenrollen (`cloth`, `metal`, `trim` …), keine festen Farben, damit die
Palette der Fraktion (und die Besitz-Palette des Spiels per `palette`-Override) greift. Probe: Fraktion `test`
(Teile aus `fig/basis/*`) mit den Rollen `test_breit` und `test_gross`.

## Spielerfigur aus Schichten (cha/)

Die Spielerfigur `cha/spieler` besteht je Gelenk aus **Schichten** (Körper, Hose, Schuhe, Oberteil, …), die aus
Bestandsteilen (`fig/**`, unverändert) zusammengesetzt werden. Das Spiel wählt je **Platz** ein Teil; Haut und Haar
färbt die Figur. **Nicht von Hand bearbeiten:** `assets/models/cha/**`, `assets/palettes/cha.json`,
`assets/figures/cha/spieler.json` und `assets/katalog/charakter.json` erzeugt `node tools/gen-cha.mjs` (wiederholbar, `--check` vergleicht nur).

**Plätze** (Figur-`params`, ein Wert je Platz; Teile-ID `<platz>/<name>`; **Katalog Version 2**, CHA-02): `koerper` (`standard`),
`frisur` (`kurz`), `kopf` (`keine`), `oberteil` (`bordtunika`), `hose` (`bordhose`),
`schuhe` (`bordstiefel`), `haende` (`keine`), `umhang` (`keiner`). `keine`/`keiner` sind gültige Werte ohne Datei (Fallback `cha/leer`).
Die Plätze `gesicht` und `bart` der Version 1 gibt es nicht mehr: das **Gesicht ist fest** (steckt im Körper-Kopf), ein Bart gehört künftig in die Frisur.
Teile heute (Katalog Version 2, 35 Teile): frisur acht Frisuren, **vier römische** (`kurz` Kurzschnitt, `stirnband`, `welle`, `offen`; CHA-02 B1) und **vier germanische** mit Bart in der Frisur (`bartkurz`, `bartlang`, `zopfband`, `wild`; B2), dazu `keine` (Kahl-Modell);
kopf (Kopfbedeckung, offen, nie geschlossen) `bordhelm`, `galea`, `spangenhelm`, `hoernerhelm` (Pileus und Crista nur als Teil eines Helms); oberteil `bordtunika`, `plankenweste`, `lorica` (Richtung A, Schulterpanzer am Gelenk `torso`), `robe`, `einsatzanzug`;
hose `bordhose`, `germanenhose`, `anzughose`; schuhe `bordstiefel`, `germanenstiefel`, `einsatzstiefel`, `ocreae`; haende `armschiene`, `einsatzhandschuh`; umhang `fellumhang`, `sagum` (Bilder der Frisuren: `node tools/cha-frisurbild.mjs <Ordner>`).
Jeder Platz kennt zusätzlich den leeren Wert (`keine`/`keiner`). Jede Frisur ist für jede Figur wählbar, es gibt keine Körper-Zuordnung. Das Standard-Outfit ist **voxelgleich** zu `lerche/crew_0` (ohne Spielerfarbe) **außer dem Kopf**; die sechs alten Uniformen sind aus Katalogteilen zusammenstellbar (siehe D1 unten). Das Standard-Outfit ist **voxelgleich** zu `lerche/crew_0` (ohne Spielerfarbe) **außer dem Kopf**.

**Der 8er-Kopf** (CHA-02 A1, Quelle: Entwurf FIG-01 Richtung A): Teil `cha/koerper/standard/head` (Boxen in `KOPF_8`, `tools/gen-cha.mjs`): Schädel 8×7×8
(x −4..3, y 26..32, z −4..3), Hals 4×4 bei y 25 (gehört zum Kopfteil), festes Gesicht bei z = 3 (Augen 1×2, Mund, Wangen), nur Rollen `skin`/`skin_shadow`
(Hautton aus der Figur, 6 Töne im Katalog) und feste Augenfarbe, `jitter: false` auf Hals und Schädel. Regel (e) `pruefeKopf` (`tools/cha-lib.mjs`) hält das Maß fest.
Der Rig `human` bleibt unverändert; sein Kopfbereich (y bis 30, z ab −3) stammt vom Bestandskopf, deshalb gelten für Körper-Kopf und Frisur zusätzliche Toleranzen in
`CHA_TOLERANZEN` (`toleranzenVon(rig)` in `tools/cha-lib.mjs`, je Wert das Maximum aus Rig und Zusatz). Haarfarbe: 8 Werte, Hautton: 6 (`HAAR`, `HAUT`).

**Schichtfolge** = Reihenfolge der `use`-Schritte im Sammelmodell `cha/joint/<gattung>`
(Gattungen `hips torso head upperArm lowerArm thigh shin`): Körper → Hose → Schuhe → Oberteil → Handschuhe → Umhang;
am Kopf Körper (mit Gesicht) → Frisur → Kopfbedeckung.
Die Frisur liegt in einem eigenen Gitter (`cha/frisur_maskiert/head`), das eine Haarmaske der Kopfbedeckung
(`cha/kopf/<name>/head_maske`, `mode: carve`) trifft, ohne den Schädel zu löschen: beim Bordhelm schneidet sie das Schalenvolumen und
das Haar hinter, über und unter der Schale (auch außerhalb der Schale: Seiten x -5 und 4, Nacken, Ohrring; Frisuren mit langen Teilen brauchen die Zusatztoleranz in `CHA_TOLERANZEN`, x ±1). Der 8er-Kopf hat keine Ohren, eine Ohrschablone gibt es nicht mehr. Kopfmaß: 8 breit (x −4..3).

**Schicht** = Modell `cha/<platz>/<teil>/<gattung>` mit `"anchor": [0,0,0]`: ein `use` auf das Bestandsteil, `colors` legt dessen
Rollen auf **Platzrollen** um (`top_plankenweste`, `hose_bordhose`, `schuh_bordstiefel` … in Palette `cha`), danach `carve`-Boxen, falls das Teil Körper
und Kleidung mischt. Herausgelöste Ops stehen in `…/<gattung>_ops`. Beachten:
- `paint` wirkt nur im eigenen Gitter: Schichten ohne Untergrund (Brauen, Narbe) brauchen `add`.
- `carve` am `use` löscht im ganzen Gitter der Schicht, also nur auf dem Haar-Gitter maskieren.
- Teilmodelle werden mit der Palette des Elternteils gebaut, daher **jede** vom Teil benutzte Rolle umlegen (Lecktest in `tools/test-cha.mjs`).
- Anbaupunkt-Teile (`fellumhang`, Anker [0,20,−3]) brauchen im `use` `"at"` = Anker des Bestandsteils.

**Farbrollen-Regeln:** Outfit-Farben wählt der Spieler nicht: **jedes Teil behält seine eigenen Bestandsfarben**. Dafür bekommt jede
Platzrolle den Teilnamen als Suffix (`<rolle>_<teil>`, der Generator setzt ihn selbst); zwei Teile teilen nie eine Rolle, also kollidieren
verschiedene Werte nicht (Bordtunika-Purpur gegen Plankenweste-Eisengrau). Der Standardwert einer Rolle kommt aus der Bestandspalette des Teils.
`skin`, `skin_shadow`, `hair` setzt **nur** die Figur (`colors`); ein `use` unter `cha/` legt sie nie um
und ersetzt nie die Palette. Einzige Ausnahme `PINNEN` in `tools/cha-lib.mjs`: der Fellumhang nagelt `hair` auf einen festen Wert, weil das
Bestandsteil Fellflecken mit `hair` färbt und die Haarfarbe des Spielers sonst den Umhang färbte (Test: `hair` ändert nur den Kopf). **Keine Spielerfarbe** (`cloth`, `cloth2`, `primary`, `secondary`, `spieler`) in einer Kleidungsrolle:
was Bestandsteile als Spielerfarbe tragen, bekommt in `cha` eine feste Teilfarbe. Die Rolle `spieler` ist für die Namensmarke reserviert.

**Teil ergänzen:** in `tools/gen-cha.mjs` einen Eintrag in `TEILE` anlegen (Platz, Name, Bestandspalette, je Gattung `quelle`
oder `ops` (eigene Boxen `{ eigene: [...] }` oder herausgelöst), `farben`, optional `params`/`decl`/`schnitte`/`at`), bei neuem Namen steht er automatisch in den `options` der Sammelmodelle.
`ops` löst Ops aus Bestandsteilen heraus (`namen`, `ohneBedingung`, `ohneNamen`, `paintZuAdd`, `breit`, mehrere Quellen als Liste), `schichten` setzt
mehrere herausgelöste Teilmodelle der Reihe nach ein (Bart: Deckschicht per `use mode: paint`, Bartzopf als eigene Schicht), `zusatz` legt
weitere Modelle wie die Hutmaske an, `danach` hängt Boxen an (Kettenhalter des Fellumhangs), `anzeige`/`volk` füllen den Katalog.
Haut- und Haarfarben (`HAUT`, `HAAR`, Index 0 = Standard) und Plätze stehen oben im Generator.
Dann `node tools/gen-cha.mjs`, `npm run check`, `npm test`. Bilder: `node tools/cha-bilder.mjs [Präfix]` (Node-Renderer, nach `shots/cha01/`). Gelenkbereiche (`bereiche`) und Toleranzen je Platz und Gattung
(`toleranzen`) stehen in `assets/rigs/human.json` (plus `CHA_TOLERANZEN` für den 8er-Kopf); `npm run check` meldet Schichten außerhalb von Bereich + Toleranz.

**Anprobe im Editor:** Ist eine Figur mit Katalog geöffnet (`http://localhost:3412/editor/?figure=cha/spieler`, Server mit `npm start`, anderer Port: `PORT=… node server.js`),
zeigt die Seitenleiste den Bereich „Anprobe“: je Platz eine Auswahlliste (Werte und Anzeigenamen aus `assets/katalog/charakter.json`, gruppiert Charakter/Outfit),
Hautton und Haarfarbe als Farbfelder (6 bzw. 8 aus `farben`), „Zufall“ und „Standard“. Jede Änderung baut die Figur sofort neu (Kamera bleibt), die Pose lässt sich weiter wählen.
Der Zustand steht in der URL, nur Abweichungen vom Standard: `?figure=cha/spieler&pose=sit&p.kopf=bordhelm&p.frisur=offen&haut=2&haar=3` (`p.<platz>=<teil>`, `haut`/`haar` = Farbindex).
Für Bilder `&anim=0` (Pose anhalten) und `&t=<Sekunden>` (Zeitpunkt, z. B. `walk` bei `t=0.25`) anhängen. Der Katalog kommt als statische Datei vom Server (kein eigener Endpunkt nötig).
Der Editor lädt für leere Werte (`keine`, `keiner`) Modelle, die es nicht gibt, und meldet dafür 404 in der Konsole; die Figur baut trotzdem (Fallback `cha/leer`).

**Vorschaubilder je Teil:** `node tools/gen-cha-vorschau.mjs` schreibt zu jedem Katalog-Teil (auch `keine`/`keiner`) ein Bild nach `assets/sprites/cha/vorschau/<platz>/<name>.png`
(**eingecheckt**, 140 × 124 px transparent = doppelte Bildfläche der Spielkachel 70 × 62; zusammen unter 40 KB). Standardfigur mit genau diesem Teil, Node-Renderer, feste Kamera:
Kopf-Plätze (Frisur, Kopfbedeckung) Kopf ¾ von vorn, Oberteil Rumpf, Hose Hüfte bis Knie, Schuhe Unterschenkel, Handschuhe linker Unterarm, Umhang von hinten.
Ausschnitt und Blick je Platz stehen in `FENSTER` (`tools/cha-ansicht.mjs`). `--check` erzeugt im Speicher und vergleicht die Bildpunkte (nicht die Dateibytes) mit den Dateien und meldet veraltete, fehlende
und überzählige Bilder (Exit 1); `node tools/gen-cha-vorschau.mjs kopf/bordhelm` erneuert nur ein Teil. Das Katalogfeld `vorschau` (Pfad relativ zu `assets/sprites/`) setzt `gen-cha.mjs`.
**Reihenfolge nach jeder Änderung an Teilen:** `node tools/gen-cha.mjs`, `node tools/gen-cha-vorschau.mjs`, `npm test`. Die Bilder stehen nicht im `manifest.json` (`npm run sprites`, das beschreibt nur Schiffs-Drehsprites).
**Porträt:** `portraet(lib, katalog, karte, { bg })` in `tools/cha-ansicht.mjs` rendert aus einer Charakterkarte (Charakterplätze, `haut`, `haar`, `outfit`) den Kopf in Nahansicht, 260 × 260 px (Referenz für die Live-Porträts des Spiels);
`node tools/cha-bilder.mjs a4` schreibt vier Beispiele nach `shots/cha01/a4-portraet-<n>.png` (nicht im Git).

**Prüfregeln** (`tools/cha-lib.mjs`, in `npm run check`, Mutationsprobe in `tools/test-cha.mjs`): jedes Modell und jedes eingesetzte Teil
unter `cha/` hat `anchor` (ungleich [0,0,0] nur mit passendem `at`); kein `colors`/`palette` am `use`, das `skin`/`skin_shadow`/`hair` setzt;
`cha/spieler` baut mit Standardwerten und mit jedem Einzelwert; Schichten liegen im Gelenkbereich; der **Katalog** `assets/katalog/charakter.json`
(vom Generator erzeugt, Format laut Schnittstelle Voxelwerk ↔ Spiel) ist konsistent: jede Katalog-ID hat ein Modell (außer `keine`/`keiner`),
jede `options`-Ausprägung der Figur steht im Katalog und umgekehrt, Platz, Gruppe, Reihenfolge und Farben (6 Hauttöne, 8 Haarfarben,
Index 0 = Figurfarben) stimmen; Version 2: kein Platz `gesicht` oder `bart` in Katalog, Teilen und Figur-`params`. Dazu die **Kopfregel** (nackter Kopf 8 breit, 7 hoch, 8 tief, Hals bei y 25).

**Passprobe** (`pruefePassung` in `tools/cha-lib.mjs`, Posen in `tools/cha-pose.mjs`, Abschnitt „Spielerfigur aus Schichten“ in `npm run check`, ca. 4 bis 5 s für alle 48 600 Kombinationen, unter Last bis rund 30 s; die Grenze im Test ist 90 s):
baut **jede Teilekombination** (Produkt der `options` aller Plätze, heute **48 600** = 9 Frisuren × 5 Kopfbedeckungen × 6 Oberteile × 3 Handschuhe × 4 Hosen × 5 Schuhe × 3 Umhänge, der Körper hat nur einen Wert) und prüft sie in den Posen stand, walk (Extreme des `cycle`: φ = 0, ¼, ½, ¾),
aim, aim_rifle, aim_heavy, kneel, sit, crouch. Posen werden in Node ohne three.js angewendet (Gelenkhierarchie des Rigs, Euler YXZ, `lift`, Atmen/Blick
bei t = 0 null); der Test gleicht jede Voxelecke gegen `applyPose` aus `render/voxel-three.js` ab. Die Spielerfigur bringt keine eigenen Posen mit,
Quelle ist `assets/poses/human.json`; die Ersatzposen des Spiels (`actors.js`, `FALLBACK_POSES`) gelten nur, wenn eine Figur keine hat.
Geprüft wird je Kombination:
1. **Bau**: wirft das Bauen oder ist die Figur leer → rot.
2. **Gelenkbereich** (vor der Pose): kein Voxel eines Gelenks außerhalb von `bereiche` + den Toleranzen der getragenen Teile (Toleranz je Platz und
   Gattung, leere Werte tragen keine). Rechte Gelenke spiegeln die Toleranz in x.
3. **Haar am Helm**: wird eine Kopfbedeckung getragen, darf kein sichtbares Haarvoxel (Voxel mit freier Seite, Haare in Marker-Grün gebaut)
   außerhalb der Gesichtsöffnung (`OEFFNUNG`: x −3..2, y 26..30, z ≥ 3) liegen.
4. **Durchdringung in Pose**: je Posenzustand und Gelenkpaar (55 Paare) zählt die Probe die Voxel beider Gelenke, deren Mitte einem Voxel des anderen
   Gelenks näher als 0,7 Voxel kommt **und die das in der Ruhepose nicht tun** (die Ruhe-Überlappung der Teile prüft `test-cha.mjs`).
   Rot, wenn die Zahl über der **Schwelle des Paares** liegt: dem größten Wert, den dasselbe Paar (links/rechts gespiegelt zusammengefasst)
   an den Bestandsfiguren `lerche/crew_0`, `fig/germanen/grundtyp` (mit Fellumhang) und `rom/legionaer` (Armschiene) in irgendeiner dieser Posen zeigt. Ein Paar,
   das im Bestand nie kollidiert (z. B. Kopf/Oberschenkel), hat die Schwelle 0.

**Treffer lesen:** `✗ <Kombination>: Pose sit, hips/thighL: 52 Voxel durchdringen sich (Schwelle 47, Bestand in dieser Pose 46) [288 Wertekombinationen]`.
Die Kombination ist der erste Fund (Werte in Platz-Reihenfolge `koerper/frisur/kopf/oberteil/hose/schuhe/haende/umhang`), die Klammer
sagt, bei wie vielen Wertekombinationen der am Paar beteiligten Plätze derselbe Befund auftritt. Gelenk und Pose nennen den Ort; die Zahl ist die Zahl der Treffer-Voxel.
Zum Prüfen das genannte Teil (bei Bereichsfehlern die Schicht des Plätze-Werts am Gelenk, bei Haar die Hutmaske `…/head_maske`, bei Durchdringung die
Platz-Werte des Paares) allein einsetzen und in der Pose ansehen (`tools/cha-bilder.mjs`). Unter dem Strich zeigt `npm run check` je Pose den größten Messwert mit Schwelle
und Bestandswert dieser Pose; Werte über dem Bestandswert der Pose, aber unter der Paarschwelle, stehen als Hinweis darunter (heute: Fellumhang über der Bordtunika, Hüfte/Rumpf in aim-Posen).
Grenzen: Die Schwelle ist eine Obergrenze („nichts Schlimmeres als heute“), kein Schönheitsurteil; Haar prüft nur den Helm; Gegenstände in der Hand und Atmen/Blick fließen nicht ein.

**CHA-02 D1 (Recycling, alte Uniformen):** Robe, Einsatzanzug, Anzughose, Einsatzstiefel, Ocreae, Einsatzhandschuh und Sagum sind aus Bestandsteilen herausgelöst (`ops` mit `ohneNamen`/`namen`/`paintZuAdd`, siehe `tools/gen-cha.mjs`).
Die sechs alten Uniformen (`lerche/crew_0` bis `_2`, `crew/nova|juno|tami`) sind aus Katalogteilen voxelidentisch zusammenstellbar (alle Gelenke außer `head`, Test „CHA-02 D1“; Bestand und Katalog Voxel für Voxel in Position und Farbe).
Einzige Abweichung: Der Rollen-Akzent der Einsatzuniform (Bestand: `primary` = Spielerfarbe) steht im Katalog fest auf Crew-Rot `#B3342B` (Rollen `akzent_einsatzanzug`, `akzent_anzughose`); der Test setzt sie auf die Bestandsfarbe.
Aufteilung am Unterschenkel: **Schuhe reichen bis y 5, Hosen beginnen bei y 6** (Bordstiefel, Germanenstiefel mit eigener Gamasche, Einsatzstiefel, Ocreae); die Anzughose schneidet ihr Schienbein bei y 0..4 ab.
Die Passprobe baut jedes Gelenk je Schlüssel (Werte der Plätze seines Sammelmodells) nur einmal (48 600 Kombinationen in rund 4 s) und kennt `ausnahmen` (`PASS_AUSNAHMEN_D1`): Für Kombinationen mit Robe (Ivos Gewand) und Einsatzanzug (Tornister) gilt für die Paare und Posen in `paare` die Bestandsschwelle der Herkunftsfigur plus 10 Voxel (robe: 20 Paar-Pose-Einträge in 8 Posen, einsatzanzug: `head|torso` in crouch). Die Liste ist gemessen, nicht geschätzt: `tools/test-cha.mjs` läuft jedes Oberteil einzeln ohne Ausnahmen durch, verlangt, dass nur Robe und Einsatzanzug Befunde haben, dass die Befunde genau die gelisteten Paare und Posen sind, und dass ein Haarteil, das mit der Robe in ein anderes Paar eindringt, rot bleibt (Mutationsprobe). `nur` beschränkt die Kombinationen (Mutationsproben).
**Toleranzen:** Gelenkbereich plus Toleranzen je Platz und Gattung (`toleranzen` im Rig, dazu `CHA_TOLERANZEN`/`CHA_TOLERANZEN_D1` in `tools/cha-lib.mjs` für den 8er-Kopf und die recycelten Teile); die Schulterpanzer-Toleranz der Lorica (`oberteil.torso` in `CHA_TOLERANZEN`, ±6 in x) ist eine offene Kai-Entscheidung.
`node tools/cha-mess.mjs cha/ --teile` zeigt die Dreiecke je Teil gegenüber dem leeren Wert (Grenze je Oberteil +1500) und den Worst Case der Spielerfigur ohne Waffe.
**Budget (CHA-02, Kriterium 9; feste Prüfung in `npm run check` und `npm test`, `pruefeBudget` und `BUDGET` in `tools/cha-lib.mjs`):** Spielerfigur im Worst Case (je Platz das Teil mit den meisten Dreiecken, auch mit Lorica) **plus größte Waffe** (`item/waffe/**`, heute `lanze`, 836) höchstens 10 000 Dreiecke (gemessen 5 814); jede andere Figur (Gegner, NSC, Crew, Bestand) samt Anbauten (Waffe, Helm) höchstens 10 000 (gemessen höchstens 6 284); Bauzeit je Figur (Bau und Vernetzung kalt, Median aus drei Läufen) höchstens 200 ms (gemessen höchstens 15 ms) und, deterministisch, höchstens 4 000 Voxel je Figur; Bildsumme im ungünstigsten Fall (4 Spieler plus die teuersten Gegner bis 32 sichtbare Figuren) höchstens 300 000 Dreiecke (heute 199 208). Die Bildsumme prüft nur die Rechnung aus den Messwerten; eine Laufzeitbremse im Spiel (Figurenzahl) gibt es dort nicht. Mutationsproben in `tools/test-cha.mjs` (Schwellen gesenkt, Waffe, Gegnerkopf und Spielerkopf aufgebläht → rot). Die frühere Bremse „`mess:kaltbau` +20 %“ entfällt (misst die Figuren nicht).

## Stimmungen (`assets/moods`)

`planet_day`, `planet_dusk`, `ship_interior`, `precursor_neon`. Felder: `background`, `fog` {color, near, far (× Szenenradius)},
`hemi` {sky, ground, intensity}, `sun` {color, intensity, dir}, `points` [{at, color, intensity, distance}], `exposure`, `bloom`.

## Biom-Paletten (`biom_*`, VOX-02)

Ein **Biom** ist eine zweite Achse neben der Kultur: `biom_wueste`, `biom_wiesenwald`, `biom_vulkan` (Paletten in
`assets/palettes`, Stimmungen gleichen Namens in `assets/moods`, Mittagslicht). Sie beschreiben nur das **Gelände**.

**Regel: Ein Biom setzt nur Geländerollen.** Es erbt von **`base`** (nie von `rom`, `sommer_wald` oder einem Volk), hat kein
`adjust` und setzt nur: `grass*`, `soil*`, `sand`, `plant*`, `flower*`, `rock*`, `stone*`, `wood*` (Natur), `teppich`, `fluid`,
`fluid_v`, `abgrund`. Sonst färbte die Wüste römische Mauern oder Figuren um. Kultur-Paletten bleiben unberührt (Gegenprobe
in `tools/test-biom.mjs`: Hash der aufgelösten Rollen aller anderen Paletten).

| Rolle | Bedeutung |
|---|---|
| `grass*`, `sand`, `soil` | Boden (die Fläche, auf der gespielt wird; `soil_dark` ist Füllung unter der Oberfläche) |
| `teppich` | Bodenton unter Sichtschleier-Kacheln (eine Stufe dunkler als der Boden) |
| `stone`, `stone_dark`, `stone_light` | Deckungssteine der Natur (halb/hoch), am Boden angeglichen |
| `rock`, `rock_dark` | Fels, Schlot, Baumstamm-Klasse: fest und hoch, die dunkelste Stufe |
| `plant*`, `flower*` | Bewuchs und Streublumen (`plant*` nie heller als der Boden, kein Leuchten; `flower*` sind Akzente und von der Helligkeitsregel ausgenommen, sie dürfen heller sein) |
| `fluid`, `fluid_v` | Wasser bzw. Lava und ihre Variation; **einzige** Rollen, die leuchten dürfen (Lava `emit`, Wasser nicht) |
| `abgrund` | Tiefe (unpassierbar, dunkler als Fels) |

**Wertleiter (Richtung A):** Biom = Farbton, Spielregel = Helligkeit. Gemessen wird die Helligkeit **L\*** (CIE, aus der
Relativ-Luminanz; Begründung im Kopf von `tools/biom-lib.mjs`), Schwellen in `SCHWELLEN` ebendort:

1. Boden mittelhell (L\* 42 bis 74), ruhig: die Bodenrollen (`grass`, `grass_dark`, `grass_light`, `sand`, `soil`) liegen höchstens **5** L\* auseinander (sonst Schachbrett aus Bodenvarianten).
2. Teppich **8** bis 14 dunkler als der dunkelste Boden.
3. Stein am Boden angeglichen (höchstens 10 vom mittleren Boden), **keine helle Kappe und kein heller Sockel**
   (`stone_light` höchstens 3 über dem hellsten Boden, `stone_light` minus `stone_dark` höchstens 14).
4. Fels und `rock_dark` mindestens 6 dunkler als Teppich und Stein (fest und hoch = dunkelste Stufe), `abgrund` noch dunkler, und `rock` mindestens **20** L\* über `abgrund` (in Graustufen sonst ein schwarzer Block).
5. Bewuchs (`plant*`, nicht `flower*`) nie heller als der dunkelste Boden plus 2.
6. Leuchten nur bei `fluid`: Lava leuchtet, Wasser nicht. Keine Glutrollen für Pflanzen.
7. Wasser (`fluid` ohne Leuchten) mindestens **8** L\* dunkler als der dunkelste Boden, damit es sich in Graustufen von Sand und Treibsand abhebt (gilt für Wüste und Wiesenwald; Lava ist ausgenommen).

Die Prüfung steht in `npm run check` (Abschnitt „Biome (Wertleiter)“), die Mutationsproben (absichtlich verletzte Paletten müssen
rot werden) in `tools/test-biom.mjs` (Teil von `npm test`). Neues Biom: Palette und Stimmung anlegen, `BIOME` in `tools/biom-lib.mjs`
ergänzen.

**Stimmungen der Biome:** Mittagslicht als Basis (Morgen und Abend kommen später), keine Nachtstimmung. Grenzen in `STIMMUNG`
(`tools/biom-lib.mjs`): Nebel nicht dichter als `planet_day` (kein milchiger Dunst), Sonnenfarbe fast neutral (HSV-Sättigung höchstens 0,22,
sonst wird die Asche braun), `exposure` 0,9 bis 1,1, Sonne 2,5 bis 3,6, `bloom.strength` höchstens 0,35.

## Biom-Props (`biom/…`, VOX-02 Paket 2)

Wildnis-Props und die gemeinsamen Rezepte unter `assets/models/biom/`. Alle Stufe `detail`, Footprint 1 × 1 m um den Pivot (Mitte unten), Tags beginnen mit `biom`.
Ein Prop darf die Kachel nie überragen (kein Voxel außerhalb ±0,5 m). Die **Spielregeln** (Kollision, Sicht, Deckung) legt das Spiel fest, das Rezept liefert nur Form und Maß.

| ID | Palette | Parameter | Maß | Dreiecke (gemessen, Budget) |
|---|---|---|---|---|
| `biom/wiese/strauch` | biom_wiesenwald | `seed` (Gestalt = seed % 3: Kuppel 1,25 m, hoch und schmal 1,5 m, zwei Hügel 1,25 m; höhere Seeds verschieben) | Sichtschleier ohne Kollision | 696 (800) |
| `biom/wiese/farn` | biom_wiesenwald | `seed` (Höhe, Länge, Auslassung der Wedel) | 0,8 bis 0,9 m, Sichtschleier ohne Kollision | 552 (600) |
| `biom/wiese/findling` | biom_wiesenwald | `hoch` 0/1, `seed` (Form = seed % 3) | halb 0,75 m, voll 2,06 m; Kollision ganze Kachel | halb 364 (500), voll 602 (900) |
| `biom/gemein/bewuchs` | **palettenunabhängig** | `form` 0 Gras, 1 Blumen, 2 Kiesel, 3 Flechte; `seed` | höchstens 0,19 m, über die ganze Kachel gestreut | 268 (300) |
| `biom/gemein/fluid` | **palettenunabhängig** | `art` 0 Wasser, 1 Lava, 2 Treibsand; `conn` 0–15; `diag` 0–15 (Standard 0); `seed` | Becken im Modell, Oberfläche 25 cm unter der Lauffläche | 376 (400) |

**Auflösung:** Dreieckbudgets (Strauch 800, Farn 600, Findling halb 500 / voll 900) verlangen grobe Blöcke. Das Netz zeichnet Flächen mit Eckverdunklung einzeln;
jede Stufe und jeder Knick kostet etwa 4 Dreiecke je Voxel Kantenlänge. Glatte Ellipsoide in 6 cm Auflösung kosten über 2000 Dreiecke je Strauch. Deshalb:
Strauch aus 25-cm-Blöcken (wie die Bäume, Block-Gitter mit `repeat` und der Vereinigung mehrerer Ellipsoide als `if`), Findling aus gestapelten Quadern, Farn aus Quadern.
Farbe je Block: `noise` mit `cell: 1000` und `seed` aus den Gittervariablen ergibt genau eine Zufallsfarbe je Block (die Blöcke liegen nie über Null).
Hinweis zu `if` und `let`: Bei einem Schritt mit `repeat` wird `if` **vor** dem `let` des Schritts ausgewertet. Variablen für `if` gehören in eine umgebende `group` (siehe Strauch).

**Biom-Palette an einem palettenunabhängigen Modell (der Weg für das Spiel):** Das Modell nennt nur Rollen, die jede `biom_*`-Palette selbst setzt
(`bewuchs`: plant*, flower*, grass_dark, stone, stone_dark, rock; `fluid`: fluid, fluid_v, grass_dark, soil, soil_dark). Welche Palette gilt, bestimmt der Aufrufer, nicht das Rezept:
- **Szene:** `place[].palette` (sonst `palette` der Szene), z. B. `{ "model": "biom/gemein/bewuchs", "palette": "biom_wueste", "params": { "form": 1 } }` (`core/scene.js`, `addPlacement`).
- **Bibliothek:** `lib.build("biom/gemein/fluid", { params: { art: 1, conn: 5 }, palette: "biom_vulkan" })` (`core/library.js`; die Standardpalette im Rezept, `biom_wiesenwald`, gilt nur ohne Angabe).
- **Teilmodell:** `use` mit `"palette": "biom_vulkan"`. Einzelne Rollen lassen sich über `colors` umlegen (z. B. Baumkronen eine Stufe dunkler als Sträucher: `{ "plant_light": "plant", "plant": "plant_dark" }`, Reihenfolge beachten).
Lava ist `art 1` mit `biom_vulkan` (dort leuchtet `fluid`), Wasser `art 0` mit Wiesenwald oder Wüste, Treibsand `art 2` (Wüste). Die Art ändert nur die Uferrollen und die Form; die Farbe kommt aus der Palette.

**Fluid-Kachel:** Anker = Lauffläche (y 0). Das Becken liegt im Modell: Körper von −1 m bis −0,25 m (Wasser, Lava), an Seiten **ohne** Nachbar gleicher Klasse eine Uferkante in zwei Stufen
(2 Voxel breit, Oberkante −6 cm und −19 cm; Wasser Gras- und Bodenton, Lava Boden und Boden dunkel), an Seiten **mit** Nachbar nahtlos (`conn` N1 O2 S4 W8 wie bei den Kit-Teilen).
Treibsand: 12,5 cm eingesunken, schräge Streifen (2 Voxel breit, Periode 8 Voxel in x und z, Boden- und Grasdunkelton), kein Ufer, `conn`, `diag` und `seed` ohne Wirkung; das Muster setzt sich über Kachelränder nahtlos fort (kein Ring um die Kachelmitte).
`diag` (optional, Bit je Ecke NO1 SO2 SW4 NW8: dort ist kein Fluid) schließt eine Innenecke, wo beide Nachbarn der Ecke Fluid sind und nur die Diagonale nicht: Außenpfosten und innerer Winkel der Uferstufen. Ohne `diag` ist die Kachel byteweise wie in Paket 2.
**Das Terrain unter der Kachel muss mindestens 1 m tiefer liegen** (Zelle `h − 1` oder tiefer), sonst verdeckt der Terrainwürfel das Becken; im Prüfbild steht die Zelle mit `h: 0` und das Modell bei `y: 1`.

**Prüfung:** `node tools/test-biom-props.mjs` (Teil von `npm test`, Regeln in `tools/biom-props-lib.mjs`): Footprint, Höhe und Dreiecke je Fall (alle Seeds, Varianten, Anschlüsse), Gestalten und Determinismus über `seed`,
Rollen und Bau mit allen drei Biom-Paletten, Fluid-Anschlüsse, Voxelhelligkeit der Steine gegen den Boden (kein Voxel heller als der hellste Boden plus 3 L*, keine helle Kappe, kein heller Sockel), Mutationsproben.
Prüfbilder: `node tools/shots.cjs --port <p> --out shots/vox02 --size 1920x1080 --gray "scene=biom-wiesenwald-props&cam=spiel"` (Spielkamera 57°, FOV 30°, Abstand 15,75 m; `--gray` schreibt zusätzlich `…_grau.png`).

### Wüste (VOX-02 Paket 3)

Rezepte unter `assets/models/biom/wueste/`, Palette `biom_wueste`, alle aus achsparallelen Quadern (schräge Linien kosten Dreiecke, ein freistehender Quader nur 12). Prüfung: `node tools/test-biom-props-wueste.mjs` (Teil von `npm test`), Prüfbilder `biom-wueste-props` und `biom-wueste-fluid`.

| ID | Parameter | Maß | Spielregel | Dreiecke (gemessen, Budget) |
|---|---|---|---|---|
| `biom/wueste/dornbusch` | `seed` (Gestalt = seed % 3: 0 Besen mit Kandelaberarmen, 1 Gestrüpp aus Zickzackarmen, 2 Schirm-Akazie; Längen und Höhe je Seed) | 1,06 bis 1,31 m | Sichtschleier: ohne Kollision, sperrt die Sicht, keine Deckung, Teppich darunter | 556 bis 786 je Seed (350 bis 800) |
| `biom/wueste/kaktus` | `seed` (0 zwei Arme, 1 dicker Stamm mit einem Arm, 2 schlanker Kandelaber) | 2,06 bis 2,19 m | fest und hoch (wie Baum): Kollision, Deckung, sperrt Sicht | 526 (700) |
| `biom/wueste/schichtstein` | `hoch` 0/1, `seed` (0 Schichtturm, 1 Pilzfels, 2 schiefer Stapel) | halb 0,75 m, voll 2,06 m | Kollision ganze Kachel, Deckung halb/voll | halb 496 (500), voll 850 (900) |

Dornbusch (Sichtschleier, liest nie als Festes): Stämme und Äste nur 1 Voxel stark (kein Klotz über 2 × 2), über 90 % Luft in der Hüllbox (Vorgabe mindestens 60 %), die Silhouette geht nach oben auf; Äste in `soil_dark` (heller als der Kaktus, dunkler als der Boden), dazu einzelne 1-Voxel-Dornen und Triebspitzen in `plant_dark` (trockenes Olivgrün), damit er als Pflanze liest. Keine `rock*`-Rolle (das ist die Stufe „fest und hoch“). Mindestens 350 Dreiecke je Seed, damit auch jeder Seed als Sichtblock lesbar bleibt.
Farbe: Wertleiter fest und hoch (Kaktus, Stein) am dunkelsten, der Dornbusch heller als das Feste und dunkler als der Boden (`soil_dark`, kein Fels). Der Kaktus nutzt `plant`/`plant_dark` (Rippen), nichts heller als der Boden, dunkler als jeder Stein (kein `flower`, keine Blüte). Der Schichtstein trägt Bänder aus `stone_dark` (unten), `stone` und `stone_light` (nur in der Mitte), die oberste Platte nie hell (keine helle Kappe, kein heller Sockel).
Der Treibsand ist ruhig: schräge Streifen (2 Voxel breit, Periode 8 Voxel in x und z: Streifen, wo (X + Z) mod 8 < 2), 3 L* Unterschied zum Sand, im Feld eine Fläche; die Oase ist Wasser (`art 0`) mit `biom_wueste`, Uferkanten in Sand- und Bodenton, `diag` an Innenecken. Palmen entfallen.

Fallen für die Spielseite (GEL-01):
- `deko.js` streut mit Versatz bis ±0,25 m, Bewuchs ist bis 0,94 m breit.
- `away.js` `floorOffset` senkt Assets unter 0,6 m Höhe mit `opts.floor` um ihre Höhe ab (Bewuchs mit 0,19 m würde im Boden verschwinden).
- Unter einer Fluid-Kachel darf keine Geländezelle auf Laufhöhe liegen.

### Vulkan (VOX-02 Paket 4)

Ordner `assets/models/biom/vulkan/`, Palette `biom_vulkan` (Asche grau, Fels fast schwarz, Lava als einzige Glut). Die Blumen (`flower`, `flower2`) der Vulkanpalette sind kühl und blass (Violett, Grau-Weiß), nie rot bis gelb: Glut gibt es nur in der Lava. Spielregeln legt das Spiel fest (Kai):

| ID | Parameter | Maß | Regeln (Spiel) | Dreiecke (gemessen, Budget) |
|---|---|---|---|---|
| `biom/vulkan/aschefarn` | `seed` (Höhen, Fiedern, Wedellängen, Verschiebung bis 1 Voxel) | 0,8 bis 1,0 m | Sichtschleier: keine Kollision, sperrt die Sicht, keine Deckung. Liest sich als Pflanze: acht dünne, eckige Wedel mit Fiedern in `plant*` (graustichiges Olivgrün), Lücken dazwischen; nie in Stein-/Felsrollen | 440 bis 564 je Seed (350 bis 600) |
| `biom/vulkan/basalt` | `hoch` 0/1, `seed` (Form = seed % 3: 0 neun Säulen mit hoher Mitte, 1 Treppe aus Platten, 2 zwei Säulen mit Stümpfen; Höhen je Seed) | halb 0,75 m, voll 2,06 m | Kollision ganze Kachel, Deckung | halb 416 (500), voll 642 (900) |
| `biom/vulkan/schlot` | `seed` (Form = seed % 3: 0 Kegel, 1 Terrassen, 2 versetzt mit Nebenkegel; Höhe, Versatz) | 1,63 bis 1,94 m, unter 1 × 1 m | fest, Deckung, sperrt die Sicht | 776 (800) |

- **Glut nur in der Lava** (Rolle `fluid`): Aschefarn, Basalt und Bewuchs leuchten nie (keine Glutflechten, keine Glutspitzen). Der Schlot leuchtet nur in seiner kleinen Mündung (höchstens 20 Voxel ganz oben, Farbe `fluid`), der Fels (`rock`, `rock_dark`) nie.
- **Wertleiter:** Der Schlot ist die dunkelste Stufe (jedes Fels-Voxel mindestens 6 L* dunkler als Teppich und Stein), Basalt (`stone*`) ist am Boden angeglichen ohne helle Kappe und ohne hellen Sockel, der Aschefarn liest sich als Pflanze (Buntheit **über** 0,08, graustichiges Olivgrün; von der Grauregel ausgenommen) und ist nie heller als der Boden plus 3 L*. Kein Rauch, Staub oder Dampf als Modell (kommt als Partikel).
- **Auflösung:** Das Netz fasst gleichfarbige ebene Flächen zusammen; teuer sind Stufen, Knicke und Rauschfarben je Voxel. Der Schlot besteht deshalb aus drei bis vier Quader-Schichten mit je einer Farbe (unten achteckig aus zwei gekreuzten Quadern, oben quadratisch), der Basalt aus Quadern mit einer Zufallsfarbe je Säule (`cell: 1000`), nicht aus Zylindern mit `noise` (2000 Dreiecke und mehr).
- **Lava prüfen:** `biom/gemein/fluid` mit `art: 1` und `palette: "biom_vulkan"` (Szene `biom-vulkan-fluid`: See mit Ufern, Einzelkachel); Terrain darunter `h: 0` bei `y: 1`.
- **Prüfung:** `node tools/test-biom-props-vulkan.mjs` (Teil von `npm test`, nutzt `tools/biom-props-lib.mjs`): Footprint, Höhe und Budget je Fall (64 Seeds, beide Höhen), Gestalten und Determinismus, Helligkeit und Grauwert, Leuchten nur in `fluid`, Mutationsproben. Prüfbilder: `node tools/shots.cjs --port <p> --out shots/vox02 --size 1920x1080 --gray "scene=biom-vulkan-props&cam=spiel"` und `scene=biom-vulkan-fluid`.

## Szenen (`assets/scenes`)

```json
{
  "id": "rom-aussenposten",
  "name": "Römischer Außenposten",
  "palette": "rom",
  "mood": "planet_day",
  "terrain": {
    "palette": "planet_mediterran", "depth": 3,
    "legend": { ".": { "h": 1, "top": "grass", "fill": "soil" }, "#": { "h": 1, "top": "paving" } },
    "rows": ["....##....", "..."],
    "heights": ["1111221111", "..."]
  },
  "place": [
    { "model": "rom/mauer", "at": [4, 10], "rot": 90, "params": { "len": 16 } },
    { "model": "rom/kiste", "at": [8.5, 12.25], "row": { "count": 3, "step": [0.9, 0], "vary": true } }
  ],
  "scatter": [ { "model": ["natur/gras", "natur/blume"], "on": ".", "density": 0.35, "perCell": 2 } ],
  "figures": [ { "figure": "rom/legionaer", "at": [9, 14], "rot": 180, "pose": "guard" } ],
  "lights": [ { "at": [9, 3, 14], "color": "#A8F0FF", "intensity": 4, "distance": 6 } ],
  "cameras": { "uebersicht": { "target": [16, 1, 12], "dist": 48, "elev": 42, "az": 35, "fov": 30 } }
}
```

- Positionen `at` = [x, z] in Metern. Die Höhe kommt vom Terrain (Oberkante der Zelle), `lift` hebt an, `y` setzt absolut.
- Terrain: Zeile = z, Spalte = x, 1 Zeichen = 1 m. `h` = Höhe der Oberkante, `top`/`sub`/`fill` = Farbangaben
  für oberstes Voxel, das darunter und den Rest.
- `scatter`: Kleinkram zufällig (stabil), nur auf Terrain-Zeichen aus `on`, nicht in `footprint`s.

## Qualität (bevor ein Asset als fertig gilt)

1. `npm run check` (oder `npm run check -- <filter>`) läuft ohne Fehler.
2. Screenshot ansehen: `node tools/shots.cjs --out shots/<team> model=<id>` (Server muss laufen,
   eigener Port: `PORT=34xx node server.js`, dann `--port 34xx`). Optional `&az=90&elev=10` für andere Blickwinkel.
3. Silhouette und Lesbarkeit prüfen: Erkennt man auf einen Blick, was es ist und dass es **römisch** ist?
4. Größe gegen die Maßstab-Säule (1,94 m, blau) prüfen.

## Stilregeln „Sci-Fi-Rom“

- **Römische Silhouette, futuristisches Material.** Bögen, Säulen, Giebel, Helmkämme, Lorica-Segmente,
  Scutum, Adler, Standarten – aber aus Keramikplatten (Marmorweiß), Gunmetal, rotem Lack, Goldkanten,
  mit Fugen, Paneelen und sparsamen Energielinien (glow).
- **Leuchten sparsam**: Akzente (Fugen, Status-LEDs, Lichtkanäle), nie ganze Flächen.
- **Ordnung**: gerade Achsen, Raster, Symmetrie (römische Kasernenordnung).
- **Detaildichte wie Stonehearth**: Nieten, Kanten, Griffe, Kabel, kleine Anbauten. Flächen ohne Struktur vermeiden,
  aber nicht alles verrauschen.
- **Eigene IP**: keine Logos realer Marken. „SPQR“-artige Inschriften sind gemeinfrei, aber bei 16 Voxel/m kaum lesbar –
  besser Ornament-Bänder.

## Bausatz-Gerüst (`kit/geruest`)

Kit-Teile für Bühnen werden nicht je Bauweise neu gebaut. Das **Gerüst** `kit/geruest/<kind>` legt Maße, Anschlüsse,
Türöffnung, Krone und Verfall fest; eine **Bauweise** füllt nur **Steckplätze**. Probebauweise mit Klötzchen:
`kit/test/**` (zeigt, dass alles ohne Kunst funktioniert). Kachelarten nach `CONTRACT-B1.md` §3.1.

**Parameter (alle Gerüst-Teile gleich):** `conn` 0–15 (Nachbar gleicher Klasse, N1 O2 S4 W8), `cut` 0/1
(geschnitten 1,25 m), `zustand` 0 intakt · 1 verfallen · 2 umkämpft, `art` (`aussenposten|station|ruine|schiff`),
`bauweise` (`neutral|test|germanen|rom|vorlaeufer|konkordat`; neue Bauweise = Wert hier ergänzen), `seed`. Dazu
`state` (Index in den Zuständen aus `kacheln.json`) bei `tuer`, `schott`, `tor`, `luke`, `wand_schwach`; `belag` 0–3
bei `boden`; `breite` 2–4 bei `tor`. **Türen/Tor haben kein `conn`** (2 Kacheln, Ausrichtung über `rot`): Aufrufer
reichen nur deklarierte Parameter durch (wie `lib.partParams`).

| kind | Grundfläche, Anker | Maße | Steckplätze |
|---|---|---|---|
| `wand` | 1×1, Mitte unten | 3 m / cut 1,25 m, Krone 25 cm | `wand_sockel`, `wand_fuellung` (je freie Seite), `wand_kante` (Außenecke), `wand_pfeiler` (Knoten: alles außer gerade Strecke 5/10), `wand_krone` |
| `wand_schwach` | wie `wand` | `state` 0 = Wand + Rissmarke, 1 = Durchbruch 0,5 m | alle `wand_*`, `wand_schwach_riss` (paint), `wand_schwach_bruch` |
| `zaun`, `gitter` | 1×1 | 2,5 m / cut 1,25 m | `<kind>_pfosten` (Mitte 50 cm), `<kind>_feld` (je conn-Bit zur Kante) |
| `fenster` | 1×1 | 3 m: Brüstung 1 m, Glas, Sturz 50 cm | `fenster_rahmen` (`teil` 0 Brüstung / 1 Sturz mit Krone), `fenster_glas` (Mitte + je conn-Bit; ohne conn O–W) |
| `tuer`, `schott`, `tor` | 2×1 (tor 4×1, `breite`), Anker Kantenmitte, **y 1** | Öffnung volle Breite bis 2,25 m frei, Sturz bis 3 m (nicht bei cut) | `<kind>_rahmen` (`teil` 0 Schwelle in der Bodenschicht / 1 Sturz), `<kind>_blatt` (nur in geschlossenen Zuständen) |
| `luke` | 1×1, y 1 | flach in der Bodenschicht, Öffnung 50 cm | `luke_rahmen`, `luke_blatt` (zu: in der Öffnung, offen: aufgestellt) |
| `boden` | 1×1, y 1 | Platte 25 cm unter der Lauffläche | `boden_belag` (`belag`), `boden_fuge` (paint, N- und W-Rand → 1-m-Raster) |
| `deckung_halb` / `kante` | 1×1 | 0,75 m, **helle** Oberkante | `<kind>_koerper`, `<kind>_oberkante` |
| `deckung_voll` | 1×1 | 2,5 m / cut 1,25 m, **dunkle** Krone | `deckung_voll_koerper`, `deckung_voll_oberkante` |
| `pfeiler` | 1×1 | 3 m, Schaft 50 cm; conn-Bits verbinden zur Mauer | `pfeiler_fuss`, `pfeiler_schaft` (auch Verbindungsarme), `pfeiler_kopf` |
| `truemmer` | 1×1 | ≤ 0,75 m | `truemmer_haufen` |

Die Liste der Steckplätze steht auch im Rezeptfeld `slots`.

**Steckplatz suchen** (erster vorhandener gewinnt, siehe „Vorlagen in use“):
`kit/{bauweise}/{art}/<slot>` → `kit/{bauweise}/gemein/<slot>` → `kit/geruest/slot/<slot>` (neutral, immer da).

**Steckplatz-Vertrag:**
- Stufe `architecture`, `"anchor": [0, 0, 0]`. Das Gerüst gibt einen **Kasten** `w × h × d` (Voxel, Parameter) vor;
  der Steckplatz baut nur darin. Lokal: x = entlang der Seite, y = hoch, z = Tiefe, **z = d−1 ist außen**
  (Schauseite zeigt nach +z, das Gerüst dreht je Seite).
- Übergeben werden `w, h, d, conn, cut, zustand, art, seed` (+ `state`, `teil`, `belag` wo oben genannt). Der
  Steckplatz deklariert nur, was er braucht (`art` als `options` mit den vier Werten); der Rest fällt weg.
- Vor `wand_sockel`/`wand_fuellung` macht das Gerüst das Feld frei: was der Steckplatz nicht füllt, wird
  **Vertiefung**. `wand_schwach_riss` und `boden_fuge` werden mit `mode: "paint"` aufgemalt (nur Vorhandenes).
- Die Naht garantiert das Gerüst (Körper bzw. Kasten bis zur Kachelkante). Ein Steckplatz an einer Anschlussseite muss
  seinen Kasten in der Kantenschicht **voll** füllen, sonst meldet der Prüfbogen „Naht“.
- Pflichtfarben: helle Oberkante bei halber Deckung/Kante, dunkle Krone bei Wand, Fenster, voller Deckung, Pfeiler.

**Verfall:** Das Gerüst trägt bei `zustand` > 0 per `erode` ab (Dichte 0,2 / 0,35, Tiefe = `zustand`), nur innerhalb
der Kachel ohne die Anschlussseiten und ohne Unterkante; Türen nur am Sturz. Ruß, Moos und Farbverlust macht der
Steckplatz selbst über `zustand` (z. B. `{ "shade": "stone", "f": "1 - zustand * 0.1" }`) oder die Palette (`adjust`).

**Neue Bauweise:** Steckplätze unter `kit/<bw>/gemein/` (und wo nötig `kit/<bw>/<art>/`) anlegen, `<bw>` in die
`bauweise`-Optionen der Gerüste eintragen. Das Kit-Teil `kit/<bw>/<kind>` ist eine dünne Hülle (Muster:
`kit/test/<kind>`): gleiche Parameter ohne `bauweise`, ein `use` auf `kit/geruest/<kind>` mit `"bauweise": "<bw>"`,
gleiche `footprint`/`anchor`. Prüfen: `node tools/pruefbogen.mjs kit/<bw>/<kind>` bzw.
`node tools/pruefbogen.mjs kit/geruest/<kind> --params bauweise=<bw>,art=<art>`.
