# ANKER-VERDRAHTUNG-ORT01 (Paket 5, Teil B1) – Stand: nur Analyse, KEIN Modell gebaut

Branch `ort01-anker` (von `ort01-int`). Es gibt noch keine neuen Modelle und kein Manifest `ort-anker.json`. Dieses Dokument ist der Befund aus dem Code und die Bauliste.

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

## Bauliste (Vorschlag, noch nichts gebaut)
Alle mit `jitter: 0`, `state` wie oben, Paletten `rom` / `nord`, Zustände von oben klar unterscheidbar.

| Rolle | Rom (neu) | Germanen (neu) | Fuß | state |
|---|---|---|---|---|
| ziel | `ort/rom/gemein/feldstandarte` (Feldgenerator auf Marmorsockel, Amberkern; aus `rom/standarte`) | `ort/germanen/gemein/feldmast` (Runenmast als Feldgenerator, Glutring; aus `runenmast`) | 1×1, max. 1,94 m | 0 frei (Kern/Ring pulsiert), 1 genommen (Kern entnommen, dunkel), 2 aktiviert (Feldring voll) |
| sprengpunkt Station | `ort/rom/station/sprengreaktor` (Wrapper `use ort/rom/station/reaktor`, Last aus state, Schaden) | `ort/germanen/station/sprengreaktor` | 2×2 | 0 intakt, 1 scharf (Ladung+Zünder), 2 zerstoert (Kern aus, Bruch), 3 platziert (Ladung liegt, ruhig) |
| sprengpunkt Außenposten | `ort/rom/aussenposten/zellenbatterie` | `ort/germanen/aussenposten/glutspeicher` | 1×1 | wie oben |
| zelle | `ort/rom/gemein/zelle` (ops aus `station/feldzelle`, Feld an/aus) | `ort/germanen/gemein/zelle` | 1×1 | 0 zu (Feld an), 1 offen (Feld aus) |
| beute (und fund) | `ort/rom/gemein/kassenkapsel` | `ort/germanen/gemein/fasstresor` | 1×1, max. 1 m | 0 voll/da, 1 leer/genommen |
| terminal | `ort/rom/gemein/terminal` (Wrapper um `ort/rom/station/terminal`, Mapping 0→0, 1→1, 3→2, plus eigener Ladebalken/Holo für 1 und 2) | `ort/germanen/gemein/terminal` (analog) | 1×1 | 0 bereit, 1 laedt, 2 geladen, 3 gesperrt |
| abholpunkt | `ort/rom/gemein/abholbake` (Bake + state) | Bestand `bake_abholpunkt` bleibt (state 0/1 vorhanden, Technik klar; Licht kaltweiß statt Glut, Schönheitsfehler) | 1×1 | 0 bereit, 1 gestoert |

Nicht Gameplay-Anker, aber Altstücke: `leit.dorfplatz` (Statue 3×3, beide Kulturen) und germ. `herzstueck`/`kontrollraum`. Eigener Auftrag.

## Eintragszeilen (erst nach Bau und Manifest; IDs = Bauliste)
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

## Was fehlt (alles)
Alle 13 Modelle (Rom 7, Germanen 6), `assets/manifest/ort-anker.json`, Szenen und Screenshots, Probe-Test im Spiel, Prüfläufe. Nichts davon begonnen, daher keine Selbstkritik zu Abnahme 8.
