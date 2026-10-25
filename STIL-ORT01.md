# Stilleitfaden ORT-01: Römische und germanische Orte

Stand 2026-10-25, Entscheidung Kai: **Rom = Richtung „Aquädukt“**, **Germanen = Stabbau-Architektur (aus „Spant“) in Farben und Assets der „Esse“**.
Gilt für Paket 2 (Außenposten) und 3 (Station). Bei Widerspruch zum Code gilt `AUTHORING.md`.

Referenzszenen (gleiches Licht für beide Kulturen: Station `hall_metall`, Außenposten `planet_day`):
`assets/scenes/ort-r1-station.json`, `ort-r1-aussen.json`, `ort-ger-station.json`, `ort-ger-aussen.json`
(erzeugt mit `tools/ort01-szenen.py`). Verworfene Richtungen liegen unter `assets/models/ort/verworfen/` und gehen nicht ins Spiel.

## Grundregel für beide Kulturen

**Formsprache der Kultur, Funktion der Technik.** Jedes Stück ist ein Gerät: Energiespeicher, Leitung, Pumpe, Terminal, Sensor, Frachtmodul.
Die Kultur steckt in Form, Material, Ornament und Farbe. Prüffrage an jedes Modell: *Was tut das Ding, und sieht man es?*
Vorbild ist `rom/energiezelle`, die Energiezelle in Amphorenform.

- Verboten: Stücke, die nur historisch sind. Beispiele: Säule ohne Leitung, Fass ohne Inhalt, Truhe, Kette, Holzwerkbank, Waffenständer, Holz-Landeplatz.
- Verboten: Sci-Fi-Standard ohne Kulturbezug, also graue Kiste mit Bildschirm.
- **Funktion sichtbar machen:** Jedes Gerät hat mindestens ein Zeichen seiner Funktion, das von oben lesbar ist: Leuchtlinie, Anzeige, Rohr- oder Kabelanschluss, Kolben.

## Spiegelregel

Zu **jedem** römisch-spezifischen Stück gibt es ein germanisches Gegenstück und umgekehrt. Die **Rolle ist gleich, die Form nicht**:

| Rolle | Rom | Germanen |
|---|---|---|
| Energiezelle | Amphore (`rom/energiezelle`) | Eisenfass (`ort/germanen/gemein/fasszelle`) |
| Energieleitung | Aquädukt-Rinne auf Bögen (`ort/rom/gemein/leitung`) | Glutleitung im Klinkerkanal (`ort/germanen/gemein/glutleitung`, neu) |
| Verteiler | Castellum-Rundbecken (`ort/rom/gemein/verteiler`) | Runenstein mit Schlangen-Sammelschiene (`ort/germanen/gemein/verteiler`) |
| Reaktor | Kreuzaquädukt mit Amphoren-Druckgefäß | Schmelzofen mit Glutmaul und Blasebalg |
| Wandkrone (Signatur von oben) | Amberrinne | Glutfuge |
| Funkantenne | Clipeus (Rundschild als Spiegel) | Rundschild-Antenne mit Buckel (neu) |
| Sensorturm | Säule mit Tholos und Radomkegel | Stabmast mit Stevendrache |

Gleiche Form, nur umgefärbt, ist nur bei neutraler Technik erlaubt, also Kabel, Kisten-Grundkörper und Bodenluken.

---

## Rom: „Aquädukt“

**Idee.** Rom baut Infrastruktur, und die Energie fließt wie Wasser im Aquädukt: in offenen Rinnen auf Bögen und Mauerkronen, verteilt über Becken, gespeichert in Amphoren.
Die Architektur ist die Leitung: Bögen tragen Kanäle, Säulen führen Leiter.
Hell, geordnet, symmetrisch: Marmor, pompejanisches Rot und Gold, Amberlicht als Energie.

**Palettenrollen (`rom`):**

| Rolle | Farbe | Wofür |
|---|---|---|
| `secondary` | Marmorweiß | Flächen, Gehäuse, Bögen |
| `stone`, `stone_light` | Travertin | Sockel, Gesimse, Podien |
| `primary` | Pompejanisch Rot | Wandsockel (1 m), Paneelfelder, Zierbänder |
| `trim` | Gold | Bänder, Schlusssteine, Kapitelle, Rinnenkanten |
| `glow2` | Amber, leuchtend | **Energie**: Rinnen, Anzeigen, Kerne |
| `glow` | Kaltweiß | nur Sensorik und Daten (Sensorkern, Schirmzeilen) |
| `metal_dark`, `metal` | Gunmetal | Pumpen, Kolben, Rohre, Lafetten: alles, was sich bewegt oder pumpt |
| `dach` | Terrakotta | Ziegeldächer |

`rom/energiezelle` bleibt unverändert, mit kaltweißer Ladeanzeige (Entscheidung Kai).

**Formregeln:**
- **Dos**
  - Rundbogen aus dem gemeinsamen Teil `ort/rom/gemein/bogen` (`use`), Rinne oben, Gold nur als Kante oder Band. Beispiele: `leitung`, `zellenarkade`, Reaktor-Arme.
  - Gefäße und Speicher in Amphorenform mit Sichtfenster. Beispiele: Druckgefäß im Reaktor, `rom/energiezelle`.
  - Gunmetal-Technik an Marmorkörpern: Pumpen an den Ecken des Reaktors, Schaltkasten am Sensorturm, Wandaggregate an der Halle.
  - Runde Schilde als Spiegel und Antennen (`clipeus`).
- **Don'ts**
  - Säulenringe oder Rotunden als Hauptform. Die erste Reaktorfassung (Tholos mit Kern) wirkte als „Tempel mit Licht“ und ist ersetzt.
  - Große Glühflächen. Leuchten nur als Linie oder kleine Anzeige.
  - Rot auf großen Flächen außer am 1-m-Wandsockel.
  - Ornamente ohne Funktion: kein Fries, keine Statue, kein Adler als Deko. Die Standarte nur als Feldgenerator.

**Erkennungsmerkmal:** die **Amberrinne**. Sie läuft auf Bögen und Mauerkronen durch jeden Raum, und jedes Gerät hängt sichtbar an ihr. Von oben ist sie eine Amberlinie oder beim Reaktor ein Amberkreuz.

## Germanen: Stabbau mit Esse

**Idee.** Die Germanen bauen wie ihre Schiffe und Stabkirchen: senkrechte Eisenplanken, Pfosten mit Kupfernieten, gestaffelte Steildächer, Turmnadel als Antenne.
Energie ist Glut: Sie scheint durch Fugen, läuft über Wandkronen und Firste und sitzt in Ofenmäulern. Runen sind kalte Schaltkreise und Optiken.
Rohe, ehrliche Industrie aus Eisen, Rostkupfer und Fell; Behälter sind Fässer.

**Palettenrollen (`nord`):**

| Rolle | Farbe | Wofür |
|---|---|---|
| `metal_light` / `metal` im Wechsel | helles und mittleres Eisen | **Stabplanken** (senkrechte Streifen, `stripes` Achse x, Periode 1), Dachlagen. Hell halten, sonst „dunkle Scheune“ |
| `metal_dark` | dunkles Eisen | Pfosten, Sockel, Kerne, Rahmen |
| `primary` | Eisengrau | Klinkerplanken an Geräten |
| `copper`, `copper_dark` | Kupfer, Rostrot | Nieten, Reifen, Traufen, First, Kämme: **der warme Akzent** |
| `ember` | Glut, leuchtend | **Energie**: Fugen, Firstlinie, Ofenmaul, Ladeschlitz |
| `rune` / `rune_dim` | Kaltweiß | Schaltkreise, Siegel, Optiken (Augen), Turmnadel |
| `fur`, `fur_dark`, `fur_light` | Fell | über Pulten und Sitzen |
| `stone_dark` | Granit | Fundamente |

**Formregeln:**
- **Dos**
  - Gebäude in Stabbauweise: senkrechte Planken, Pfosten alle 2 m, gestaffelte Steildächer, gekreuzte Giebelbretter mit Runenspitzen, Turm mit Kupfernadel (`ort/germanen/aussenposten/halle`).
  - Geräte in Klinkerbau, mit dem gemeinsamen Teil `ort/germanen/gemein/klinker`: Glutfuge unter jeder Plankenlippe, Kupfernieten. Beispiele: Reaktor, Pultfront des Terminals.
  - Behälter als Fässer: rund mit Reifen, oder als Achteck, wenn es aufs Budget ankommt (`fassregal`). Runensiegel auf der Stirn.
  - Fell als Bedienfläche über dem Pult (`terminal`).
  - Tierköpfe nur als Gerätekopf: der Stevendrache ist der Sensor, seine Augen sind die Optiken, im Maul glüht der Sender.
- **Don'ts**
  - Holzbraun oder `dach`-Braun auf großen Flächen. Das liest sich als Blockhütte oder Pagode, das war der Fehler der ersten Fassungen.
  - Zufallsrauschen (`noise`) auf Planken. Es wirkt wie Mauerstein; stattdessen Streifen.
  - Große Runenblöcke in der Bau-Stufe: 25-cm-Voxel werden zu weißen Klecksen.
  - Fass ohne Anschluss, Kette und Holzwerkbank.

**Erkennungsmerkmal:** die **Glutfuge**. Sie liegt auf Wandkronen und Firsten, in Plankenfugen und an Torschwellen. Von oben ist sie eine warme Linie, das Gegenstück zur römischen Rinne. Dazu kommt die Silhouette der Stabhalle mit Turmnadel.

---

## Bau-Regeln (beide Kulturen)

1. **`"jitter": 0` auf Modellebene.** Die Helligkeitsstreuung je Voxel verhindert das Zusammenfassen von Flächen: ein 1-m-Würfel hat 1.074 statt 6 Quads. Struktur entsteht durch `stripes` und `frame`, nicht durch Rauschen.
2. **Budget:** Ziel **1.500 Dreiecke je belegter Kachel**, hart **2.500 je Kachel**. Dreiecke = (lit + emit Quads) × 2, `node tools/check.js <filter>`, immer mit Filter.
   - Ein 1×1-Turm darf höchstens 2.500 haben, ein Hauptstück 2×2 höchstens 10.000 bei Ziel 6.000.
   - Streu-Props (1×1, nicht blockierend, ≤ 1,94 m) zielen auf ≤ 1.000.
   - Bau-Teile (Wände, Hallen) werden pro Bühne gemessen, nicht je Modell.
3. **Linienlicht:** Leuchtende Bau-Teile (Stufe `architecture`) nur als 1-Voxel-Linie mit `emit` ≤ 0,6. Detail-Modelle: Kerne ≤ 1,2, Anzeigen ≤ 1,0.
4. **Bögen:** nie per `cyl` mit `arc`/`hollow` bei kleinen Radien, das wird körnig. Stattdessen den Bogen aus einem Block ausschneiden, zeilenweise als Voxelkreis über `repeat` (siehe `ort/rom/gemein/bogen`), oder Stufen per `box`.
5. **Gemeinsame Teile per `use`:** `ort/rom/gemein/bogen` und `ort/germanen/gemein/klinker`. Ein Teilmodell bringt seinen eigenen Jitter mit, deshalb Bestandsmodelle mit Jitter sparsam als Teil verwenden.
6. **Runde Körper sind teuer**, besonders Zylinder mit Achse x oder z. Für Mengen (Regale) Achteck aus zwei Boxen nehmen.
7. **Wandnähe:** Die Rückseite liegt bei −z, die Schauseite bei +z. Wandnahe Stücke ≤ 0,75 m tief.
8. **Höhe:** Streu ≤ 1,94 m (`K-SILHOUETTE`). Hauptstücke dürfen höher sein, stehen aber nicht auf Weg-, Tür- oder Ankerkacheln. Annahme bis zur Klärung in Paket 1: Hauptstücke sind nicht begehbar.
9. **Licht vergleichbar halten:** Prüfbilder für Station in `hall_metall`, für Außenposten in `planet_day`, je 3 Kameras (Übersicht, spielnah von oben, Detail).

## Namenskonvention

```
assets/models/ort/<kultur>/<station|aussenposten|gemein>/<name>.json
  <kultur>    rom | germanen
  station     nur in Stationsräumen
  aussenposten nur im Außenposten (Gebäude, Hof, Turm)
  gemein      in beiden (Zellen, Leitungen, Verteiler, Teile)
```

- Gleicher `<name>` für Gegenstücke, wo es geht, zum Beispiel `ort/rom/station/reaktor` und `ort/germanen/station/reaktor`. Das erleichtert die Paritätsprüfung.
- Teile, die nur per `use` verbaut werden, bekommen das Tag `teil`.
- Rollen-IDs im Rollenformat: `<raumtyp>.<rolle>`, zum Beispiel `reaktor.kern`, `lager.zellenregal`.
- Bestandsmodelle behalten ihre ID: `rom/*`, `prop/germanen/*`.

---

## Finale Rollenliste

- **Art:** `leit` = Hauptstück; `anker` = Hauptrolle an festem Anker; `streu` = 1×1, nicht blockierend, ≤ 1,94 m. Nebenrollen laufen als `anker` mit Seedwahl.
- **Status:** **vorh.** = in diesem Worktree gebaut; **Bestand** = gibt es schon im Voxelwerk; **neu** = zu bauen.
- **Fuß** = Fußabdruck in Kacheln (x × z). **Ziel** = Dreiecksziel (1.500 je Kachel).
- Die Kantine ist gestrichen (Kai).

### Station

**Kommando**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `kommando.kartentisch` | leit | `ort/rom/station/kartentisch` neu: Marmortisch auf Bogenfüßen, Amber-Kartenhologramm, Rinnenanschluss | `ort/germanen/station/kartentisch` neu: Eisentisch mit Klinkerschürze, Runenkarte, Glut unter Rostgitter | 2×1 | 3.000 |
| `kommando.pult` | anker | `ort/rom/station/terminal` vorh. (1.370) | `ort/germanen/station/terminal` vorh., Hochsitz (1.992) | 1×1 | 1.500 |
| `kommando.funk` | anker | `ort/rom/station/clipeus_wand` neu: Wand-Clipeus (Ableitung von `ort/rom/aussenposten/clipeus`) | `ort/germanen/gemein/schildantenne` neu: Rundschild mit Buckel als Spiegel | 1×1 | 1.200 |
| `kommando.wandschirm` | anker | `ort/rom/station/wandschirm` neu: Schirm im Bogenrahmen | `prop/germanen/station/wandmonitor` Bestand | 1×1 | 800 |
| `kommando.verteiler` | anker | `ort/rom/gemein/verteiler` vorh. (1.336) | `ort/germanen/gemein/verteiler` vorh. (1.204) | 1×1 | 1.500 |
| `kommando.feldzeichen` | anker | `rom/standarte` Bestand (Feldgenerator) | `prop/germanen/aussenposten/runenmast` Bestand | 1×1 | 1.500 |
| `kommando.datentafel` | streu | `ort/rom/gemein/tafel` neu: Wachstafel-Datenpad im Ständer | `ort/germanen/gemein/runenholz` neu: Kerbholz-Datenstab im Ständer | 1×1 | 600 |

**Reaktor**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `reaktor.kern` | leit | `ort/rom/station/reaktor` vorh. (4.308) | `ort/germanen/station/reaktor` vorh. (5.700) | 2×2 | 6.000 |
| `reaktor.pult` | anker | `ort/rom/station/terminal` vorh. | `ort/germanen/station/terminal` vorh. | 1×1 | 1.500 |
| `reaktor.leitung` | anker | `ort/rom/gemein/leitung` vorh. (1.612) | `ort/germanen/gemein/glutleitung` neu: Klinkerkanal mit Glutfugen auf Eisenböcken | 2×1 | 3.000 |
| `reaktor.verteiler` | anker | `ort/rom/gemein/verteiler` vorh. | `ort/germanen/gemein/verteiler` vorh. | 1×1 | 1.500 |
| `reaktor.pumpe` | anker | `ort/rom/station/pumpe` neu: Gunmetal-Kolben im Marmorgehäuse (aus der Reaktorpumpe) | `ort/germanen/station/blasebalg` neu: Blasebalg-Kühlpumpe (aus dem Reaktor) | 1×1 | 1.200 |
| `reaktor.zelle` | streu | `rom/energiezelle` Bestand (888) | `ort/germanen/gemein/fasszelle` vorh. (1.104) | 1×1 | 1.000 |

**Lager**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `lager.zellenregal` | leit | `ort/rom/gemein/zellenarkade` vorh. (2.446, ohne Zellen) | `ort/germanen/gemein/fassregal` vorh. (3.190, 6 Fässer eingebaut) | 2×1 | 3.000 |
| `lager.frachtregal` | anker | `rom/zellenregal` Bestand, **über Budget (10.660), überarbeiten** | `prop/germanen/station/regal` Bestand | 2×1 | 3.000 |
| `lager.ladebank` | anker | `ort/rom/station/ladebank` neu: Bogen-Ladebank mit Rinne, Zellen stehend | `ort/germanen/station/ladebock` neu: Eisenbock mit Glutschiene | 2×1 | 3.000 |
| `lager.fracht` | anker | `rom/kiste` Bestand | `prop/germanen/gemein/kiste_stapel` Bestand | 1×1 | 1.500 |
| `lager.kran` | anker | `ort/rom/station/kran` neu: Bogenportal mit Kettenzug und Gunmetal-Motor | `ort/germanen/station/kran` neu: Galgenkran mit Klinkerausleger | 1×1 | 1.500 |
| `lager.zelle` | streu | `rom/energiezelle` Bestand | `ort/germanen/gemein/fasszelle` vorh. | 1×1 | 1.000 |

**Quartier**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `quartier.koje` | leit | `ort/rom/station/koje` neu: Kojennische unter Bogen, Lebenserhaltungspaneel | `ort/germanen/station/koje` neu: Stabkoje mit Fell und Glutheizung | 2×1 | 3.000 |
| `quartier.spind` | anker | `ort/rom/station/spind` neu: Marmorspind mit Amber-Ladefach (ersetzt Truhe) | `ort/germanen/station/spind` neu: Eisenspind mit Runenschloss (ersetzt Truhe) | 1×1 | 1.500 |
| `quartier.klima` | anker | `ort/rom/station/hypokaustum` neu: Heiz- und Lüftersäule | `ort/germanen/station/glutofen` neu: kleiner Klinker-Heizofen | 1×1 | 1.500 |
| `quartier.wandschirm` | anker | `ort/rom/station/wandschirm` neu (siehe Kommando) | `prop/germanen/station/wandmonitor` Bestand | 1×1 | 800 |
| `quartier.licht` | anker | `rom/laterne` Bestand | `prop/germanen/gemein/laterne` Bestand | 1×1 | 1.200 |
| `quartier.privat` | streu | `ort/rom/gemein/tafel` neu | `ort/germanen/gemein/runenholz` neu | 1×1 | 600 |

**Messe**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `messe.tafel` | leit | `ort/rom/station/messetafel` neu: Marmortafel, Wärmeplatten aus der Rinne | `ort/germanen/station/langtisch` neu: Eisen-Langtisch mit Glutrinne in der Mitte | 3×1 | 4.500 |
| `messe.ausgabe` | anker | `ort/rom/station/amphorenspender` neu: Nahrungs- und Getränkeautomat mit Amphorentanks | `prop/germanen/station/met_kessel` Bestand (Brau- und Ausgabekessel) | 1×1 | 1.500 |
| `messe.bank` | anker | `ort/rom/station/bank` neu: Marmorbank mit Rinnenheizung | `ort/germanen/station/bank` neu: Eisenbank mit Fell und Glutfuge | 2×1 | 2.000 |
| `messe.kuehlung` | anker | `ort/rom/station/kuehlamphore` neu: Kühlgefäß mit Kühlschlange | `ort/germanen/station/kuehlfass` neu: Fass mit Raureif-Kühlschlange | 1×1 | 1.200 |
| `messe.licht` | anker | `rom/laterne` Bestand | `prop/germanen/gemein/laterne` Bestand | 1×1 | 1.200 |
| `messe.ration` | streu | `ort/rom/gemein/rationsbehaelter` neu: versiegelte Ration in Amphorenform | `ort/germanen/gemein/rationsbehaelter` neu: Rationsfass klein | 1×1 | 600 |

**Werkstatt**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `werkstatt.bank` | leit | `ort/rom/station/werkbank` neu: Marmorwerkbank, Amber-Schneidarm unter Bogen (ersetzt Werkbank) | `ort/germanen/station/amboss` neu: Amboss-Presse mit Glutherd | 2×1 | 3.000 |
| `werkstatt.kran` | anker | `ort/rom/station/kran` neu (siehe Lager) | `ort/germanen/station/kran` neu | 1×1 | 1.500 |
| `werkstatt.ladegeraet` | anker | `ort/rom/station/ladegeraet` neu: Werkzeug-Ladeständer an der Rinne | `ort/germanen/station/ladegeraet` neu: Ladepfosten mit Glutschiene | 1×1 | 1.200 |
| `werkstatt.teile` | anker | `ort/rom/station/teileregal` neu: Bogenregal mit Bauteilkästen | `prop/germanen/station/regal` Bestand | 1×1 | 1.500 |
| `werkstatt.schweiss` | anker | `ort/rom/station/schweisser` neu: Schweißgerät mit Amphoren-Gasflasche | `ort/germanen/station/schweisser` neu: Schweißgerät mit Fass-Gasflasche | 1×1 | 1.200 |
| `werkstatt.werkzeug` | streu | `ort/rom/gemein/werkzeugkiste` neu | `ort/germanen/gemein/werkzeugkasten` neu (ersetzt `prop/germanen/gemein/werkzeug`) | 1×1 | 800 |

**Krankenstation**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `kranken.liege` | leit | `ort/rom/station/medliege` neu: Liege unter Scanbogen (der Bogen ist der Scanner) | `ort/germanen/station/medliege` neu: Liege unter Stabgiebel mit Runenscan | 2×1 | 3.000 |
| `kranken.scanner` | anker | `ort/rom/station/scansaeule` neu: Säule mit Sensorring (aus dem Sensorturm) | `ort/germanen/station/scanstele` neu: Runenstein-Scanner (aus dem Verteiler) | 1×1 | 1.500 |
| `kranken.medzelle` | anker | `ort/rom/station/medamphore` neu: weiße Infusions-Amphore | `ort/germanen/station/medfass` neu: Infusionsfass | 1×1 | 1.000 |
| `kranken.schrank` | anker | `ort/rom/station/spind` neu, Variante `med` | `ort/germanen/station/spind` neu, Variante `med` | 1×1 | 1.500 |
| `kranken.licht` | anker | `rom/laterne` Bestand | `prop/germanen/gemein/laterne` Bestand | 1×1 | 1.200 |
| `kranken.medkiste` | streu | `ort/rom/gemein/medkiste` neu | `ort/germanen/gemein/medkiste` neu | 1×1 | 600 |

**Zellen**

| Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| `zellen.feldzelle` | leit | `ort/rom/station/feldzelle` neu: Bogenzelle, Amber-Feldlinie zwischen den Pfeilern | `ort/germanen/station/feldzelle` neu: Stabzelle mit Runenfeld (ersetzt `prop/germanen/gemein/kaefig_zelle`) | 1×1 | 2.500 |
| `zellen.wachpult` | anker | `ort/rom/station/terminal` vorh., Variante `gesperrt` | `ort/germanen/station/terminal` vorh., Variante `gesperrt` | 1×1 | 1.500 |
| `zellen.feldschloss` | anker | `ort/rom/station/feldschloss` neu: Wandkasten mit Feldschalter | `ort/germanen/station/runenschloss` neu | 1×1 | 800 |
| `zellen.pritsche` | anker | `ort/rom/station/pritsche` neu: Klappliege mit Wandbogen | `ort/germanen/station/pritsche` neu: Klappliege mit Eisenrahmen und Fell | 1×1 | 1.000 |
| `zellen.warnbake` | streu | `ort/rom/gemein/bake` neu: Amber-Warnbake | `prop/germanen/gemein/bake_abholpunkt` Bestand | 1×1 | 800 |

### Außenposten

| Gebäudeart / Rolle | Art | Rom | Germanen | Fuß | Ziel |
|---|---|---|---|---|---|
| **Kommando/Funk** `kommando_haus.gebaeude` | leit | `ort/rom/aussenposten/halle` vorh. (4.248) | `ort/germanen/aussenposten/halle` vorh., Stabhalle (4.670) | 8×5 | Bühne |
| `kommando_haus.funk` | anker | `ort/rom/aussenposten/clipeus` vorh. (1.164) | `ort/germanen/gemein/schildantenne` neu | 1×1 | 1.500 |
| `kommando_haus.verteiler` | anker | `ort/rom/gemein/verteiler` vorh. | `ort/germanen/gemein/verteiler` vorh. | 1×1 | 1.500 |
| **Mannschaftsunterkunft** `unterkunft.gebaeude` | leit | `ort/rom/aussenposten/unterkunft` neu: kleine Bogenhalle mit Traufrinne | `ort/germanen/aussenposten/unterkunft` neu: kleine Stabhalle ohne Turm | 6×4 | Bühne |
| `unterkunft.innen` | – | Rollen wie Quartier | Rollen wie Quartier | – | – |
| **Lager mit Energiezellen** `zellenlager.gebaeude` | leit | `ort/rom/aussenposten/zellendepot` neu: offene Arkadenhalle mit Laderinne | `ort/germanen/aussenposten/zellenschuppen` neu: offener Stabschuppen mit Glutschiene | 4×3 | Bühne |
| `zellenlager.regal` | anker | `ort/rom/gemein/zellenarkade` vorh. | `ort/germanen/gemein/fassregal` vorh. | 2×1 | 3.000 |
| `zellenlager.zelle` | streu | `rom/energiezelle` Bestand | `ort/germanen/gemein/fasszelle` vorh. | 1×1 | 1.000 |
| **Wachturm** `wachturm.sensor` | leit | `ort/rom/aussenposten/sensorturm` vorh. (2.270) | `ort/germanen/aussenposten/sensorturm` vorh., Stevendrache (2.198) | 1×1 | 2.500 |
| **Energieverteiler** `verteiler.knoten` | leit | `ort/rom/gemein/verteiler` vorh. | `ort/germanen/gemein/verteiler` vorh. | 1×1 | 1.500 |
| `verteiler.leitung` | anker | `ort/rom/gemein/leitung` vorh. | `ort/germanen/gemein/glutleitung` neu | 2×1 | 3.000 |
| **Landeplatz** `landeplatz.plattform` | leit | `ort/rom/aussenposten/landeplatz` neu: Marmorplattform mit Amberrinnen-Markierung | `ort/germanen/aussenposten/landeplatz` neu: Eisenplattform mit Glutfugen und Kupferpollern (ersetzt `prop/germanen/aussenposten/landeplatz_2x2`, Holz) | 4×4 | 8.000 |
| `landeplatz.leitfeuer` | streu | `ort/rom/aussenposten/leitfeuer` neu: Amber-Leitfeuer auf Bogenpfosten | `ort/germanen/aussenposten/leitfeuer` neu: Glut-Leitfeuer im Eisenkorb (ersetzt `feuerschale`) | 1×1 | 800 |
| **Hof/Straße** `hof.feldgenerator` | anker | `rom/standarte` Bestand | `prop/germanen/aussenposten/runenmast` Bestand | 1×1 | 1.500 |
| `hof.begrenzung` | anker | `rom/barriere` Bestand | `ort/germanen/aussenposten/feldpfahl` neu: Runenpfahl mit Feldlinie | 1×1 | 1.500 |
| `hof.fracht` | streu | `rom/kiste` Bestand | `prop/germanen/gemein/kiste_stapel` Bestand | 1×1 | 1.500 |

Hofbelag und Straße kommen weiter aus den Kits (`kit/rom/aussenposten/boden_belag`, `kit/germanen/...`).

### Neu zu bauende Modelle je Arbeitspaket

| Paket | Modelle | Anzahl |
|---|---|---|
| **2a Rom-Außenposten** | `ort/rom/aussenposten/{unterkunft, zellendepot, landeplatz, leitfeuer}` | 4 |
| **2b Germanen-Außenposten** | `ort/germanen/aussenposten/{unterkunft, zellenschuppen, landeplatz, leitfeuer, feldpfahl}`, `ort/germanen/gemein/{schildantenne, glutleitung}` | 7 |
| **3a Rom-Station** | `ort/rom/station/{kartentisch, clipeus_wand, wandschirm, pumpe, ladebank, kran, koje, spind (+med), hypokaustum, messetafel, amphorenspender, bank, kuehlamphore, werkbank, ladegeraet, teileregal, schweisser, medliege, scansaeule, medamphore, feldzelle, feldschloss, pritsche}`, `ort/rom/gemein/{tafel, rationsbehaelter, werkzeugkiste, medkiste, bake}`, dazu Überarbeitung `rom/zellenregal` (Budget) | 28 + 1 |
| **3b Germanen-Station** | `ort/germanen/station/{kartentisch, blasebalg, ladebock, kran, koje, spind (+med), glutofen, langtisch, bank, kuehlfass, amboss, ladegeraet, schweisser, medliege, scanstele, medfass, feldzelle, runenschloss, pritsche}`, `ort/germanen/gemein/{runenholz, rationsbehaelter, werkzeugkasten, medkiste}` | 23 |

Rom braucht mehr neue Stücke, weil der römische Bestand außer Zellen, Kiste, Laterne und Standarte nur aus Ruinenstücken besteht. Die Germanen haben Wandmonitor, Regal, Met-Kessel, Laterne und Bake im Bestand.
