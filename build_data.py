#!/usr/bin/env python3
"""Genere data.json : grille de mailles sur la France avec altitude, pluie et
temperature (40 jours passes + 8 jours de prevision) via Open-Meteo.

Aucune cle API, aucune dependance : fonctionne avec Python 3.8+ tel quel.
Lancer :  python build_data.py   (ou  py build_data.py  sous Windows)

Le script ne touche jamais a git : l'envoi vers GitHub est fait soit par le
workflow quotidien (.github/workflows/daily.yml), soit par update.bat.
"""
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Sortie lisible sous Windows (console en cp1252 par defaut)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------------------------------------------------------------- reglages
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
PAST_DAYS = 40                    # la pluie du cèpe agit sur ~26 j, celle du lactaire sur 3-5 semaines
FORECAST_DAYS = 8
STEP_LAT, STEP_LON = 0.15, 0.18   # ~17 km ; remonter a 0.25/0.30 pour une grille plus legere
BATCH = 40                        # mailles par requete
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")

# Contours simplifies France + Corse (lon,lat)
FR = "2.55,51.08 1.85,50.95 1.55,50.2 0.1,49.5 -1.6,49.65 -1.5,48.65 -2.0,48.65 -3.0,48.85 -4.7,48.4 -4.7,48.0 -3.4,47.7 -3.1,47.5 -2.2,47.25 -2.2,46.9 -1.2,46.15 -1.05,45.6 -1.1,45.0 -1.25,44.65 -1.55,43.5 -1.8,43.37 -1.45,43.05 -0.7,42.85 0.7,42.8 1.45,42.45 2.0,42.35 3.1,42.43 3.05,42.7 3.2,43.15 3.7,43.4 4.5,43.4 4.85,43.35 5.35,43.2 6.0,43.1 6.7,43.4 7.2,43.7 7.5,43.78 7.0,44.2 6.9,44.6 6.6,45.1 7.05,45.9 6.8,46.4 6.1,46.15 6.15,46.4 6.9,47.0 7.55,47.6 7.6,48.0 8.2,48.97 6.4,49.45 5.8,49.55 4.85,50.1 4.2,50.3 3.1,50.75"
CO = "9.35,42.95 9.5,42.6 9.4,41.9 9.15,41.4 8.8,41.6 8.6,42.0 8.65,42.5 9.2,42.75"

N_DAYS = PAST_DAYS + FORECAST_DAYS


# ---------------------------------------------------------------- grille
def poly(s):
    return [tuple(map(float, p.split(","))) for p in s.split()]


def inside(lon, lat, pg):
    c = False
    j = len(pg) - 1
    for i in range(len(pg)):
        xi, yi = pg[i]
        xj, yj = pg[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def grid():
    pgs = [poly(FR), poly(CO)]
    out = []
    lat = 41.4
    while lat <= 51.1:
        lon = -4.8
        while lon <= 9.6:
            if any(inside(lon, lat, p) for p in pgs):
                out.append((round(lat, 3), round(lon, 3)))
            lon += STEP_LON
        lat += STEP_LAT
    return out


# ---------------------------------------------------------------- meteo
def fetch(batch):
    """Une requete Open-Meteo pour un lot de mailles. Reessaie en cas d'echec,
    attend plus longtemps si le serveur demande de ralentir (HTTP 429)."""
    q = urllib.parse.urlencode({
        "latitude": ",".join(str(a) for a, _ in batch),
        "longitude": ",".join(str(b) for _, b in batch),
        "daily": "precipitation_sum,temperature_2m_mean,temperature_2m_min,"
                 "soil_moisture_0_to_10cm_mean,et0_fao_evapotranspiration",
        "past_days": PAST_DAYS,
        "forecast_days": FORECAST_DAYS,
        "timezone": "Europe/Paris",
    })
    url = OPEN_METEO_URL + "?" + q
    last = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                j = json.load(r)
            res = j if isinstance(j, list) else [j]
            if len(res) != len(batch):
                raise ValueError("reponse incomplete : %d/%d mailles" % (len(res), len(batch)))
            return res
        except urllib.error.HTTPError as e:
            last = e
            wait = 30 if e.code == 429 else 5 * (attempt + 1)
            print("  nouvel essai dans %ds (HTTP %s)" % (wait, e.code), file=sys.stderr)
            time.sleep(wait)
        except Exception as e:
            last = e
            wait = 5 * (attempt + 1)
            print("  nouvel essai dans %ds (%s)" % (wait, e), file=sys.stderr)
            time.sleep(wait)
    raise SystemExit("ERREUR : Open-Meteo injoignable (%s). Verifie ta connexion et relance." % last)


def clean_series(values, n, nd=1):
    """Serie de n nombres arrondis a nd decimales, trous (null) remplaces par 0."""
    values = list(values or [])[:n]
    values += [0] * (n - len(values))
    return [round(v, nd) if isinstance(v, (int, float)) else 0.0 for v in values]


# ---------------------------------------------------------------- main
def main():
    pts = grid()
    total = len(pts)
    print("%d mailles a recuperer (%d requetes)" % (total, (total + BATCH - 1) // BATCH))
    cells = []
    start = None
    for i in range(0, total, BATCH):
        b = pts[i:i + BATCH]
        res = fetch(b)
        for (lat, lon), o in zip(b, res):
            d = o.get("daily") or {}
            days = d.get("time") or []
            if not days:
                raise SystemExit("ERREUR : pas de dates pour la maille %s,%s" % (lat, lon))
            if start is None:
                start = days[0]
            alt = o.get("elevation")
            alt = round(alt) if isinstance(alt, (int, float)) else 0
            cells.append([
                lat, lon, alt,
                clean_series(d.get("precipitation_sum"), N_DAYS),
                clean_series(d.get("temperature_2m_mean"), N_DAYS),
                clean_series(d.get("temperature_2m_min"), N_DAYS),
                clean_series(d.get("soil_moisture_0_to_10cm_mean"), N_DAYS, 3),
                clean_series(d.get("et0_fao_evapotranspiration"), N_DAYS),
            ])
        done = min(i + BATCH, total)
        print("  %d/%d mailles" % (done, total))
        time.sleep(1)

    # validations finales avant d'ecraser quoi que ce soit
    if len(cells) != total:
        raise SystemExit("ERREUR : %d mailles recues sur %d, fichier non ecrit." % (len(cells), total))
    if not start:
        raise SystemExit("ERREUR : date de depart absente, fichier non ecrit.")
    alts = [c[2] for c in cells]
    if max(alts) < 500:
        raise SystemExit("ERREUR : altitudes suspectes (max %sm), fichier non ecrit." % max(alts))

    # ecriture atomique : fichier temporaire puis renommage
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    data = {"start": start, "generated": generated, "cells": cells}
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        os.replace(tmp, OUT)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise

    print("OK : data.json ecrit (%d mailles, du %s, altitudes 0-%dm)" % (len(cells), start, max(alts)))


if __name__ == "__main__":
    main()
