#!/usr/bin/env python3
"""Génère data.json : grille de mailles sur la France avec altitude, pluie et température
(14 jours passés + 8 jours de prévision) via Open-Meteo. Aucune clé API, aucune dépendance."""
import json, sys, time, urllib.request, urllib.parse

FR = "2.55,51.08 1.85,50.95 1.55,50.2 0.1,49.5 -1.6,49.65 -1.5,48.65 -2.0,48.65 -3.0,48.85 -4.7,48.4 -4.7,48.0 -3.4,47.7 -3.1,47.5 -2.2,47.25 -2.2,46.9 -1.2,46.15 -1.05,45.6 -1.1,45.0 -1.25,44.65 -1.55,43.5 -1.8,43.37 -1.45,43.05 -0.7,42.85 0.7,42.8 1.45,42.45 2.0,42.35 3.1,42.43 3.05,42.7 3.2,43.15 3.7,43.4 4.5,43.4 4.85,43.35 5.35,43.2 6.0,43.1 6.7,43.4 7.2,43.7 7.5,43.78 7.0,44.2 6.9,44.6 6.6,45.1 7.05,45.9 6.8,46.4 6.1,46.15 6.15,46.4 6.9,47.0 7.55,47.6 7.6,48.0 8.2,48.97 6.4,49.45 5.8,49.55 4.85,50.1 4.2,50.3 3.1,50.75"
CO = "9.35,42.95 9.5,42.6 9.4,41.9 9.15,41.4 8.8,41.6 8.6,42.0 8.65,42.5 9.2,42.75"
STEP_LAT, STEP_LON = 0.25, 0.30   # ~28 km ; descendre à 0.15 / 0.18 pour une grille plus fine
BATCH = 40

def poly(s): return [tuple(map(float, p.split(","))) for p in s.split()]
def inside(lon, lat, pg):
    c = False; j = len(pg) - 1
    for i in range(len(pg)):
        xi, yi = pg[i]; xj, yj = pg[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def grid():
    pgs = [poly(FR), poly(CO)]; out = []
    lat = 41.4
    while lat <= 51.1:
        lon = -4.8
        while lon <= 9.6:
            if any(inside(lon, lat, p) for p in pgs): out.append((round(lat, 3), round(lon, 3)))
            lon += STEP_LON
        lat += STEP_LAT
    return out

def fetch(batch):
    q = urllib.parse.urlencode({
        "latitude": ",".join(str(a) for a, _ in batch), "longitude": ",".join(str(b) for _, b in batch),
        "daily": "precipitation_sum,temperature_2m_mean", "past_days": 14, "forecast_days": 8,
        "timezone": "Europe/Paris"})
    url = "https://api.open-meteo.com/v1/forecast?" + q
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                j = json.load(r)
            return j if isinstance(j, list) else [j]
        except Exception as e:
            print("retry", attempt, e, file=sys.stderr); time.sleep(5 * (attempt + 1))
    raise SystemExit("Open-Meteo injoignable")

def main():
    pts = grid(); print(len(pts), "mailles"); cells = []; start = None
    for i in range(0, len(pts), BATCH):
        b = pts[i:i + BATCH]; res = fetch(b)
        assert len(res) == len(b)
        for (lat, lon), o in zip(b, res):
            d = o["daily"]; start = start or d["time"][0]
            r1 = lambda v: round(v or 0, 1)
            cells.append([lat, lon, round(o.get("elevation", 0)), [r1(v) for v in d["precipitation_sum"]], [r1(v) for v in d["temperature_2m_mean"]]])
        time.sleep(1)
    json.dump({"start": start, "cells": cells}, open("data.json", "w"), separators=(",", ":"))
    print("data.json écrit,", len(cells), "mailles")

if __name__ == "__main__": main()
