"""Recursos reales para la escena de la Svalbard Global Seed Vault (ATLAS · Base de datos).
1) Relieve REAL: Copernicus DEM GLO-30 (ESA, licencia abierta) de la hoja N78 E015, recortado alrededor
   de la bóveda (Platåberget, 78.2357 N, 15.4913 E) → data/svb/dem.png (16 bits) + dem.json (escala y origen).
2) Texturas PBR CC0 de Poly Haven: nieve, roca, hormigón, roca de túnel, metal → data/svb/<ranura>_{d,n,r}.jpg
Se ejecuta en GitHub Actions (desde el navegador no se puede acceder a estas fuentes)."""
import io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image
OUT = 'data/svb'; os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'ProjectATLAS/1.0 (asset fetch)'}
get = lambda u, t=120: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
credits = {'dem': None, 'textures': {}}

# ---------- 1 · relieve ----------
VLAT, VLON = 78.23565, 15.49112          # entrada de la bóveda (aprox.)
HALF_KM = 6.0                             # 12 × 12 km: Platåberget, Adventdalen, Isfjorden y el aeropuerto
N = 768
try:
    import rasterio
    from rasterio.enums import Resampling
    url = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N78_00_E015_00_DEM/Copernicus_DSM_COG_10_N78_00_E015_00_DEM.tif'
    with rasterio.open(url) as ds:
        dlat = HALF_KM / 111.32; dlon = HALF_KM / (111.32 * math.cos(math.radians(VLAT)))
        win = rasterio.windows.from_bounds(VLON - dlon, VLAT - dlat, VLON + dlon, VLAT + dlat, ds.transform)
        z = ds.read(1, window=win, out_shape=(N, N), resampling=Resampling.cubic).astype('float32')
    z[z < -50] = 0
    zmin, zmax = float(z.min()), float(z.max())
    q = np.clip((z - zmin) / (zmax - zmin) * 65535, 0, 65535).astype('uint16')
    Image.fromarray(q, mode='I;16').save(f'{OUT}/dem.png')
    json.dump({'size_m': HALF_KM * 2000, 'px': N, 'zmin': zmin, 'zmax': zmax, 'center': [VLAT, VLON],
               'source': 'Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, distribuido por la ESA)'}, open(f'{OUT}/dem.json', 'w'))
    credits['dem'] = 'Copernicus DEM GLO-30'
    print('DEM', zmin, zmax)
except Exception as e:
    print('DEM falló:', e)

# ---------- 2 · texturas ----------
SLOTS = {
    'snow':     ['snow_02', 'snow_03', 'snow_field_aerial', 'snow_01'],
    'rock':     ['rock_face_03', 'rock_face', 'rocks_ground_02', 'aerial_rocks_02', 'cliff_side'],
    'scree':    ['aerial_rocks_02', 'aerial_rocks_04', 'rocky_terrain_02', 'gravel_floor_02'],
    'concrete': ['concrete_wall_008', 'concrete_wall_006', 'concrete_wall_004', 'concrete_floor_worn_001'],
    'shotcrete':['rock_wall_08', 'rock_wall_10', 'rough_plaster_04', 'concrete_rock_path'],
    'floor':    ['concrete_floor_02', 'concrete_floor_worn_001', 'concrete_floor_01'],
    'metal':    ['metal_plate', 'metal_plate_02', 'rusty_metal_02', 'corrugated_iron'],
}
def pick(files, keys):
    for k in keys:
        m = files.get(k)
        if not m: continue
        for r in ('1k', '2k'):
            if r in m:
                for f in ('jpg', 'png'):
                    if f in m[r]: return m[r][f]['url']
for slot, cands in SLOTS.items():
    for aid in cands:
        try: files = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
        except Exception as e: print(slot, aid, 'no', e); continue
        got = []
        for tag, keys, size in (('d', ['Diffuse', 'diff', 'Color'], 1024), ('n', ['nor_gl', 'Normal'], 1024), ('r', ['Rough', 'rough', 'arm'], 512)):
            u = pick(files, keys)
            if not u: continue
            im = Image.open(io.BytesIO(get(u))).convert('RGB')
            if tag == 'r' and 'arm' in u: im = im.split()[1].convert('RGB')
            im.resize((size, size), Image.LANCZOS).save(f'{OUT}/{slot}_{tag}.jpg', quality=84 if tag == 'd' else 80, optimize=True)
            got.append(tag)
        if 'd' in got:
            credits['textures'][slot] = aid; print(slot, '->', aid, got); break
credits['textures_source'] = 'Poly Haven (CC0)'
json.dump(credits, open(f'{OUT}/credits.json', 'w'), indent=1)
if not credits['textures'] and not credits['dem']: sys.exit(1)
