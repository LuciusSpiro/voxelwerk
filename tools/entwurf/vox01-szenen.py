# Erzeugt die Richtungsszenen VOX-01 (Entwurf): assets/scenes/vox01-richtung-<a|b|c>.json
# und je Variante eine Baum-Nahansicht vox01-richtung-<v>-baeume.json.
# Aufruf: python tools/entwurf/vox01-szenen.py
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

VARIANTEN = {
    'a': {'name': 'Feldlager (Holz und Messing, Detailbäume)', 'palette': 'sommer_wald', 'mood': 'planet_day', 'posten': 2.75},
    'b': {'name': 'Via Appia (Kastell-Material, Pinie und Steineiche)', 'palette': 'planet_mediterran', 'mood': 'planet_day', 'posten': 2.5},
    'c': {'name': 'Grobvoxel (Flechtwerk, Bäume in 25-cm-Voxeln)', 'palette': 'sommer_wald', 'mood': 'planet_day', 'posten': 2.5},
}
W, D = 22, 13
# Zeilen z = 0 (Norden, hinten) … 13 (Süden, Kamera)
# w Waldboden, k Wall-Unterlage, g Grabensohle, p Palisadenstreifen, m Wiese
ROWS = ['w' * W] * 5 + ['k' * 14 + 'w' * 8] * 2 + ['g' * W] * 2 + ['p' * W] + ['m' * W] * 3

TREES = [  # (Art, x, z, seed): Kronendach schließt sich bei 2–3 m Abstand
    ('nadelbaum', 1.5, 0.5, 1), ('laubbaum', 3.5, 2.5, 2), ('nadelbaum', 5.5, 0.5, 3),
    ('laubbaum', 7.5, 2.5, 4), ('nadelbaum', 9.5, 0.5, 5), ('laubbaum', 10.5, 3.5, 6),
    ('nadelbaum', 14.5, 3.5, 7), ('laubbaum', 13.5, 1.5, 8), ('nadelbaum', 16.5, 1.5, 9),
    ('laubbaum', 17.5, 4.5, 10), ('nadelbaum', 19.5, 2.5, 11), ('laubbaum', 20.5, 6.5, 12),
    ('nadelbaum', 18.5, 7.5, 13),
]

def terrain(v):
    leg = {
        'w': {'h': 1, 'top': 'grass_dark', 'fill': 'soil'},
        'k': {'h': 1, 'top': 'grass_dark', 'fill': 'soil'},
        'g': {'h': 1, 'top': {'b': 'soil', 'a': 'soil', 'c': 'soil'}[v], 'fill': 'soil_dark'},
        'p': {'h': 1, 'top': 'grass', 'fill': 'soil'},
        'm': {'h': 1, 'top': 'grass', 'fill': 'soil'},
    }
    return {'palette': VARIANTEN[v]['palette'], 'depth': 2, 'jitter': 0, 'legend': leg, 'rows': ROWS}

def scene(v):
    m = f'entwurf/vox01/{v}/'
    place = [{'model': m + 'wall', 'at': [7, 6], 'params': {'len': 14}}]
    place.append({'model': m + 'wachposten', 'at': [12, 6], 'lift': 0.5})
    for i in range(8):
        conn = (2 if i < 7 else 0) + (8 if i > 0 else 0)
        place.append({'model': m + 'palisade', 'at': [3.5 + i, 9.5], 'params': {'conn': conn, 'seed': i}})
    # Vergleich: hoher Zaun aus dem Rom-Kit, zwei Stücke in derselben Linie
    place.append({'model': 'kit/rom/zaun', 'at': [14.5, 9.5], 'params': {'conn': 2, 'art': 'aussenposten'}})
    place.append({'model': 'kit/rom/zaun', 'at': [15.5, 9.5], 'params': {'conn': 8, 'art': 'aussenposten'}})
    for art, x, z, s in TREES:
        place.append({'model': m + art, 'at': [x, z], 'params': {'seed': s}})
    return {
        'id': f'vox01-richtung-{v}',
        'name': f'VOX-01 Richtung {v.upper()}: ' + VARIANTEN[v]['name'],
        'palette': VARIANTEN[v]['palette'],
        'mood': VARIANTEN[v]['mood'],
        'terrain': terrain(v),
        'place': place,
        'scatter': [{'model': ['natur/gras'], 'on': 'm', 'density': 0.25, 'perCell': 2, 'palette': VARIANTEN[v]['palette']}],
        'figures': [
            {'figure': 'rom/legionaer', 'at': [6.5, 8.6], 'rot': 0, 'pose': 'guard'},
            {'figure': 'rom/legionaer', 'at': [12, 6], 'lift': 0.5 + VARIANTEN[v]['posten'], 'rot': 0, 'pose': 'aim'},
        ],
        'cameras': {
            'spiel': {'target': [11, 1, 6.2], 'dist': 21.0, 'elev': 57, 'az': 0, 'fov': 30},
            'schraeg': {'target': [10, 1.5, 6.5], 'dist': 16, 'elev': 30, 'az': 25, 'fov': 30},
        },
    }

def baeume(v):
    m = f'entwurf/vox01/{v}/'
    rows = ['m' * 25] * 5
    place = []
    for k in range(6):   # Nadel/Laub im Wechsel, seed 1, 2, 3
        art = 'nadelbaum' if k % 2 == 0 else 'laubbaum'
        place.append({'model': m + art, 'at': [1.5 + k * 3, 2.5], 'params': {'seed': k // 2 + 1}})
    place.append({'model': m + 'nadelbaum', 'at': [19.5, 2.5], 'params': {'seed': 1, 'teil': 1}})
    place.append({'model': m + 'laubbaum', 'at': [21.5, 2.5], 'params': {'seed': 1, 'teil': 1}})
    return {
        'id': f'vox01-richtung-{v}-baeume',
        'name': f'VOX-01 Richtung {v.upper()}: Nadel/Laub, seed 1–3; rechts nur Stamm (Krone ausgeblendet)',
        'palette': VARIANTEN[v]['palette'], 'mood': VARIANTEN[v]['mood'],
        'terrain': {'palette': VARIANTEN[v]['palette'], 'depth': 1, 'jitter': 0,
                    'legend': {'m': {'h': 1, 'top': 'grass', 'fill': 'soil'}}, 'rows': rows},
        'place': place,
        'figures': [{'figure': 'rom/legionaer', 'at': [23.2, 2.5], 'rot': 0, 'pose': 'stand'}],
        'cameras': {'nah': {'target': [12, 2.6, 2.5], 'dist': 28, 'elev': 14, 'az': 0, 'fov': 30},
                    'oben': {'target': [11.5, 1, 2.5], 'dist': 26, 'elev': 57, 'az': 0, 'fov': 30}},
    }

for v in VARIANTEN:
    if not os.path.exists(os.path.join(ROOT, 'assets/models/entwurf/vox01', v, 'palisade.json')):
        continue
    for sc in (scene(v), baeume(v)):
        with open(os.path.join(ROOT, 'assets/scenes', sc['id'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(sc, f, ensure_ascii=False, indent=1)
        print('geschrieben', sc['id'])
