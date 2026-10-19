#!/usr/bin/env python3
"""Captures d'écran de la vraie page (navigateur Chromium) : bureau et mobile.
Usage : python3 tests/screens.py [dossier_de_sortie] [url]
Utilisé par .github/workflows/screens.yml ; les images vont sur la branche « screenshots »."""
import sys, os, json
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "screens"
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000/index.html"
os.makedirs(OUT, exist_ok=True)
log = []

def wait_ready(page):
    page.wait_for_function("document.getElementById('status') && /Météo/.test(document.getElementById('status').textContent)", timeout=90000)
    page.wait_for_timeout(6000)          # fonds de carte, photo, champ fin

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp, dsf in (("desk", {"width": 1440, "height": 900}, 1), ("mob", {"width": 390, "height": 844}, 2)):
        ctx = b.new_context(viewport=vp, device_scale_factor=dsf, locale="fr-FR")
        page = ctx.new_page()
        page.on("console", lambda m, n=name: log.append("[%s console.%s] %s" % (n, m.type, m.text)) if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e, n=name: log.append("[%s pageerror] %s" % (n, e)))
        page.on("requestfailed", lambda r, n=name: log.append("[%s requestfailed] %s %s" % (n, r.url[:120], r.failure)))
        page.goto(URL, wait_until="domcontentloaded")
        wait_ready(page)
        page.screenshot(path="%s/%s_1_accueil.png" % (OUT, name))
        page.screenshot(path="%s/%s_1_page_entiere.png" % (OUT, name), full_page=True)
        page.evaluate("setPoint(44.2,-0.9,true)")
        page.wait_for_timeout(9000)
        page.screenshot(path="%s/%s_2_point_landes.png" % (OUT, name))
        page.screenshot(path="%s/%s_2_point_page_entiere.png" % (OUT, name), full_page=True)
        page.select_option("#mode", "flat"); page.wait_for_timeout(1500)
        page.screenshot(path="%s/%s_3_aplat.png" % (OUT, name))
        ctx.close()
    b.close()
open("%s/console.txt" % OUT, "w").write("\n".join(log) or "aucune erreur ni avertissement")
print("\n".join(log) or "aucune erreur ni avertissement")
