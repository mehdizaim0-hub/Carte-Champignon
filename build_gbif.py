#!/usr/bin/env python3
"""Observations de cueilleurs (GBIF, France) comptées par bloc de ~2,8 km, par espèce : produit gbif.json pour le calque « Observations ».

Pour chaque espèce du catalogue (species.js) : observations humaines 2010-2026, position connue à moins de 1 km (ou précision non
renseignée), projetées sur la grille de sol.json (blocs de ~2,8 km, mêmes indices que les autres calques). On compte les JOURS
D'OBSERVATION DISTINCTS par bloc : plusieurs photos de la même espèce au même endroit le même jour ne comptent qu'une fois.

Ce que ça mesure : où des naturalistes ont signalé l'espèce, pas où elle abonde. Les observateurs se concentrent près des villes,
des routes et des sentiers fréquentés. Ne pas lire comme une densité de champignons.
Sortie : gbif.json (format creux : [indice de bloc, nombre, ...]). Réseau : api.gbif.org (workflow GitHub Actions).
"""
import json, os, sys, time, urllib.parse, urllib.request
from datetime import date

ROOT = os.getcwd()
Y0, Y1 = 2010, 2026
OUT = os.path.join(ROOT, "gbif.json")
GB = "https://api.gbif.org/v1"
HDR = {"User-Agent": "carte-champignons/1.0 (GitHub Actions)"}
BASE = dict(country="FR", basisOfRecord="HUMAN_OBSERVATION", hasCoordinate="true", hasGeospatialIssue="false")
# (nom exact de species.js, nom scientifique GBIF)
SPECIES = [
    ("Cèpe de Bordeaux", "Boletus edulis"), ("Girolle", "Cantharellus cibarius"), ("Morille", "Morchella"),
    ("Trompette de la mort", "Craterellus cornucopioides"), ("Pied-de-mouton", "Hydnum repandum"), ("Lactaire délicieux", "Lactarius deliciosus"),
    ("Bolet bai", "Imleria badia"), ("Chanterelle en tube", "Craterellus tubaeformis"), ("Coulemelle", "Macrolepiota procera"),
    ("Cèpe d'été", "Boletus reticulatus"), ("Russule charbonnière", "Russula cyanoxantha"), ("Bolet jaune", "Suillus luteus"),
    ("Armillaire couleur de miel", "Armillaria mellea"), ("Pleurote en huître", "Pleurotus ostreatus"), ("Rosé des prés", "Agaricus campestris"),
    ("Mousseron de la Saint-Georges", "Calocybe gambosa"), ("Marasme des oréades", "Marasmius oreades"), ("Langue de bœuf", "Fistulina hepatica"),
    ("Vesse de loup perlée", "Lycoperdon perlatum"), ("Vesse de loup géante", "Calvatia gigantea"),
]


def get(url):
    for a in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=90) as r:
                return json.load(r)
        except Exception as e:
            if a == 5:
                raise
            time.sleep(3 * (a + 1))


def grid():
    cells = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf-8"))["cells"]
    la = sorted({c[0] for c in cells}); lo = sorted({c[1] for c in cells})
    dla = min(b - a for a, b in zip(la, la[1:])); dlo = min(b - a for a, b in zip(lo, lo[1:]))
    sol = json.load(open(os.path.join(ROOT, "sol.json"), encoding="utf-8"))
    return la[0], lo[0], dla, dlo, sol["w"], sol["h"], 6        # K = 6 blocs par maille (comme tools/gbif_calib_b.py et SOL.K)


def block_index(lat, lon, g):
    la0, lo0, dla, dlo, W, H, K = g
    y = int((lat - (la0 - dla / 2)) / (dla / K)); x = int((lon - (lo0 - dlo / 2)) / (dlo / K))
    return y * W + x if (0 <= y < H and 0 <= x < W) else None


def usable(r):
    y, m, d = r.get("year"), r.get("month"), r.get("day")
    la, lo = r.get("decimalLatitude"), r.get("decimalLongitude")
    if None in (y, m, d, la, lo):
        return None
    u = r.get("coordinateUncertaintyInMeters")
    if u is not None and u > 1000:
        return None
    try:
        date(y, m, d)
    except ValueError:
        return None
    return y, m, d, la, lo


def collect(name, sci, g):
    key = get(GB + "/species/match?" + urllib.parse.urlencode({"name": sci})).get("usageKey")
    if not key:
        print("  taxon introuvable :", sci); return None
    seen, n_raw = set(), 0
    for year in range(Y0, Y1 + 1):                       # une année à la fois : jamais au-delà des 100 000 résultats paginables
        off = 0
        while off <= 99700:
            d = get(GB + "/occurrence/search?" + urllib.parse.urlencode(dict(taxonKey=key, year=year, limit=300, offset=off, **BASE)))
            for r in d.get("results", []):
                n_raw += 1
                u = usable(r)
                if not u:
                    continue
                b = block_index(u[3], u[4], g)
                if b is not None:
                    seen.add((b, u[0], u[1], u[2]))        # un jour d'observation distinct par bloc
            off += 300
            if d.get("endOfRecords") or not d.get("results"):
                break
            time.sleep(.12)
    cnt = {}
    for b, *_ in seen:
        cnt[b] = cnt.get(b, 0) + 1
    flat = []
    for b in sorted(cnt):
        flat += [b, cnt[b]]
    print("  %-30s %6d enregistrements GBIF -> %5d jours-blocs distincts, %5d blocs" % (name, n_raw, len(seen), len(cnt)), flush=True)
    return {"n": len(seen), "b": flat}


def main():
    g = grid()
    print("grille : %d x %d blocs, K=%d" % (g[4], g[5], g[6]), flush=True)
    out = {"v": 1, "periode": [Y0, Y1], "K": g[6], "w": g[4], "h": g[5], "genere": date.today().isoformat(),
           "source": "GBIF.org, observations humaines en France (données agrégées ; jours d'observation distincts par bloc)", "especes": {}}
    for name, sci in SPECIES:
        r = collect(name, sci, g)
        if r:
            out["especes"][name] = r
    if len(out["especes"]) < len(SPECIES) - 2:
        print("ÉCHEC : trop d'espèces manquantes"); sys.exit(1)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("OK : %s (%d Ko, %d espèces)" % (OUT, os.path.getsize(OUT) // 1024, len(out["especes"])))


if __name__ == "__main__":
    main()
