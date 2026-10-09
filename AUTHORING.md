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

## Stimmungen (`assets/moods`)

`planet_day`, `planet_dusk`, `ship_interior`, `precursor_neon`. Felder: `background`, `fog` {color, near, far (× Szenenradius)},
`hemi` {sky, ground, intensity}, `sun` {color, intensity, dir}, `points` [{at, color, intensity, distance}], `exposure`, `bloom`.

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
