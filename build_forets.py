#!/usr/bin/env python3
"""Forêt à fine échelle (IGN BD Forêt v2) : petits massifs et îlots forestiers.

Pour chaque maille de la grille, demande à l'IGN une image de la couche forêt (480x480 px, environ 36 m par pixel)
et la résume en 12 x 12 blocs d'environ 1,4 km. (À 96 px l'IGN gonfle le boisement des paysages morcelés : 51 %
mesuré dans le Gers contre 29 % à 480 px et 26 % à 720 px.) Résultat : forets.json  (clé "lat,lon" -> 144 caractères, du nord au sud,
d'ouest en est) :  . pas de forêt | f/F feuillus | r/R résineux | m/M autre ou mixte
(minuscule = 25-60 % du bloc boisé, majuscule = plus de 60 %).

Lancer :  python build_forets.py          (reprend là où il s'est arrêté)
          python build_forets.py --force  (tout refaire)
Durée : 15 à 30 minutes (3 requêtes en parallèle). Aucune dépendance. Le type (feuillus/résineux) est déduit de la couleur de la légende
IGN : c'est une approximation, la présence de forêt est fiable, l'essence l'est moins.
"""
import colorsys, json, os, struct, sys, time, urllib.parse, urllib.request, zlib
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
DATA, OUT = os.path.join(HERE, "data.json"), os.path.join(HERE, "forets.json")
IGN, LAYER = "https://data.geopf.fr/wms-v/ows", "LANDCOVER.FORESTINVENTORY.V2"
K, PX = 12, 40           # blocs par maille, pixels par bloc (image de 480 px)
WORKERS = 3
MIN_FOREST = 0.25        # part minimale de pixels boisés pour qu'un bloc compte comme forêt
STRONG = 0.60


def png_decode(b):
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("réponse non PNG : %r" % b[:80])
    pos, plte, trns, idat, ihdr = 8, None, None, b"", None
    while pos < len(b):
        ln, = struct.unpack(">I", b[pos:pos + 4]); typ = b[pos + 4:pos + 8]; dat = b[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if typ == b"IHDR": ihdr = struct.unpack(">IIBBBBB", dat)
        elif typ == b"PLTE": plte = dat
        elif typ == b"tRNS": trns = dat
        elif typ == b"IDAT": idat += dat
    w, h, bd, ct, _, _, il = ihdr
    if bd != 8 or il != 0:
        raise ValueError("PNG non géré (profondeur %s, entrelacé %s)" % (bd, il))
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]; raw = zlib.decompress(idat); stride = w * ch
    prev, p, rows = bytearray(stride), 0, []
    for _ in range(h):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        for i in range(stride):
            a = line[i - ch] if i >= ch else 0; up = prev[i]; c = prev[i - ch] if i >= ch else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + up) & 255
            elif f == 3: line[i] = (line[i] + ((a + up) >> 1)) & 255
            elif f == 4:
                pa, pb, pc = abs(up - c), abs(a - c), abs(a + up - 2 * c)
                line[i] = (line[i] + (a if (pa <= pb and pa <= pc) else (up if pb <= pc else c))) & 255
        rows.append(line); prev = line
    out = []
    for line in rows:
        r = []
        for x in range(w):
            if ct == 6: r.append((line[x*4], line[x*4+1], line[x*4+2], line[x*4+3]))
            elif ct == 2: r.append((line[x*3], line[x*3+1], line[x*3+2], 255))
            elif ct == 3:
                i = line[x]; rr, gg, bb = plte[i*3:i*3+3]; r.append((rr, gg, bb, trns[i] if trns and i < len(trns) else 255))
            elif ct == 0: r.append((line[x],) * 3 + (255,))
            else: r.append((line[x*2],) * 3 + (line[x*2+1],))
        out.append(r)
    return w, h, out


_cache = {}


def classify(px):
    """0 pas de forêt, 1 feuillus, 2 résineux, 3 mélange/autre. D'après la légende de la couche IGN :
    verts = feuillus (chênes, hêtre, châtaignier, mélange de feuillus), bleus/violets/cyan = conifères (pins, sapin,
    épicéa, mélèze, douglas), orange/rouge = mélange feuillus-conifères. Ignorés : jaunes/beiges (peupleraie, lande,
    formation herbacée, coupe), gris et pastels (forêt ouverte, faible couvert)."""
    r, g, b, a = px
    if a < 128: return 0
    key = (r, g, b)
    c = _cache.get(key)
    if c is None:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); h *= 360
        if s < .35: c = 0
        elif 25 <= h < 66: c = 0
        elif 10 <= h < 25 and v < .7: c = 1          # robinier (brun)
        elif 66 <= h < 165: c = 1
        elif 165 <= h < 330: c = 2
        else: c = 3
        _cache[key] = c
    return c


def summarize(w, h, px):
    """Image -> chaîne de K*K caractères (nord->sud, ouest->est)."""
    bw, bh = w // K, h // K
    out = []
    for by in range(K):
        for bx in range(K):
            cnt = [0, 0, 0, 0]
            for y in range(by * bh, (by + 1) * bh):
                row = px[y]
                for x in range(bx * bw, (bx + 1) * bw): cnt[classify(row[x])] += 1
            tot = bw * bh; forest = cnt[1] + cnt[2] + cnt[3]
            if forest / tot < MIN_FOREST: out.append("."); continue
            c = "frm"[max((1, 2, 3), key=lambda k: cnt[k]) - 1]
            out.append(c.upper() if forest / tot >= STRONG else c)
    return "".join(out)


def fetch_cell(lat, lon, dlat, dlon):
    q = urllib.parse.urlencode({"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": LAYER, "STYLES": "",
        "CRS": "EPSG:4326", "BBOX": "%f,%f,%f,%f" % (lat - dlat / 2, lon - dlon / 2, lat + dlat / 2, lon + dlon / 2),
        "WIDTH": K * PX, "HEIGHT": K * PX, "FORMAT": "image/png", "TRANSPARENT": "TRUE"})
    err = None
    for a in range(3):
        try:
            req = urllib.request.Request(IGN + "?" + q, headers={"User-Agent": "carte-champignons/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return summarize(*png_decode(r.read()))
        except Exception as e:
            err = e; time.sleep(3 * (a + 1))
    print("  abandon %s,%s : %s" % (lat, lon, err), file=sys.stderr)
    return None


def steps(vals):
    u = sorted(set(vals)); return min(b - a for a, b in zip(u, u[1:]))


def main():
    force = "--force" in sys.argv
    budget = 0
    if "--max-seconds" in sys.argv: budget = float(sys.argv[sys.argv.index("--max-seconds") + 1])
    cells = json.load(open(DATA, encoding="utf-8"))["cells"]
    pts = [(c[0], c[1]) for c in cells]
    dlat, dlon = steps([p[0] for p in pts]), steps([p[1] for p in pts])
    res = {}
    if os.path.exists(OUT) and not force:
        old = json.load(open(OUT, encoding="utf-8"))
        if old.get("px") == PX:
            res = old.get("cells", {})
            print("reprise : %d mailles déjà faites" % len(res))
        else:
            print("forets.json existant à une autre résolution : on repart de zéro")
    todo = [p for p in pts if "%s,%s" % p not in res]
    print("%d mailles à traiter (pas %.3f x %.3f)" % (len(todo), dlat, dlon))
    t0 = time.time()
    def save():
        tmp = OUT + ".tmp"
        json.dump({"K": K, "px": PX, "cells": res}, open(tmp, "w", encoding="utf-8"), separators=(",", ":"))
        os.replace(tmp, OUT)
    def work(p):
        time.sleep(0.1)
        return p, fetch_cell(p[0], p[1], dlat, dlon)
    done = 0
    for i in range(0, len(todo), 60):                     # lots de 60 : sauvegarde et contrôle du temps entre les lots
        with ThreadPoolExecutor(WORKERS) as ex:
            for (lat, lon), s in ex.map(work, todo[i:i + 60]):
                if s is not None: res["%s,%s" % (lat, lon)] = s
                done += 1
        save()
        print("  %d/%d (sauvegarde, %.0f s)" % (done, len(todo), time.time() - t0), flush=True)
        if budget and time.time() - t0 > budget and done < len(todo):
            print("temps imparti atteint : relancer pour continuer (%d/%d)" % (done, len(todo))); return
    save()
    nf = sum(1 for s in res.values() if s.strip("."))
    print("OK : forets.json (%d mailles, %d avec forêt)" % (len(res), nf))


if __name__ == "__main__":
    main()
