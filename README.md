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
