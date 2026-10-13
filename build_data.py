#!/usr/bin/env python3
"""Génère data.json : grille de mailles sur la France avec altitude, pluie et température
(14 jours passés + 8 jours de prévision) via Open-Meteo.

Utilisation (Windows, PowerShell, dans le dossier du projet) :
    python build_data.py
Aucune dépendance à installer. Aucun réglage n'est obligatoire : le service gratuit suffit.
"""

# =====================  RÉGLAGES (facultatifs)  =====================
# Open-Meteo : laissez tel quel pour l'offre gratuite.
# Abonnement payant : mettez l'URL fournie (ex. https://customer-api.open-meteo.com/v1/forecast)
# et votre clé dans OPEN_METEO_API_KEY.
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_API_KEY = ""            # <- COLLER_ICI_LA_CLE (sinon laisser vide)

# Envoi automatique sur GitHub à la fin du script (sinon : git add / commit / push à la main).
AUTO_PUSH = False                  # <- passer à True pour activer l'envoi automatique
GITHUB_REPO_URL = "https://github.com/COLLER_ICI_PSEUDO/COLLER_ICI_DEPOT.git"
GITHUB_TOKEN = ""                  # <- COLLER_ICI_LE_TOKEN (droit "Contents : Read and write" sur ce dépôt)
GITHUB_BRANCH = "main"
# ====================================================================

import json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data.json")

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
    params = {
        "latitude": ",".join(str(a) for a, _ in batch), "longitude": ",".join(str(b) for _, b in batch),
        "daily": "precipitation_sum,temperature_2m_mean", "past_days": 14, "forecast_days": 8,
        "timezone": "Europe/Paris"}
    if OPEN_METEO_API_KEY and "COLLER" not in OPEN_METEO_API_KEY:
        params["apikey"] = OPEN_METEO_API_KEY
    url = OPEN_METEO_URL + "?" + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                j = json.load(r)
            return j if isinstance(j, list) else [j]
        except urllib.error.HTTPError as e:
            wait = 30 * (attempt + 1) if e.code == 429 else 5 * (attempt + 1)
            print("  erreur HTTP %s, nouvelle tentative dans %ss" % (e.code, wait), file=sys.stderr); time.sleep(wait)
        except Exception as e:
            print("  erreur (%s), nouvelle tentative..." % e, file=sys.stderr); time.sleep(5 * (attempt + 1))
    raise SystemExit("Open-Meteo injoignable : verifiez la connexion internet puis relancez.")

def push():
    token_ok = GITHUB_TOKEN and "COLLER" not in GITHUB_TOKEN
    url_ok = "COLLER" not in GITHUB_REPO_URL
    if not (token_ok and url_ok):
        print("AUTO_PUSH actif mais GITHUB_REPO_URL ou GITHUB_TOKEN non renseigne : envoi ignore.")
        return
    remote = GITHUB_REPO_URL.replace("https://", "https://x-access-token:%s@" % GITHUB_TOKEN, 1)
    def git(*args, check=True):
        p = subprocess.run(["git", *args], cwd=HERE, capture_output=True, text=True)
        out = (p.stdout + p.stderr).replace(GITHUB_TOKEN, "***")
        if check and p.returncode: raise SystemExit("git %s a echoue :\n%s" % (args[0], out))
        return p, out
    git("add", "data.json")
    p, _ = git("diff", "--cached", "--quiet", check=False)
    if p.returncode == 0:
        print("data.json identique a la version deja enregistree : rien a envoyer."); return
    git("commit", "-m", "data %s" % time.strftime("%Y-%m-%d"))
    p, out = git("push", remote, "HEAD:" + GITHUB_BRANCH, check=False)
    if p.returncode:
        raise SystemExit("Envoi refuse. Faites d'abord `git pull --rebase` puis relancez.\n" + out)
    print("data.json envoye sur GitHub (%s)." % GITHUB_BRANCH)

def main():
    pts = grid(); print(len(pts), "mailles a recuperer"); cells = []; start = None
    for i in range(0, len(pts), BATCH):
        b = pts[i:i + BATCH]; res = fetch(b)
        if len(res) != len(b): raise SystemExit("Reponse inattendue d'Open-Meteo.")
        for (lat, lon), o in zip(b, res):
            d = o["daily"]; start = start or d["time"][0]
            r1 = lambda v: round(v or 0, 1)
            cells.append([lat, lon, round(o.get("elevation", 0)), [r1(v) for v in d["precipitation_sum"]], [r1(v) for v in d["temperature_2m_mean"]]])
        print("  %d / %d" % (len(cells), len(pts)))
        time.sleep(1)
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f: json.dump({"start": start, "cells": cells}, f, separators=(",", ":"))
    os.replace(tmp, OUT)   # ecriture atomique : jamais de fichier a moitie ecrit
    print("data.json ecrit :", len(cells), "mailles, debut des series au", start)
    if AUTO_PUSH: push()
    else: print("Etape suivante : git add data.json ; git commit -m \"data\" ; git push")

if __name__ == "__main__": main()
