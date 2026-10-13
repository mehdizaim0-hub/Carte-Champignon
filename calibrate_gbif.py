#!/usr/bin/env python3
"""Calibrage sur observations reelles (GBIF, France, observations humaines).

Pour chaque espece : repartition par mois, par altitude (quand renseignee) et par departement-grille,
ecrite dans calibration.json. A comparer ensuite avec les saisons et altitudes codees dans index.html.

Utilisation (PowerShell, dans le dossier du projet) :  python calibrate_gbif.py
Aucune dependance. Prevoir quelques minutes. Donnees : GBIF.org (licences variables, citer GBIF).
"""
import json, os, sys, time, urllib.parse, urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_PER_SPECIES = 6000          # GBIF limite l'offset a 100 000 ; 6000 suffit pour un profil fiable
PAGE = 300
SPECIES = {
    "Cèpe de Bordeaux": "Boletus edulis",
    "Girolle": "Cantharellus cibarius",
    "Morille": "Morchella",
    "Trompette de la mort": "Craterellus cornucopioides",
    "Pied-de-mouton": "Hydnum repandum",
    "Lactaire délicieux": "Lactarius deliciosus",
    "Bolet bai": "Imleria badia",
    "Chanterelle en tube": "Craterellus tubaeformis",
    "Coulemelle": "Macrolepiota procera",
}

def get(params):
    url = "https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(params)
    for k in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print("  erreur (%s), nouvelle tentative..." % e, file=sys.stderr); time.sleep(5 * (k + 1))
    raise SystemExit("GBIF injoignable.")

def taxon_key(name):
    with urllib.request.urlopen("https://api.gbif.org/v1/species/match?" + urllib.parse.urlencode({"name": name}), timeout=60) as r:
        return json.load(r).get("usageKey")

def main():
    out = {}
    for fr, latin in SPECIES.items():
        key = taxon_key(latin)
        if not key:
            print("Taxon introuvable :", latin); continue
        months, alts, lat_bins, n, off = Counter(), [], Counter(), 0, 0
        while off < MAX_PER_SPECIES:
            j = get({"taxonKey": key, "country": "FR", "hasCoordinate": "true", "hasGeospatialIssue": "false",
                     "basisOfRecord": "HUMAN_OBSERVATION", "limit": PAGE, "offset": off})
            res = j.get("results", [])
            for o in res:
                n += 1
                if o.get("month"): months[o["month"]] += 1
                if isinstance(o.get("elevation"), (int, float)): alts.append(o["elevation"])
                if o.get("decimalLatitude") is not None: lat_bins[int(o["decimalLatitude"])] += 1
            off += PAGE
            if j.get("endOfRecords") or not res: break
            time.sleep(0.3)
        alts.sort(); q = lambda p: round(alts[int(p * (len(alts) - 1))]) if alts else None
        tot = sum(months.values()) or 1
        out[fr] = {"latin": latin, "n": n,
                   "mois_pct": {m: round(100 * months.get(m, 0) / tot, 1) for m in range(1, 13)},
                   "altitude_m": {"n": len(alts), "p10": q(.1), "p50": q(.5), "p90": q(.9)}}
        print("%-22s %5d obs | pic : mois %s" % (fr, n, max(months, key=months.get) if months else "?"))
    with open(os.path.join(HERE, "calibration.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("calibration.json ecrit. Envoyez-moi son contenu pour ajuster saisons et altitudes.")

if __name__ == "__main__":
    main()
