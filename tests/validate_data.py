#!/usr/bin/env python3
"""Contrôle d'intégrité des fichiers de données. Code de sortie 1 au moindre problème.

Usage : python3 tests/validate_data.py [--fresh]     (--fresh : exige aussi que data.json date de moins de 36 h)
Exécuté par l'intégration continue et, avant chaque commit, par le workflow quotidien : des données invalides ne sont jamais publiées.
Piège historique contrôlé ici : une coordonnée entière s'écrit « 48.0 » en Python et « 48 » en JavaScript ; la page applique la clé de Python.
"""
import base64, json, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errs, notes = [], []

def load(name, required=True):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        (errs if required else notes).append("%s : fichier absent" % name); return None
    try: return json.load(open(p, encoding="utf-8"))
    except Exception as e: errs.append("%s : JSON illisible (%s)" % (name, e)); return None

def key(v): return ("%.1f" % v) if float(v).is_integer() else repr(v)

data = load("data.json")
cells = []
if data:
    cells = data.get("cells") or []
    n_days = len(cells[0][3]) if cells else 0
    if len(cells) < 2000: errs.append("data.json : %d mailles (au moins 2000 attendues)" % len(cells))
    if n_days < 30: errs.append("data.json : séries de %d jours (au moins 30 attendus)" % n_days)
    bad = [c for c in cells if len(c) < 8 or any(len(c[i]) != n_days for i in (3, 4, 5, 6, 7))]
    if bad: errs.append("data.json : %d mailles aux séries incomplètes ou de longueurs différentes" % len(bad))
    alts = [c[2] for c in cells]
    if min(alts) < -50 or max(alts) > 4900: errs.append("data.json : altitudes hors plage (%s à %s)" % (min(alts), max(alts)))
    precip = [v for c in cells[:300] for v in c[3] if v is not None]
    if precip and (min(precip) < 0 or max(precip) > 900): errs.append("data.json : précipitations hors plage (> 900 mm en un jour)")
    temp = [v for c in cells[:300] for v in c[4] if v is not None]
    if temp and (min(temp) < -35 or max(temp) > 50): errs.append("data.json : températures hors plage")
    if "--fresh" in sys.argv and data.get("generated"):
        age = (time.time() - time.mktime(time.strptime(data["generated"][:19], "%Y-%m-%dT%H:%M:%S"))) / 3600
        if age > 36 + 2: errs.append("data.json : généré il y a %.0f h" % age)
    notes.append("data.json : %d mailles, %d jours/série" % (len(cells), n_days))

keys = {key(c[0]) + "," + key(c[1]) for c in cells}
for name, per_cell in (("forets.json", 144), ("urbain.json", 144)):
    j = load(name)
    if not j: continue
    cs = j.get("cells", {})
    missing = keys - set(cs)
    if missing: errs.append("%s : %d mailles de data.json introuvables (clés « 48.0 » ?) ex. %s" % (name, len(missing), sorted(missing)[:3]))
    short = [k for k, v in cs.items() if len(v) != per_cell]
    if short: errs.append("%s : %d chaînes de longueur incorrecte" % (name, len(short)))
    notes.append("%s : %d mailles" % (name, len(cs)))

t = load("terrain.json", required=False)
if t:
    missing = keys - set(t)
    if missing: errs.append("terrain.json : %d mailles introuvables ex. %s" % (len(missing), sorted(missing)[:3]))

for name, layers, nodata_max in (("sol.json", ("ph", "sand", "clay", "soc"), 0.5), ("relief.json", ("elev", "slope", "north", "tpi"), 0.5)):
    j = load(name)
    if not j: continue
    w, h = j.get("w"), j.get("h")
    for l in layers:
        raw = base64.b64decode(j["layers"][l])
        if len(raw) != w * h: errs.append("%s : couche %s de %d octets (attendu %d)" % (name, l, len(raw), w * h)); continue
        unk = raw.count(255) / len(raw)
        if unk > nodata_max: errs.append("%s : %s a %.0f %% de blocs sans donnée" % (name, l, 100 * unk))
    notes.append("%s : %d x %d blocs" % (name, w, h))

r = load("routes.json")
if r:
    if len(r.get("lines", [])) < 20000: errs.append("routes.json : %d lignes (au moins 20000 attendues)" % len(r.get("lines", [])))
    notes.append("routes.json : %d lignes" % len(r.get("lines", [])))

for n in notes: print("  ok  " + n)
if errs:
    print("\nÉCHEC :"); [print("  - " + e) for e in errs]; sys.exit(1)
print("Données valides.")
