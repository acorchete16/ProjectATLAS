"""Descarga texturas PBR CC0 de Poly Haven para el visor 3D de la Atlántida.
Cada 'ranura' tiene varios candidatos; se usa el primero que exista.
Salida: data/tex/<ranura>_{d,n,r}.jpg (difuso 1024, normal y rugosidad 512)."""
import io, json, os, sys, urllib.request
from PIL import Image

SLOTS = {
    'stone':   ['castle_wall_slates', 'stone_wall', 'castle_brick_07', 'medieval_blocks_02', 'stone_brick_wall_001'],
    'marble':  ['marble_01', 'white_marble_03', 'marble_tiles', 'marble_cliff_02'],
    'plaster': ['painted_plaster_wall', 'plastered_wall', 'plaster_brick_pattern', 'beige_wall_001'],
    'roof':    ['roof_tiles', 'clay_roof_tiles_02', 'roof_07', 'red_slate_roof_tiles_01'],
    'paving':  ['cobblestone_floor_01', 'cobblestone_floor_001', 'grey_cartago_02', 'stone_tiles_02'],
    'grass':   ['aerial_grass_rock', 'forrest_ground_01', 'leafy_grass', 'coast_land_rocks_01'],
    'sand':    ['aerial_beach_01', 'coast_sand_01', 'sand_01'],
    'metal':   ['metal_plate', 'rusty_metal_02', 'green_metal_rust', 'blue_metal_plate'],
}
UA = {'User-Agent': 'ProjectATLAS/1.0 (texture fetch)'}
OUT = 'data/tex'; os.makedirs(OUT, exist_ok=True)

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

def pick(files, keys, res):
    for k in keys:
        m = files.get(k)
        if not m: continue
        for r in (res, '1k', '2k'):
            if r in m:
                for fmt in ('jpg', 'png'):
                    if fmt in m[r]: return m[r][fmt]['url']
    return None

used = {}
for slot, cands in SLOTS.items():
    ok = False
    for aid in cands:
        try:
            files = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
        except Exception as e:
            print(slot, aid, 'no', e); continue
        maps = {'d': (['Diffuse', 'diff', 'Color'], 1024), 'n': (['nor_gl', 'Normal', 'nor_dx'], 512), 'r': (['Rough', 'rough', 'arm'], 512)}
        got = {}
        for tag, (keys, size) in maps.items():
            u = pick(files, keys, '1k')
            if not u: continue
            im = Image.open(io.BytesIO(get(u))).convert('RGB')
            if tag == 'r' and 'arm' in u: im = im.split()[1].convert('RGB')
            im = im.resize((size, size), Image.LANCZOS)
            im.save(f'{OUT}/{slot}_{tag}.jpg', quality=82 if tag == 'd' else 78, optimize=True)
            got[tag] = u
        if 'd' in got:
            used[slot] = {'asset': aid, 'maps': sorted(got)}; ok = True
            print(slot, '->', aid, sorted(got)); break
    if not ok: print(slot, 'SIN TEXTURA')
json.dump({'source': 'Poly Haven (CC0)', 'slots': used}, open(f'{OUT}/credits.json', 'w'), indent=1)
if not used: sys.exit(1)
