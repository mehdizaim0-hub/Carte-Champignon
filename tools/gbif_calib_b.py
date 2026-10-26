#!/usr/bin/env python3
"""Calibrage sur observations réelles (GBIF, France) croisées avec nos cartes : saison, altitude, pH, texture, habitat.

Pour chaque espèce : jusqu'à MAXN observations humaines récentes, localisées à moins de 1 km, projetées sur les blocs de
sol.json, relief.json, forets.json et urbain.json. Sortie : research/gbif-calibration-b.json (et résumé lisible).
Biais connus : les observateurs se concentrent près des villes et des routes ; la répartition mensuelle reflète aussi l'effort d'observation.
"""
import base64, json, os, sys, time, urllib.parse, urllib.request, random
from collections import Counter
ROOT = os.getcwd()
MAXN = 4000
SPECIES = [  # (nom affiché, nom scientifique)
    ("Bolet de Satan", "Rubroboletus satanas"), ("Langue de bœuf", "Fistulina hepatica"),
    ("Vesse de loup perlée", "Lycoperdon perlatum"), ("Vesse de loup géante", "Calvatia gigantea"),
]
def J(p): return json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
def b64(s, n): return base64.b64decode(s)
def key(v): return ("%.1f" % v) if float(v).is_integer() else repr(v)
cells = J("data.json")["cells"]
la = sorted({c[0] for c in cells}); lo = sorted({c[1] for c in cells})
dla = min(b - a for a, b in zip(la, la[1:])); dlo = min(b - a for a, b in zip(lo, lo[1:]))
la0, lo0 = la[0], lo[0]
ni, nj = round((la[-1] - la0) / dla) + 1, round((lo[-1] - lo0) / dlo) + 1
cellkey = {(round((c[0] - la0) / dla), round((c[1] - lo0) / dlo)): key(c[0]) + "," + key(c[1]) for c in cells}
sol, rel = J("sol.json"), J("relief.json"); W, H = sol["w"], sol["h"]
L = {k: b64(v, 0) for k, v in sol["layers"].items()}; R = {k: b64(v, 0) for k, v in rel["layers"].items()}
fo, ur = J("forets.json")["cells"], J("urbain.json")["cells"]
def block(lat, lon, K):
    y = int((lat - (la0 - dla / 2)) / (dla / K)); x = int((lon - (lo0 - dlo / 2)) / (dlo / K)); return y, x
def sample(lat, lon):
    y, x = block(lat, lon, 6)
    if not (0 <= y < H and 0 <= x < W): return None
    i = y * W + x; o = {}
    g = lambda a, d=1: None if a[i] == 255 else a[i] / d
    o["ph"], o["sand"], o["clay"], o["soc"] = g(L["ph"], 10), g(L["sand"]), g(L["clay"]), g(L["soc"])
    o["alt"] = None if R["elev"][i] == 255 else R["elev"][i] * 20; o["slope"] = g(R["slope"])
    yy, xx = block(lat, lon, 12); ck = cellkey.get((yy // 12, xx // 12))
    f = fo.get(ck); u = ur.get(ck)
    a, b = yy % 12, xx % 12; idx = (11 - a) * 12 + b
    o["forest"] = f[idx] if f else None; o["urb"] = u[idx] if u else None
    return o
def pct(v, p):
    v = sorted(v); return None if not v else round(v[min(len(v) - 1, int(p * (len(v) - 1) + .5))], 2)
def stats(rows):
    out = {"n": len(rows)}
    for k, nd in (("alt", 0), ("ph", 2), ("sand", 1), ("clay", 1), ("soc", 1), ("slope", 1)):
        v = [r[k] for r in rows if r.get(k) is not None]
        out[k] = {"n": len(v), **{("p%d" % int(p * 100)): pct(v, p) for p in (.05, .1, .25, .5, .75, .9, .95)}}
    fc = Counter(("none" if r["forest"] == "." else "broadleaf" if r["forest"] in "fF" else "conifer" if r["forest"] in "rR" else "mixed") for r in rows if r.get("forest"))
    n = sum(fc.values()) or 1
    out["forest_share"] = {k: round(v / n, 3) for k, v in fc.items()}
    uc = Counter(r["urb"] for r in rows if r.get("urb")); n = sum(uc.values()) or 1
    out["open_share"] = {"urban": round(uc.get("#", 0) / n, 3), "prairie": round(uc.get("p", 0) / n, 3)}
    return out
def get(u):
    for a in range(5):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "carte-champignons/1.0"}), timeout=90))
        except Exception as e: time.sleep(3 * (a + 1))
    return None
# base de comparaison : tous les blocs de la grille avec sol connu, et ceux boisés
random.seed(1); base_all, base_forest = [], []
for _ in range(60000):
    y = random.randrange(H); x = random.randrange(W)
    lat = la0 - dla / 2 + (y + .5) * dla / 6; lon = lo0 - dlo / 2 + (x + .5) * dlo / 6
    s = sample(lat, lon)
    if s and s["ph"] is not None and s["alt"] is not None:
        base_all.append(s)
        if s["forest"] and s["forest"] != ".": base_forest.append(s)
res = {"baseline_tous_blocs": stats(base_all), "baseline_blocs_boises": stats(base_forest), "especes": {}}
print("base :", len(base_all), "blocs ;", len(base_forest), "boisés", flush=True)
for nom, sci in SPECIES:
    m = get("https://api.gbif.org/v1/species/match?name=" + urllib.parse.quote(sci))
    if not m or not m.get("usageKey"): print(nom, "taxon introuvable"); continue
    rows, months, off = [], Counter(), 0
    while len(rows) < MAXN and off < 20000:
        j = get("https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode({"taxonKey": m["usageKey"], "country": "FR", "hasCoordinate": "true",
            "hasGeospatialIssue": "false", "basisOfRecord": "HUMAN_OBSERVATION", "year": "2005,2026", "coordinateUncertaintyInMeters": "0,1000", "limit": 300, "offset": off}))
        if not j or not j.get("results"): break
        for o in j["results"]:
            if o.get("month"): months[o["month"]] += 1
            if o.get("decimalLatitude") is None: continue
            s = sample(o["decimalLatitude"], o["decimalLongitude"])
            if s: rows.append(s)
        off += 300
        if j.get("endOfRecords"): break
        time.sleep(.2)
    tot = sum(months.values()) or 1
    st = stats(rows); st["mois_pct"] = [round(100 * months.get(i, 0) / tot, 1) for i in range(1, 13)]; st["nom_scientifique"] = sci; st["observations_lues"] = tot
    res["especes"][nom] = st
    print("%-30s n=%5d | alt p50 %s | pH p50 %s | forêt %s | prairie %s" % (nom, st["n"], st["alt"]["p50"], st["ph"]["p50"], st["forest_share"], st["open_share"]["prairie"]), flush=True)
os.makedirs("research", exist_ok=True)
json.dump(res, open("research/gbif-calibration-b.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK : research/gbif-calibration-b.json")
