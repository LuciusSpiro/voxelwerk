# ANKER-VERDRAHTUNG-ORT01 (Paket 5, Teil B1): Stand: 13 Modelle gebaut, geprüft, im Spiel probiert

Branch `ort01-anker` (von `ort01-int`). Modelle erzeugt von `tools/gen-ort-anker.mjs` (JSON unter `assets/models/ort/*` ist maßgeblich), Szenen von `tools/ort01-anker-szenen.mjs`, Manifest `assets/manifest/ort-anker.json` im Spiel-Worktree `Pantheon-ort01-anker`.

## Wie der Code den Anker auflöst (Belege)
- `public/js/voxel/kit.js`: `propEintrag(rolle, platz)` liest `bauweisen/<bw>.json → anker[rolle][art | '*']` (String oder `{id, <feste Parameter>}`, auch `{ '*': ID, <platztyp>: ID }`). Der Prop bekommt `state` = Index des aktuellen Zustandsnamens in `anker.json → rollen.<rolle>.zustaende` (`Math.max(0, zst.indexOf(nm))`), dazu `zustand`, `art`, `seed`. **Ein Modell braucht also einen `state`-Parameter, dessen Indizes genau der Zustandsliste der Rolle entsprechen.**
- Manifest-Footprint > 1 (2×2): Prop wird in die Blockmitte zur freien Seite versetzt (`t.off`, kit.js ca. Zeile 1212).
- Anker `tor`/`eingang` werden nie als Prop gerendert (Türen). Der `leit`-Anker setzt `bauweise.leit[platztyp][art]`.

## Anker-Rollen, die die Generatoren auf station/aussenposten wirklich erzeugen
(`gen-station.js` 320-374, `gen-siedlung.js` 433-739, plus Module/Schablonen)

| Rolle | Zustände (state 0..n) | Station | Außenposten | Rom heute | Germanen heute |
|---|---|---|---|---|---|
| `ziel` | frei, genommen, aktiviert | ja (Kontrollraum-Mitte + 3 innen) | ja (Kommando-Mitte) | `leit/rom/ruine/fahnenheiligtum` 2×2 (Ruine, verboten) | Station: `prop/germanen/schiff/schildgenerator` 1×1; Außenposten: `leit/germanen/aussenposten/thing_stein` 2×2 (verboten) |
| `sprengpunkt` | intakt, scharf, zerstoert, platziert | ja (Reaktorraum, 1, Rand) | ja (2) | `prop/rom/ruine/munitionskammer` 1×1 (Ruine) | Station: `schmiedeherd_reaktor_2x2` (3 Zustände); Außenposten: `runenmast` 1×1 (3 Zustände) |
| `zelle` | zu, offen | ja (Zellen, 2+2) | ja (Kerker/Käfig, 2) | `prop/rom/ruine/carcer` (Ruine) | `kaefig_zelle` (verboten) |
| `beute` | voll, leer | ja (Lager, 2+3) | ja (4) | `legionskasse` (Ruine) | `truhe` (verboten) |
| `fund` | da, genommen | nein (nur Ruine/Kampagnenkarten) | nein | `legionskasse` | `met_kessel` (Bestand, ok) |
| `terminal` | bereit, laedt, geladen, gesperrt | ja (2, Monster 4) | ja (1) | `offiziersschloss` (Ruine, 3 Zustände) | `runenstein_terminal` (4 Zustände, Altstück) |
| `abholpunkt` | bereit, gestoert | ja | ja | `ort/rom/gemein/bake` (OHNE state) | `bake_abholpunkt` (state 0/1, ok) |
| `aussicht` | – | – | ja (Wachturm) | – | – |
| `flagge` | unten, gehisst | nein (nur Eisenwald) | nur Eisenwald | kein Eintrag | kein Eintrag in `germanen.json` |
| `raetsel` | ruhe, gehalten, geloest | nein (nur Ruine) | nein | `aquaedukt_verteiler`/`offiziersschloss` | `runenstein_terminal raetsel:1` |
| `leit` (Module) | – | `herzstueck`, `kontrollraum` | `dorfplatz` (3×3), `landeplatz`, `wachturm` | Außenposten: `statue_platz` (Statue, laut Leitfaden verboten); Station: kein Eintrag | Station: `schmiedeherd` 3×2, `hochsitz_halle` 3×2; Außenposten: `statue_platz` |

`fund`, `raetsel`, `flagge`, `eingang`, `tor`, `aussicht`: auf Station/Außenposten kein neues Modell nötig.

## Gebaute Modelle (Dreiecke = Quads × 2, größter Zustand)
| Rolle | Rom | Tris | Germanen | Tris | Fuß | state |
|---|---|---|---|---|---|---|
| ziel | `ort/rom/gemein/feldstandarte` | ~800 | `ort/germanen/gemein/feldmast` | ~1.310 | 1×1, 1,94 m | 0 frei, 1 genommen, 2 aktiviert |
| sprengpunkt Station | `ort/rom/station/sprengreaktor` (Wrapper um `ort/rom/station/reaktor`) | ~4.570 | `ort/germanen/station/sprengreaktor` (Wrapper) | ~5.920 | 2×2 | 0 intakt, 1 scharf, 2 zerstoert, 3 platziert |
| sprengpunkt Außenposten | `ort/rom/aussenposten/zellenbatterie` | ~730 | `ort/germanen/aussenposten/glutspeicher` | ~830 | 1×1, 1,3 m | wie oben |
| zelle | `ort/rom/gemein/zelle` | ~1.430 | `ort/germanen/gemein/zelle` | ~1.740 | 1×1, 1,63 / 1,88 m | 0 zu, 1 offen |
| beute und fund | `ort/rom/gemein/kassenkapsel` | ~630 | `ort/germanen/gemein/fasstresor` | ~830 | 1×1, ~1,1 / 1,25 m | 0 voll bzw. da, 1 leer bzw. genommen |
| terminal | `ort/rom/gemein/terminal` (Wrapper um `ort/rom/station/terminal`) | ~1.370 | `ort/germanen/gemein/terminal` (Wrapper) | ~2.100 | 1×1 | 0 bereit, 1 laedt, 2 geladen, 3 gesperrt |
| abholpunkt | `ort/rom/gemein/abholbake` | ~650 | Bestand `prop/germanen/gemein/bake_abholpunkt` (bleibt) | – | 1×1 | 0 bereit, 1 gestoert |

`node tools/check.js ort/`: 0 Fehler, 0 Warnungen. `npm run check:assets -- --vw` (Spiel, `VOXELWERK_PATH`): 0 Fehler (Abschnitt `ort-anker (13)`).
Hinweise: germanischer Sprengreaktor ist 2,0 m hoch (wie der Bestandsreaktor, Hauptstück 2×2 ohne Wegkachel). Alle Modelle `jitter: 0`, Böden einfarbig/ruhig, Zustandslogik nur über `state`.

## Eintragszeilen (Reihenfolge der Zustände entspricht anker.json; so lokal getestet)
`bauweisen/rom.json`, `anker` (der `"*"`-Eintrag bleibt für `ruine`):
```
"ziel":        { "station": "ort/rom/gemein/feldstandarte", "aussenposten": "ort/rom/gemein/feldstandarte", "*": "leit/rom/ruine/fahnenheiligtum" },
"sprengpunkt": { "station": "ort/rom/station/sprengreaktor", "aussenposten": "ort/rom/aussenposten/zellenbatterie", "*": "prop/rom/ruine/munitionskammer" },
"zelle":       { "station": "ort/rom/gemein/zelle", "aussenposten": "ort/rom/gemein/zelle", "*": "prop/rom/ruine/carcer" },
"beute":       { "station": "ort/rom/gemein/kassenkapsel", "aussenposten": "ort/rom/gemein/kassenkapsel", "*": "prop/rom/ruine/legionskasse" },
"fund":        { "station": "ort/rom/gemein/kassenkapsel", "aussenposten": "ort/rom/gemein/kassenkapsel", "*": "prop/rom/ruine/legionskasse" },
"terminal":    { "station": "ort/rom/gemein/terminal", "aussenposten": "ort/rom/gemein/terminal", "*": "prop/rom/ruine/offiziersschloss" },
"abholpunkt":  { "station": "ort/rom/gemein/abholbake", "aussenposten": "ort/rom/gemein/abholbake", "*": "prop/germanen/gemein/bake_abholpunkt" }
```
`germanen.json`: gleiche Struktur mit `ort/germanen/...`: ziel `ort/germanen/gemein/feldmast` (station und aussenposten); sprengpunkt station `ort/germanen/station/sprengreaktor`, aussenposten `ort/germanen/aussenposten/glutspeicher`; zelle `ort/germanen/gemein/zelle`; beute `ort/germanen/gemein/fasstresor`; terminal `ort/germanen/gemein/terminal`. `schiff`/`*`-Einträge bleiben, `fund` bleibt `met_kessel`, `abholpunkt` bleibt.
`leit_fuss`: nur für Leitstücke nötig, die Anker brauchen ihn nicht (2×2-Fuß des `sprengreaktor` kommt aus dem Manifest-Footprint).
Zustandsabbildung im Code: keine Änderung nötig; wichtig ist nur, dass die Zustandsreihenfolge im Modell der Liste in `anker.json` entspricht.

## Probe-Test im Spiel (lokal, verworfen)
Mit den obigen Zeilen lokal gesetzt, `npm run assets` gegen dieses Voxelwerk, `tools/ort01-shots.js --seeds 1,2 --raeume reaktor,zellen,lager,kommando` (Station und Außenposten, Rom und Germanen): alle 8 Läufe `kitFehler 0`, `konsolenfehler 0`, `dekoFehlt {}`; die Modelle laden als Anker (Bilder im Spiel-Worktree unter `shots/anker/`, gitignored). Live-Umschalten der Zustände im laufenden Spiel nicht getestet (nur Statik `zu/intakt/frei` und alle Zustände in Voxelwerk-Szenen).

## Was fehlt / Vorbehalte
- Zustandswechsel im laufenden Spiel nicht live geprüft.
- `flagge` (Eisenwald) und `raetsel` nicht gebaut (kommen auf Station/Außenposten nicht vor).
- Rom `ziel` und `sprengpunkt Außenposten` sind formal einfach (Marmorblock mit Amberfenstern); Selbstkritik siehe Rückmeldung.
