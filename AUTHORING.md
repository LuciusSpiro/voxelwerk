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
Erlaubt: + − * / %, Vergleiche, `&& || !`, `?:`, `min max floor ceil round abs sqrt sin cos`.
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
