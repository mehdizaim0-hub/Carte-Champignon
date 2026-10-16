#!/usr/bin/env python3
"""Relief à fine échelle : altitude, pente, exposition et position topographique, par blocs d'environ 2,8 km.

Source : tuiles d'altitude AWS « Terrain Tiles » (format terrarium, niveau 10, environ 106 m par pixel à 46° N), assemblées
en une mosaïque ; pente et exposition calculées par différences centrées. Écrit relief.json (octets en base64, du sud au nord,
d'ouest en est, même grille que sol.json) :
  elev  : altitude moyenne du bloc, en pas de 20 m                  (ex. 15 = 300 m)
  slope : pente moyenne, en degrés
  north : exposition nord, de -1 (versant sud raide) à +1 (versant nord raide), codée 0 à 254 (127 = plat)
          = moyenne de cos(azimut du versant) x min(pente, 30°) / 30
  tpi   : position topographique, en mètres, de -100 (fond de vallon) à +100 (crête), codée 0 à 254 (127 = neutre)
          = altitude du pixel moins la moyenne dans un rayon d'environ 500 m
  255 = pas de donnée (mer...).

Prérequis : pip install numpy pillow     Lancer : python build_relief.py     Durée : 3 à 10 minutes.
Option --synthetic : jeu fictif pour tester la chaîne sans réseau.
"""
import base64, io, json, math, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
DATA, OUT = os.path.join(HERE, "data.json"), os.path.join(HERE, "relief.json")
Z = 10
N = 2 ** Z
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png"
K = 6
UNKNOWN = 255
BBOX = (41.0, 51.6, -5.6, 10.0)       # lat min, lat max, lon min, lon max
NODATA = -32768
TPI_R = 5                              # rayon en pixels (environ 500 m)


def steps(vals):
    u = sorted(set(vals)); return min(b - a for a, b in zip(u, u[1:]))


def grid():
    cells = json.load(open(DATA, encoding="utf-8"))["cells"]
    la, lo = [c[0] for c in cells], [c[1] for c in cells]
    dla, dlo = steps(la), steps(lo)
    la0, lo0 = min(la), min(lo)
    ni, nj = round((max(la) - la0) / dla) + 1, round((max(lo) - lo0) / dlo) + 1
    return dict(W=nj * K, H=ni * K, west=lo0 - dlo / 2, top=la0 - dla / 2 + ni * dla, bo=dlo / K, bl=dla / K)


def tile_of(lat, lon):
    x = int((lon + 180) / 360 * N)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N)
    return x, y


def decode(b):
    try:
        from PIL import Image
        a = np.asarray(Image.open(io.BytesIO(b)).convert("RGB")).astype(np.float32)
    except ImportError:
        from build_forets import png_decode
        w, h, px = png_decode(b)
        a = np.array([[p[:3] for p in row] for row in px], dtype=np.float32)
    return (a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768)


def fetch(xy):
    x, y = xy
    for a in range(4):
        try:
            req = urllib.request.Request(URL % (Z, x, y), headers={"User-Agent": "carte-champignons/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return xy, decode(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 404): return xy, None          # tuile absente (mer) : pas de donnée
            time.sleep(2 * (a + 1))
        except Exception:
            time.sleep(2 * (a + 1))
    print("  abandon tuile", xy, file=sys.stderr); return xy, None


def process(mosaic, x0, y0, g, strip=512):
    """mosaic : int16 (hauteur, largeur), NODATA = pas de donnée. Retourne 4 tableaux uint8 (nord -> sud) de forme (H, W) de blocs."""
    Hm, Wm = mosaic.shape
    n_pix = N * 256
    cols = x0 * 256 + np.arange(Wm)
    lon = (cols + .5) / n_pix * 360 - 180
    cidx = np.floor((lon - g["west"]) / g["bo"]).astype(np.int64)
    H, W = g["H"], g["W"]
    S = {k: np.zeros(H * W) for k in ("elev", "slope", "north", "tpi", "n")}
    halo = TPI_R + 2
    for r0 in range(0, Hm, strip):
        r1 = min(Hm, r0 + strip)
        a0, a1 = max(0, r0 - halo), min(Hm, r1 + halo)
        e = mosaic[a0:a1].astype(np.float32)
        valid = e > NODATA + 1
        valid &= e > -1.5
        e = np.where(valid, e, np.nan)
        rows = y0 * 256 + np.arange(a0, a1)
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (rows + .5) / n_pix))))
        px = (156543.03392 * np.cos(np.radians(lat)) / N)[:, None]           # mètres par pixel (Mercator conforme)
        gx = np.full_like(e, np.nan); gn = np.full_like(e, np.nan)
        gx[:, 1:-1] = (e[:, 2:] - e[:, :-2]) / (2 * px)                        # dz/dx vers l'est
        gn[1:-1, :] = (e[:-2, :] - e[2:, :]) / (2 * px[1:-1])                  # dz/dy vers le nord
        mag = np.hypot(gx, gn)
        slope = np.degrees(np.arctan(mag))
        with np.errstate(invalid="ignore", divide="ignore"):
            cosaz = np.where(mag > 1e-6, -gn / mag, 0.0)                        # cos(azimut du versant) : +1 si le versant regarde le nord
        north = cosaz * np.minimum(slope, 30) / 30
        # position topographique : altitude - moyenne dans un carré de rayon TPI_R (somme cumulée, NaN ignorés)
        f = np.where(np.isnan(e), 0, e); c = (~np.isnan(e)).astype(np.float32)
        def box(a):
            p = np.pad(a, TPI_R, mode="constant"); s = p.cumsum(0).cumsum(1)
            k = 2 * TPI_R + 1; s = np.pad(s, ((1, 0), (1, 0)))
            return s[k:, k:][:a.shape[0], :a.shape[1]] - s[:-k, k:][:a.shape[0], :a.shape[1]] - s[k:, :-k][:a.shape[0], :a.shape[1]] + s[:-k, :-k][:a.shape[0], :a.shape[1]]
        sm, cn = box(f), box(c)
        with np.errstate(invalid="ignore", divide="ignore"):
            tpi = e - sm / cn
        sel = slice(r0 - a0, r1 - a0)
        e, slope, north, tpi, lat = e[sel], slope[sel], north[sel], tpi[sel], lat[sel]
        ridx = np.floor((g["top"] - lat) / g["bl"]).astype(np.int64)
        ok = ~np.isnan(e) & ~np.isnan(slope) & ~np.isnan(north) & ~np.isnan(tpi)
        ok &= (ridx[:, None] >= 0) & (ridx[:, None] < H) & (cidx[None, :] >= 0) & (cidx[None, :] < W)
        idx = (ridx[:, None] * W + cidx[None, :])[ok]
        for k, v in (("elev", e), ("slope", slope), ("north", north), ("tpi", tpi)):
            S[k] += np.bincount(idx, weights=v[ok], minlength=H * W)
        S["n"] += np.bincount(idx, minlength=H * W)
    n = S["n"]; good = n >= 100
    with np.errstate(invalid="ignore", divide="ignore"):
        m = {k: np.where(good, S[k] / n, np.nan) for k in ("elev", "slope", "north", "tpi")}
    out = {
        "elev": np.where(good, np.clip(np.rint(m["elev"] / 20), 0, 254), UNKNOWN),
        "slope": np.where(good, np.clip(np.rint(m["slope"]), 0, 90), UNKNOWN),
        "north": np.where(good, np.clip(np.rint(127 + 127 * m["north"]), 0, 254), UNKNOWN),
        "tpi": np.where(good, np.clip(np.rint(127 + 1.27 * np.clip(m["tpi"], -100, 100)), 0, 254), UNKNOWN),
    }
    return {k: v.reshape(H, W).astype(np.uint8) for k, v in out.items()}


def main():
    g = grid()
    print("grille %d x %d blocs" % (g["W"], g["H"]))
    if "--synthetic" in sys.argv:
        ii, jj = np.mgrid[0:g["H"], 0:g["W"]]
        lat = g["top"] - (ii + .5) * g["bl"]
        arr = {"elev": np.clip(10 + (lat - 41) * 8, 0, 254), "slope": np.full(ii.shape, 8.0), "north": np.full(ii.shape, 127 + 40.0), "tpi": np.full(ii.shape, 127.0)}
        res = {k: v.astype(np.uint8) for k, v in arr.items()}
    else:
        x0, y1 = tile_of(BBOX[1], BBOX[2]); x1, y0 = tile_of(BBOX[0], BBOX[3])   # y croît vers le sud
        y0, y1 = y1, y0
        xs, ys = range(x0, x1 + 1), range(y0, y1 + 1)
        print("%d x %d tuiles (z%d)" % (len(xs), len(ys), Z))
        mosaic = np.full(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), NODATA, dtype=np.int16)
        t0 = time.time(); done = 0
        with ThreadPoolExecutor(8) as ex:
            for (x, y), a in ex.map(fetch, [(x, y) for y in ys for x in xs]):
                if a is not None:
                    mosaic[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = np.rint(a).astype(np.int16)
                done += 1
                if done % 200 == 0: print("  %d tuiles (%.0f s)" % (done, time.time() - t0), flush=True)
        print("mosaïque %d x %d ; calcul des pentes et expositions..." % mosaic.shape[::-1], flush=True)
        res = process(mosaic, x0, y0, g)
    layers = {}
    for k, a in res.items():
        v = a[a != UNKNOWN]
        print("%-5s sans donnée %5.1f %% | min %s médiane %s max %s" % (k, 100 * (a == UNKNOWN).mean(), v.min() if v.size else "-", int(np.median(v)) if v.size else "-", v.max() if v.size else "-"))
        layers[k] = base64.b64encode(np.flipud(a).tobytes()).decode()
    json.dump({"K": K, "w": g["W"], "h": g["H"], "unknown": UNKNOWN,
               "units": {"elev": "x20 m", "slope": "degrés", "north": "127+127*exposition nord", "tpi": "127+1.27*m"}, "layers": layers},
              open(OUT, "w"), separators=(",", ":"))
    print("OK : relief.json (%d Ko)" % (os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()
