#!/usr/bin/env python3
"""Zones artificialisées (agglomérations, zones industrielles) : CORINE Land Cover 2018 via l'IGN.

Pour chaque maille de la grille, demande l'image CORINE (144x144 px) et marque les blocs de 1,4 km dont au moins
30 % de la surface est artificialisée (tissu urbain, zones industrielles et commerciales, réseaux, équipements...).
et ceux dont au moins 35 % sont des milieux ouverts semi-naturels (prairies, pelouses, mosaïques agricoles, agroforesterie).
Résultat : urbain.json  (clé "lat,lon" -> 144 caractères, nord->sud, ouest->est) :
  # artificialisé | p prairie ou milieu ouvert semi-naturel | . autre (forêt, cultures intensives, vignes, eau...).

Lancer : python build_urbain.py   (reprend là où il s'est arrêté). Durée : 10 à 20 min. Aucune dépendance.
Limite : CORINE ne cartographie que les surfaces de plus de 25 ha : les petits villages échappent au masque.
"""
import colorsys, json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from build_forets import png_decode, steps, K

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
DATA, OUT = os.path.join(HERE, "data.json"), os.path.join(HERE, "urbain.json")
WMS, LAYER = "https://data.geopf.fr/wms-r/wms", "LANDCOVER.CLC18_FR"
PX = 12            # pixels par bloc : image de 144 px
SEUIL = 0.30
SEUIL_OUVERT = 0.35
VERSION = 2
WORKERS = 3
_cache = {}


def artificiel(px):
    """Rouges, magentas, violets et roses de la légende CORINE (classes 11x à 14x). Les marais (bleu-violet), les
    vignobles et vergers (orange) ne sont pas touchés."""
    r, g, b, a = px
    if a < 128: return False
    k = (r, g, b)
    v = _cache.get(k)
    if v is None:
        h, s, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); h *= 360
        v = s >= .30 and (h >= 270 or h <= 12)
        _cache[k] = v
    return v


# Milieux ouverts semi-naturels de la légende CORINE : prairies 231, mosaïques agricoles 242, agriculture avec végétation
# naturelle 243, agroforesterie 244, pelouses naturelles 321. (Cultures 211-213, vignes, vergers : exclus.)
OUVERT = [(230, 230, 77), (255, 230, 166), (230, 204, 77), (242, 204, 166), (204, 242, 77)]
_cache_o = {}


def ouvert(px):
    r, g, b, a = px
    if a < 128: return False
    k = (r, g, b)
    v = _cache_o.get(k)
    if v is None:
        v = any((r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2 <= 20 ** 2 for c in OUVERT)
        _cache_o[k] = v
    return v


def resume(w, h, px):
    bw, bh = w // K, h // K; out = []
    for by in range(K):
        for bx in range(K):
            n = m = 0
            for y in range(by * bh, (by + 1) * bh):
                row = px[y]
                for x in range(bx * bw, (bx + 1) * bw):
                    if artificiel(row[x]): n += 1
                    elif ouvert(row[x]): m += 1
            t = bw * bh
            out.append("#" if n / t >= SEUIL else "p" if m / t >= SEUIL_OUVERT else ".")
    return "".join(out)


def fetch_cell(lat, lon, dlat, dlon):
    q = urllib.parse.urlencode({"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": LAYER, "STYLES": "",
        "CRS": "EPSG:4326", "BBOX": "%f,%f,%f,%f" % (lat - dlat / 2, lon - dlon / 2, lat + dlat / 2, lon + dlon / 2),
        "WIDTH": K * PX, "HEIGHT": K * PX, "FORMAT": "image/png", "TRANSPARENT": "TRUE"})
    err = None
    for a in range(3):
        try:
            req = urllib.request.Request(WMS + "?" + q, headers={"User-Agent": "carte-champignons/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return resume(*png_decode(r.read()))
        except Exception as e:
            err = e; time.sleep(3 * (a + 1))
    print("  abandon %s,%s : %s" % (lat, lon, err), file=sys.stderr)
    return None


def main():
    cells = json.load(open(DATA, encoding="utf-8"))["cells"]
    pts = [(c[0], c[1]) for c in cells]
    dlat, dlon = steps([p[0] for p in pts]), steps([p[1] for p in pts])
    res = {}
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding="utf-8"))
        if old.get("px") == PX and old.get("v") == VERSION: res = old.get("cells", {}); print("reprise : %d mailles" % len(res))
    todo = [p for p in pts if "%s,%s" % p not in res]
    print("%d mailles à traiter" % len(todo))
    t0 = time.time()
    def save():
        tmp = OUT + ".tmp"
        json.dump({"K": K, "px": PX, "v": VERSION, "cells": res}, open(tmp, "w", encoding="utf-8"), separators=(",", ":")); os.replace(tmp, OUT)
    def work(p):
        time.sleep(0.1); return p, fetch_cell(p[0], p[1], dlat, dlon)
    done = 0
    for i in range(0, len(todo), 60):
        with ThreadPoolExecutor(WORKERS) as ex:
            for (lat, lon), s in ex.map(work, todo[i:i + 60]):
                if s is not None: res["%s,%s" % (lat, lon)] = s
                done += 1
        save(); print("  %d/%d (%.0f s)" % (done, len(todo), time.time() - t0), flush=True)
        if len(sys.argv) > 2 and sys.argv[1] == "--max-seconds" and time.time() - t0 > float(sys.argv[2]) and done < len(todo):
            print("temps imparti atteint : relancer pour continuer"); return
    save()
    n = sum(s.count("#") for s in res.values()); o = sum(s.count("p") for s in res.values())
    print("OK : urbain.json (%d mailles, %d blocs artificialisés, %d blocs ouverts semi-naturels, sur %d)" % (len(res), n, o, 144 * len(res)))


if __name__ == "__main__":
    main()
