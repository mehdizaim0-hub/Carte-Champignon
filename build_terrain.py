#!/usr/bin/env python3
"""Enrichissement one-shot du terrain : pH du sol (SoilGrids/ISRIC) et type de
foret (IGN BD Foret v2) pour chaque maille de la grille.

A lancer UNE SEULE FOIS (ou apres un changement de grille) :
    python build_terrain.py
Produit terrain.json, a commiter avec le reste. Le script reprend la ou il
s'est arrete si on le relance (cache incremental dans terrain.json).
Duree : ~20-40 min (2 appels distants par maille, en douceur pour les serveurs).
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data.json")
OUT = os.path.join(HERE, "terrain.json")

SOILGRIDS = "https://rest.isric.org/soilgrids/v2.0/properties/query"
IGN_WMS = "https://data.geopf.fr/wms-v/ows"


def get_json(url, timeout=25, tries=4):
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "carte-champignons/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(4 * (a + 1))
    print("  abandon: %s (%s)" % (url[:80], last), file=sys.stderr)
    return None


def fetch_ph(lat, lon):
    """pH H2O 0-5cm (SoilGrids 250m). None si pas de donnee (ville, eau)."""
    q = urllib.parse.urlencode({"lon": lon, "lat": lat, "property": "phh2o",
                                "depth": "0-5cm", "value": "mean"})
    j = get_json(SOILGRIDS + "?" + q)
    try:
        v = j["properties"]["layers"][0]["depths"][0]["values"]["mean"]
        return round(v / 10.0, 1) if v is not None else None
    except Exception:
        return None


def fetch_forest(lat, lon):
    """Type de foret IGN BD Foret v2 au point : 'f' feuillus, 'r' resineux,
    'm' mixte, '' si pas de foret a cet endroit."""
    d = 0.004
    q = urllib.parse.urlencode({
        "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetFeatureInfo",
        "LAYERS": "LANDCOVER.FORESTINVENTORY.V2",
        "QUERY_LAYERS": "LANDCOVER.FORESTINVENTORY.V2",
        "CRS": "EPSG:4326",
        "BBOX": "%f,%f,%f,%f" % (lat - d, lon - d, lat + d, lon + d),
        "WIDTH": 10, "HEIGHT": 10, "I": 5, "J": 5,
        "INFO_FORMAT": "application/json",
    })
    j = get_json(IGN_WMS + "?" + q)
    if not j or not j.get("features"):
        return ""
    p = j["features"][0].get("properties", {})
    txt = ((p.get("tfv_g11") or "") + " " + (p.get("tfv") or "") + " " + (p.get("essence") or "")).lower()
    if "mixte" in txt:
        return "m"
    if "feuillus" in txt:
        return "f"
    if "conif" in txt or "pin" in txt or "sapin" in txt or "epicea" in txt or "épicéa" in txt:
        return "r"
    return "m"  # foret presente mais essence non renseignee


def main():
    if not os.path.exists(DATA):
        raise SystemExit("ERREUR : data.json introuvable. Lance d'abord build_data.py.")
    cells = json.load(open(DATA, encoding="utf-8"))["cells"]
    pts = [(c[0], c[1]) for c in cells]

    terrain = {}
    if os.path.exists(OUT):
        terrain = json.load(open(OUT, encoding="utf-8"))
        print("reprise : %d mailles deja faites" % len(terrain))

    todo = [(la, lo) for la, lo in pts if "%s,%s" % (la, lo) not in terrain]
    print("%d mailles a enrichir (pH du sol + foret)" % len(todo))

    for n, (lat, lon) in enumerate(todo, 1):
        key = "%s,%s" % (lat, lon)
        ph = fetch_ph(lat, lon)
        fo = fetch_forest(lat, lon)
        terrain[key] = {"ph": ph, "fo": fo}
        if n % 25 == 0 or n == len(todo):
            json.dump(terrain, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
            print("  %d/%d (sauvegarde)" % (n, len(todo)))
        time.sleep(0.35)  # douceur avec les serveurs publics

    json.dump(terrain, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    n_ph = sum(1 for v in terrain.values() if v["ph"] is not None)
    n_fo = sum(1 for v in terrain.values() if v["fo"])
    print("OK : terrain.json ecrit (%d mailles, pH connu %d, foret presente %d)"
          % (len(terrain), n_ph, n_fo))


if __name__ == "__main__":
    main()
