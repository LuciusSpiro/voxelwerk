# Voxelwerk

Voxel-Asset-Pipeline und Editor für das Coop-Spiel (Arbeitstitel Sternenschicht / Hauptrichtung Voxel).
Modelle sind **Rezepte** (JSON) statt fertiger Voxelhaufen: Formen + Farbrollen + Parameter. Daraus baut der
Kern Voxel, fasst sie zu Meshes zusammen (AO, Greedy Meshing) und three.js rendert sie.

## Start

```
npm start                 # http://localhost:3412/editor/
npm run check             # alle Assets bauen und prüfen (Filter: npm run check -- rom/bau)
npm run check -- --vox    # zusätzlich jedes Modell als .vox nach out/vox/ (für MagicaVoxel)
node tools/shots.cjs model=rom/kiste "scene=rom-aussenposten&cam=nah"   # Screenshots (Server muss laufen)
```

Kein Build, keine Abhängigkeiten außer Node ≥ 22. three.js liegt in `vendor/`. Screenshots nutzen
Playwright aus `C:\tmp\pwtest` (SwiftShader → FPS dort nicht aussagekräftig).

## Editor

- links: Bibliothek (Szenen, Figuren, Modelle, Paletten, Stimmungen, Rigs, Posen), Suche
- Mitte: Vorschau (Maus: drehen/zoomen/verschieben), unten Voxelzahl, Maße, FPS, Draw Calls
- rechts: Regler für Parameter und `seed`, Palette und Stimmung umschalten, Varianten; bei Figuren Pose;
  bei Szenen Kamera-Presets und „Kamera → JSON“
- JSON-Feld: Rezept bearbeiten → **Anwenden** (Strg+Enter, nur Vorschau) → **Speichern** (Strg+S, schreibt Datei)
- **.vox-Export** → `assets/vox/<id>.vox` in MagicaVoxel polieren und per `vox`-Schritt wieder einbinden
- URL-Parameter: `?model=…|figure=…|scene=…`, `&mood=…`, `&palette=…`, `&pose=…`, `&cam=…`, `&az=…&elev=…`, `&shot=1`

## Aufbau

| Ordner | Inhalt |
|---|---|
| `core/` | ohne three.js, läuft in Browser und Node: Stufen, Gitter, Ausdrücke, Farben/Paletten, Rezept-Interpreter, Mesher, Terrain, Szenen, `.vox`, Bibliothek |
| `render/` | three.js: Geometrien, Instancing, Figuren + Posen, Szenen, Viewer mit Stimmung und Bloom |
| `editor/` | Browser-Editor |
| `tools/` | `check.js` (Prüfung), `shots.cjs` (Screenshots), `fs-io.js` |
| `assets/` | Paletten, Modelle, Rigs, Posen, Figuren, Stimmungen, Szenen, `.vox` |

Format und Konventionen: **[AUTHORING.md](AUTHORING.md)**.

## Auflösungsstufen

Terrain 1 Voxel/m · Architektur 4 Voxel/m · Detail (Figuren, Props) 16 Voxel/m. 1 Kachel = 1 m.

## Drehsprites (EK1b, 2D-Raumansicht)

```
npm run sprites                 # alle Klassen x Farbthemen nach assets/sprites/ (ca. 4 min, linienschiff dauert je Set ~30 s)
npm run sprites -- jaeger/nord  # nur passende "<klasse>/<set>"
npm run sprites -- --check      # vergleicht mit den Dateien, Exit 1 bei Abweichung
node tools/sprites-vergleich.mjs <ordner> [zoom] [set ...]   # Lesbarkeit: alle Klassen bei 30/50/80 px
```

Draufsicht jedes Schiffsmodells (`schiff/<klasse>/<volk>`), 64 Winkelstufen, Bug bei Stufe 0 nach +x (Canvas, y unten,
Uhrzeigersinn; wie `ROT_STEPS` in Pantheon). Reiner Node-Software-Renderer (Höhenkarte der obersten Voxel, Licht links oben,
4x Supersampling, 1-px-Umriss), ohne three.js und ohne Browser, deterministisch. Ausgabe: je `<klasse>/<set>.png` ein Sheet
(8 Spalten) plus `assets/sprites/manifest.json` (Klasse, Volk, Stufen, Rahmengröße, Anker, Länge in px, `heck`).
Sets: `rom`, `nord` (Germanen), `rostmeute` (Germanen-Geometrie in Rostmeute-Farben), `aegypten`, `babylon`, `himmelsreich`.
Größen je Klasse: `KLASSEN` in `tools/sprites.mjs`. Pantheon holt die Dateien mit `npm run assets`.
