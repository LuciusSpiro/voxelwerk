# LAD-01 F2: Ladeplatz (Frachtraum-Darstellung je Ware)

Ein Modell `lerche/furn/ladeplatz` füllt **einen Platz** (1 Kachel, Plattform wie `cargo_bay`, Anker Mitte unten, Footprint 1 x 1).
Die Form wählt der **String-Parameter `darstellung`** = Wert des Feldes `darstellung` in `content/waren.json` des Spiels.
Technik: `use` mit Vorlage `lerche/furn/ladeplatz_{darstellung}` (siehe AUTHORING.md, "Vorlagen in use"); ein unbekannter Schlüssel fällt auf `ladeplatz_kiste` zurück.
Füllstufen entstehen im Spiel durch die Zahl belegter Plätze, nicht im Modell. Kollision liefert die Kachel im Spiel.

| `darstellung` | Ware (waren.json) | Form | Teilmodell |
|---|---|---|---|
| `kiste` | fracht | graubraune Frachtkisten (= `cargo_bay` art 2) | `ladeplatz_kiste` |
| `waffenkiste` | waffen | drei lange flache olivgrüne Kisten, rote Stirnseiten, gelb-schwarzes Warnband | `ladeplatz_waffenkiste` |
| `erzbrocken` | erz | offene Kiste mit Haufen aus Kupfer-/Eisenbrocken, Glanzkristall | `ladeplatz_erzbrocken` |
| `schrott` | bergungsgut | zusammengewürfelte Teile: Platte, Rostfass, Rad, Rohr, rotes Paneel, Solarglas | `ladeplatz_schrott` |
| `fass` | deuterium | zwei Tanks mit Leuchtband (= `cargo_bay` art 3) | `ladeplatz_fass` |
| `sprengkiste` | sprengstoff | rote Munitionskisten (= `cargo_bay` art 1) | `ladeplatz_sprengkiste` |
| `kiste_med` | hilfsgueter | weiße Kisten mit rotem Kreuz, grüner Sockelstreifen | `ladeplatz_kiste_med` |
| `bett` | person | `lerche/furn/bed`, Decke 3 (Gast), ohne Plattform | `ladeplatz_bett` |
| `leer` | (kein Eintrag) | leere Plattform (= `cargo_bay` art 0) | `ladeplatz_leer` |

Zweiter Parameter `gesichert` (0/1) wie bei `cargo_bay` (Sicherungslicht), wirkt nicht beim Bett.

## Neue Ware ohne neue Optik
`darstellung` in `waren.json` auf einen vorhandenen Schlüssel setzen. Neue Optik: Teilmodell `ladeplatz_<schluessel>.json` anlegen
und den Schlüssel in `options` und `variants` von `ladeplatz.json` ergänzen.

## Manifest-Eintrag fürs Spiel (`assets/manifest/art-e.json`, Leiter)
`options`-Parameter gehen im Manifest nur über `states` (check-assets). Die Teilmodelle sind Abhängigkeiten des Hauptmodells (Sync kopiert sie mit; nicht gegen den Sync geprüft).

```json
{
  "id": "lerche/furn/ladeplatz", "kind": "model", "tier": "detail", "palette": "lerche_rom",
  "footprint": [1, 1], "height": 1.2, "facing": "+z",
  "params": { "gesichert": [0, 1] },
  "states": {
    "leer": { "darstellung": "leer" }, "kiste": { "darstellung": "kiste" }, "waffenkiste": { "darstellung": "waffenkiste" },
    "erzbrocken": { "darstellung": "erzbrocken" }, "schrott": { "darstellung": "schrott" }, "fass": { "darstellung": "fass" },
    "sprengkiste": { "darstellung": "sprengkiste" }, "kiste_med": { "darstellung": "kiste_med" }, "bett": { "darstellung": "bett" }
  },
  "sockets": { "use": [0, 0, 0.55] }, "tint": [], "budgetTris": 6000,
  "tags": ["lerche", "furn", "storage", "fracht"]
}
```

Vorschau aller Varianten: `LAD01-ladeplatz-vorschau.png`; Szene `assets/scenes/lad01-ladeplatz.json` (`npm start`, `?scene=lad01-ladeplatz&cam=spiel&mood=hall_metall`).
