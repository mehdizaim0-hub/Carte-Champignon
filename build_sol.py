#!/usr/bin/env python3
"""Sol à fine échelle (SoilGrids 2.0, ISRIC) : pH, sable, argile et carbone organique, par blocs d'environ 2,8 km.

Lit directement les cartes SoilGrids (250 m) par HTTP, les moyenne sur la grille de la carte (6 x 6 blocs par maille de
17 km, alignée sur forets.json) et écrit sol.json (octets codés en base64, du sud au nord, d'ouest en est) :
  ph   : pH de l'eau x 10, couche 0-5 cm       (ex. 56 = pH 5,6)
  sand : sable en %, couche 5-15 cm            clay : argile en %, couche 5-15 cm      (limon = 100 - sable - argile)
  soc  : carbone organique en g/kg, couche 0-5 cm (plafonné à 254)
  255 = pas de donnée (zones urbaines, eau...).

Prérequis : pip install rasterio numpy      Lancer : python build_sol.py     Durée : 10 à 25 minutes.
Option --synthetic : jeu de données fictif pour tester la chaîne sans réseau.
Licence des données : CC BY 4.0, ISRIC - World Soil Information (SoilGrids).
"""
import base64, json, os, sys, time
from concurrent.futures import ProcessPoolExecutor

import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
DATA, OUT = os.path.join(HERE, "data.json"), os.path.join(HERE, "sol.json")
K = 6
BASE = "/vsicurl/https://files.isric.org/soilgrids/latest/data/%s/%s_%s_mean.vrt"
# nom -> (propriété SoilGrids, profondeur, diviseur pour passer à l'unité finale)
LAYERS = {"ph": ("phh2o", "0-5cm", 1.0), "sand": ("sand", "5-15cm", 10.0), "clay": ("clay", "5-15cm", 10.0), "soc": ("soc", "0-5cm", 10.0)}
UNKNOWN = 255


def steps(vals):
    u = sorted(set(vals)); return min(b - a for a, b in zip(u, u[1:]))


def grid():
    cells = json.load(open(DATA, encoding="utf-8"))["cells"]
    la, lo = [c[0] for c in cells], [c[1] for c in cells]
    dla, dlo = steps(la), steps(lo)
    la0, lo0 = min(la), min(lo)
    ni, nj = round((max(la) - la0) / dla) + 1, round((max(lo) - lo0) / dlo) + 1
    return dict(dla=dla, dlo=dlo, la0=la0, lo0=lo0, ni=ni, nj=nj, W=nj * K, H=ni * K,
                west=lo0 - dlo / 2, top=la0 - dla / 2 + ni * dla, bo=dlo / K, bl=dla / K)


def read_layer(args):
    """Lit une couche sur la grille (processus séparé). Retourne (nom, tableau uint8 nord->sud, pourcentage de blocs sans donnée)."""
    name, g = args
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    from rasterio.vrt import WarpedVRT
    from rasterio.windows import Window
    prop, depth, div = LAYERS[name]
    url = BASE % (prop, prop, depth)
    out = np.full((g["H"], g["W"]), UNKNOWN, dtype=np.uint8)
    t0 = time.time()
    with rasterio.Env(GDAL_HTTP_MULTIPLEX="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", VSI_CACHE="TRUE", GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="3"):
        with rasterio.open(url) as src:
            nod = src.nodata
            dst = from_origin(g["west"], g["top"], g["bo"], g["bl"])
            with WarpedVRT(src, crs="EPSG:4326", transform=dst, width=g["W"], height=g["H"], resampling=Resampling.average, nodata=nod) as v:
                step = 48
                for r0 in range(0, g["H"], step):
                    for c0 in range(0, g["W"], step):
                        w, h = min(step, g["W"] - c0), min(step, g["H"] - r0)
                        for essai in range(3):
                            try:
                                a = v.read(1, window=Window(c0, r0, w, h)).astype(np.float32); break
                            except Exception as e:
                                print("  %s : nouvel essai (%s)" % (name, e), file=sys.stderr, flush=True); time.sleep(5); a = None
                        if a is None: continue
                        ok = (a != nod) & np.isfinite(a)
                        val = np.where(ok, a / div, UNKNOWN)
                        val = np.clip(np.rint(val), 0, 254)
                        out[r0:r0 + h, c0:c0 + w] = np.where(ok, val, UNKNOWN).astype(np.uint8)
                    print("  %s : %d/%d lignes (%.0f s)" % (name, min(r0 + step, g["H"]), g["H"], time.time() - t0), flush=True)
    return name, out, float((out == UNKNOWN).mean() * 100)


def synthetic(name, g):
    """Données fictives pour tester l'orientation : pH croissant vers le nord, sable croissant vers l'est."""
    ii, jj = np.mgrid[0:g["H"], 0:g["W"]]
    lat = g["top"] - (ii + .5) * g["bl"]; lon = g["west"] + (jj + .5) * g["bo"]
    if name == "ph": a = 40 + (lat - 41) * 6
    elif name == "sand": a = 10 + (lon + 5) * 5
    elif name == "clay": a = 10 + 0 * lat
    else: a = 20 + 0 * lat
    return name, np.clip(a, 0, 254).astype(np.uint8), 0.0


def main():
    g = grid(); syn = "--synthetic" in sys.argv
    print("grille %d x %d blocs (maille %.2f x %.2f deg, %d x %d mailles)" % (g["W"], g["H"], g["dla"], g["dlo"], g["ni"], g["nj"]))
    jobs = [(n, g) for n in LAYERS]
    if syn: res = [synthetic(n, g) for n, _ in jobs]
    else:
        with ProcessPoolExecutor(len(jobs)) as ex: res = list(ex.map(read_layer, jobs))
    layers = {}
    for name, arr, unk in res:
        valid = arr[arr != UNKNOWN]
        print("%-5s sans donnée %5.1f %% | min %s médiane %s max %s" % (name, unk, valid.min() if valid.size else "-", int(np.median(valid)) if valid.size else "-", valid.max() if valid.size else "-"))
        layers[name] = base64.b64encode(np.flipud(arr).tobytes()).decode()      # sud -> nord
    json.dump({"K": K, "w": g["W"], "h": g["H"], "unknown": UNKNOWN, "units": {"ph": "pH x10", "sand": "%", "clay": "%", "soc": "g/kg"}, "layers": layers},
              open(OUT, "w"), separators=(",", ":"))
    print("OK : sol.json (%d Ko)" % (os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()
