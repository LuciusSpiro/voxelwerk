# ORT-01 Paket 6M: Verdrahtung (Datenzeilen für den Spiel-Worktree)

Diese Datei listet, welche Zeilen der andere Entwickler im Spiel-Worktree eintragen muss. Die Modelle selbst sind fertig (Voxelwerk-Branch `ort01-m`), das Manifest `assets/manifest/ort-6m.json` ist im Spiel-Branch `ort01-m` committet. Die Datenzeilen unten sind **nicht** committet, sie wurden nur lokal zum Test gesetzt und danach zurückgesetzt.

## 1. Neue Modelle und ihre Rolle

| Modell-ID | Rolle | Fuß | Höhe | Dreiecke (Quads × 2) | Technikfunktion |
|---|---|---|---|---|---|
| `ort/germanen/aussenposten/deckung_fasszelle` | Deckung (Gegenstück `deckung_kapsel`) | 1×1 | ca. 1,25 m | ca. 450 | Fass-Energiezelle, Eisenfass mit Kupferreifen, breitem Glutschlitz (`#FF7A1A`) und Kupferpolen |
| `ort/germanen/aussenposten/deckung_blasebalg` | Deckung (Gegenstück `deckung_pumpe`) | 1×1 | ca. 1,25 m | ca. 1.224 | Blasebalg-Pumpenblock mit glühender Düsenkappe und Glutauslass (`#FF7A1A`) |
| `ort/germanen/aussenposten/deckung_glutspeicher` | Deckung (Gegenstück `deckung_heizer`) | 1×1 | ca. 1,38 m | ca. 578 | Glut-Wärmespeicher mit glühendem Fenster (`#FF7A1A`) und Abzugsrohr |
| `ort/germanen/aussenposten/streu_glutleitung` | Streu Außenposten | 1×1 | ca. 0,56 m | ca. 144 | Glutleitung-Stück auf Eisenstützen |
| `ort/germanen/aussenposten/streu_kabelrolle` | Streu Außenposten | 1×1 | ca. 1,13 m | ca. 484 | Kabelrolle auf Eisenbock |
| `ort/germanen/aussenposten/streu_runenpoller` | Streu Außenposten | 1×1 | ca. 1,44 m | ca. 212 | Runenpoller mit Runenring und kaltweißer Kappe |

Hinweis: `deckung_blasebalg` liegt mit ca. 1.224 Dreiecken über dem Streu-Ziel von 1.000, unter dem harten Limit. Das Manifest führt `budgetTris: 1300`. Ein Abbau wäre ein eigener Schritt. `deckung_fasszelle` führt `budgetTris: 500`.

Zusätzlich geändert (bestehende IDs, nur Optik):
- `ort/germanen/aussenposten/zellenschuppen`: Pultdach verkürzt, zwei Fasszellen auf der Ladefläche, damit er von oben als Zellenlager lesbar ist.
- `ort/rom/gemein/kassenkapsel`: neu als Amphore mit Gestell, Henkeln und Amber-Fenster im Bauch, Rinnenanschluss am Hals, Footprint 1×1, ca. 704 (voll) bzw. 786 (leer) Dreiecke, Budget 800. Zustände 0 voll und 1 leer bleiben.
- `ort/rom/gemein/zelle`, `ort/germanen/gemein/zelle`, `ort/rom/station/kartentisch` (Amber-Kartenplatte, Gitter entfernt), `ort/germanen/gemein/terminal` und `ort/germanen/station/terminal` (Rune als Kontur in `rune_dim`): siehe Commit-Log.

## 2. `content/buehnen/bauweisen/germanen.json` → `deckung_props.aussenposten`

Bisher (zu ersetzen):

```json
"aussenposten": {
  "deckung_halb": ["prop/germanen/gemein/fass", "prop/germanen/gemein/werkzeug", "prop/germanen/gemein/fass"],
  "deckung_voll": ["ort/germanen/aussenposten/leitfeuer", "prop/germanen/gemein/fass", "prop/germanen/gemein/werkzeug"]
}
```

Vorschlag (Probe lokal getestet):

```json
"aussenposten": {
  "deckung_halb": ["ort/germanen/aussenposten/deckung_fasszelle", "ort/germanen/aussenposten/deckung_blasebalg", "ort/germanen/aussenposten/deckung_fasszelle"],
  "deckung_voll": ["ort/germanen/aussenposten/deckung_glutspeicher", "ort/germanen/aussenposten/leitfeuer", "ort/germanen/aussenposten/deckung_blasebalg"]
}
```

Die Zuordnung der Rollen ist: `deckung_halb` nimmt die Fasszelle (zweimal, Kapsel-Gegenstück) und den Blasebalg (Pumpe). `deckung_voll` nimmt den Glutspeicher (Heizer), das Leitfeuer (bestehend) und den Blasebalg.

## 3. `content/buehnen/deko/germanen.json` → `regeln` Außenposten-Platztypen

Die Platztypen `hof`, `lagerhalle`, `landeplatz`, `palisade`, `tor` und `treibstofflager` nutzen bisher `fass`, `werkzeug`, `kette` und `feuerschale`. Vorschlag: die Props-Liste jeweils auf die drei Streu-Stücke setzen, die Dichte und die anderen Felder bleiben unverändert:

```json
"props": [
  "ort/germanen/aussenposten/streu_glutleitung",
  "ort/germanen/aussenposten/streu_kabelrolle",
  "ort/germanen/aussenposten/streu_runenpoller"
]
```

Achtung: Die Regeln sind nach Platztyp gebaut und `hof`, `lagerhalle`, `landeplatz`, `palisade`, `tor`, `treibstofflager` sind in der Datei unter `regeln` geführt. Im Probe-Lauf wurde die Zeile nur für diese sechs Schlüssel geändert. Die Regeln `*`, `herzstueck`, `lager`, `quartiere`, `zellen`, `schleuse`, `abfluss`, `funkmast`, `gelaende`, `huegel`, `lichtung`, `innenzaun`, `wachturm`, `zaunluecke`, `zellenblock` und die Schiffs-Regeln sind nicht angefasst. Sie haben weiterhin `fass`, `werkzeug`, `kette` oder `feuerschale`, weil sie nicht Teil dieses Pakets sind.

Die Liste `deko_ausschluss` (Feuerschale im Außenposten) bleibt, sie ist nicht betroffen.

## 4. Prüfung

- `npm run check:assets -- --vw` mit `VOXELWERK_PATH` auf `voxelwerk-ort01-m` (mit Schrägstrichen): 0 Fehler, 0 Warnungen für die neuen Einträge.
- `node tools/check.js ort/germanen/aussenposten/` und `ort/rom/gemein/kassenkapsel`: 0 Fehler.
- Sichtprobe `tools/ort01-shots.js --arten aussenposten --bauweisen germanen --seeds 1` mit den Datenzeilen oben (Lokaltest, danach zurückgesetzt): Die Deckung ist im Lager sichtbar. Die Streu-Stücke sind auf der Übersicht kaum sichtbar, das liegt an der Größe, nicht an den Modellen.
