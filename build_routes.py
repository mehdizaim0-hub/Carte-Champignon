#!/usr/bin/env python3
"""Axes routiers principaux (BD TOPO, importance 1 : liaisons entre métropoles = autoroutes et grands axes).

Récupère les tronçons par le WFS de l'IGN, les simplifie (tolérance ~150 m) et écrit routes.json :
{"u": 1000, "lines": [[lat0, lon0, dlat1, dlon1, ...], ...]}  (coordonnées en millièmes de degré, codées par différences).
La page s'en sert pour ne pas afficher de points sur ces axes (zone tampon d'environ 140 m).

Lancer : python build_routes.py   (3 à 8 minutes, aucune dépendance).
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "routes.json")
WFS = "https://data.geopf.fr/wfs/ows"
U = 1000
PAGE = 2500
BBOX = (41.0, 51.6, -5.6, 10.0)   # France métropolitaine (lat min/max, lon min/max)


def get(params):
    q = urllib.parse.urlencode(dict({"SERVICE": "WFS", "VERSION": "2.0.0"}, **params))
    err = None
    for a in range(4):
        try:
            req = urllib.request.Request(WFS + "?" + q, headers={"User-Agent": "carte-champignons/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r: return r.read()
        except Exception as e:
            err = e; print("  nouvel essai (%s)" % e, file=sys.stderr); time.sleep(5 * (a + 1))
    raise SystemExit("WFS injoignable : %s" % err)


def to_latlon(c):
    """GeoJSON peut sortir (lon, lat) ou (lat, lon) selon le serveur : en France la latitude est toujours >= 41."""
    a, b = c[0], c[1]
    return (a, b) if a >= 40 else (b, a)


def dp(pts, tol):
    """Douglas-Peucker itératif sur des points (lat, lon)."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    k = math.cos(math.radians(pts[0][0]))
    while stack:
        i, j = stack.pop()
        (y1, x1), (y2, x2) = pts[i], pts[j]
        dx, dy = (x2 - x1) * k, y2 - y1; n = dx * dx + dy * dy; dmax, im = 0, -1
        for m in range(i + 1, j):
            y, x = pts[m]; px, py = (x - x1) * k, y - y1
            if n == 0: d = math.hypot(px, py)
            else:
                t = max(0, min(1, (px * dx + py * dy) / n)); d = math.hypot(px - t * dx, py - t * dy)
            if d > dmax: dmax, im = d, m
        if dmax > tol and im > 0:
            keep[im] = True; stack += [(i, im), (im, j)]
    return [p for p, kp in zip(pts, keep) if kp]


def main():
    hits = get({"REQUEST": "GetFeature", "TYPENAMES": "BDTOPO_V3:troncon_de_route", "RESULTTYPE": "hits", "CQL_FILTER": "importance='1'"})
    total = int(re.search(rb'numberMatched="(\d+)"', hits).group(1)); print(total, "tronçons")
    raw = []; start = 0
    while start < total:
        b = get({"REQUEST": "GetFeature", "TYPENAMES": "BDTOPO_V3:troncon_de_route", "OUTPUTFORMAT": "application/json", "SRSNAME": "EPSG:4326",
                 "CQL_FILTER": "importance='1'", "COUNT": PAGE, "STARTINDEX": start, "SORTBY": "cleabs", "PROPERTYNAME": "geometrie"})
        fs = json.loads(b).get("features", [])
        if not fs: break
        for f in fs:
            g = f.get("geometry") or {}
            parts = g.get("coordinates") or []
            if g.get("type") == "LineString": parts = [parts]
            for line in parts:
                pts = [to_latlon(c) for c in line]
                if pts and BBOX[0] <= pts[0][0] <= BBOX[1] and BBOX[2] <= pts[0][1] <= BBOX[3]: raw.append(pts)
        start += len(fs); print("  %d/%d" % (start, total), flush=True)
    print(len(raw), "lignes en France métropolitaine")
    for tol in (0.0012, 0.002, 0.003, 0.005):
        lines = []
        for pts in raw:
            s = dp(pts, tol)
            q = [(round(y * U), round(x * U)) for y, x in s]
            out = [q[0][0], q[0][1]]
            for (y0, x0), (y1, x1) in zip(q, q[1:]):
                if (y1, x1) != (y0, x0): out += [y1 - y0, x1 - x0]
            if len(out) >= 4: lines.append(out)
        txt = json.dumps({"u": U, "lines": lines}, separators=(",", ":"))
        print("tolérance %.4f° : %d lignes, %d Ko" % (tol, len(lines), len(txt) // 1024))
        if len(txt) < 2_400_000: break
    open(OUT, "w").write(txt); print("OK : routes.json")


if __name__ == "__main__":
    main()
