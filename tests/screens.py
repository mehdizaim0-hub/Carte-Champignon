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

def wait_ready(page, name):
    try:
        page.wait_for_function("document.getElementById('status') && /Météo/.test(document.getElementById('status').textContent)", timeout=90000)
    except Exception as e:
        log.append("[%s] page non prête après 90 s : %s" % (name, str(e)[:120]))
        try: page.screenshot(path="%s/%s_0_echec.png" % (OUT, name))
        except Exception: pass
        raise
    page.wait_for_timeout(6000)          # fonds de carte, photo, champ fin

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, vp, dsf in (("desk", {"width": 1440, "height": 900}, 1), ("mob", {"width": 390, "height": 844}, 2)):
            ctx = b.new_context(viewport=vp, device_scale_factor=dsf, locale="fr-FR")
            page = ctx.new_page()
            page.on("console", lambda m, n=name: log.append("[%s console.%s] %s" % (n, m.type, m.text)) if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e, n=name: log.append("[%s pageerror] %s" % (n, e)))
            page.on("requestfailed", lambda r, n=name: log.append("[%s requestfailed] %s %s" % (n, r.url[:120], r.failure)))
            page.goto(URL, wait_until="domcontentloaded")
            wait_ready(page, name)
            def shot(label, **kw):
                try: page.screenshot(path="%s/%s_%s.png" % (OUT, name, label), **kw)
                except Exception as e: log.append("[%s] capture %s impossible : %s" % (name, label, e))
            def step(label, fn, wait=1500):
                try: fn(); page.wait_for_timeout(wait)
                except Exception as e: log.append("[%s] étape %s en échec : %s" % (name, label, str(e)[:160]))
            shot("1_accueil")
            step("point", lambda: page.evaluate("setPoint(44.2,-0.9,true)"), 9000)
            shot("2_point_landes")
            step("espece", lambda: page.evaluate("document.querySelector('#chips button[data-i=\\'12\\']').click()"), 2500)
            step("zoom", lambda: page.evaluate("map.setView([44.2,-0.9],10)"), 4000)
            shot("3_armillaire_zoom10")
            step("vue jour", lambda: page.evaluate("document.querySelectorAll('#views button')[0].click()"), 2500)
            shot("4_vue_jour")
            step("fiche", lambda: page.evaluate("document.getElementById('spdet').open=true;document.getElementById('side').scrollTo(0,document.getElementById('spdet').offsetTop-10)"), 800)
            shot("5_fiche_espece")
            # --- parties basses de l'interface (ajoutées : pluie, courbes, sosies, état vide, calque) ---
            SC = "document.getElementById('side').scrollTo(0,0);document.querySelector('%s').scrollIntoView({block:'start'})"
            step("espece0", lambda: page.evaluate("document.querySelector('#chips button[data-i=\\'0\\']').click();document.querySelectorAll('#views button')[1].click()"), 2500)
            step("france", lambda: page.evaluate("map.setView([46.6,2.6],6)"), 4000)
            shot("7_carte_etat_vide")
            step("point2", lambda: page.evaluate("setPoint(44.2,-0.9,true)"), 9000)
            step("pluie", lambda: page.evaluate(SC % "#detail .rain"), 900)
            shot("8_point_pluie")
            step("sosies", lambda: page.evaluate("document.getElementById('spdet').open=true;" + SC % "#spsos"), 900)
            shot("9_fiche_sosies")
            step("courbes", lambda: page.evaluate(SC % "#spcurves"), 900)
            shot("10_fiche_courbes")
            step("ce qui sort", lambda: page.evaluate(SC % "#nowg"), 900)
            shot("11_ce_qui_sort")
            step("calque ph", lambda: page.evaluate("document.querySelector('details.opts').open=true;document.getElementById('calque').value='ph';document.getElementById('calque').dispatchEvent(new Event('change'));map.setView([46.6,2.6],6)"), 4000)
            shot("12_calque_ph")
            step("calque off", lambda: page.evaluate("document.getElementById('calque').value='';document.getElementById('calque').dispatchEvent(new Event('change'))"), 1000)
            step("options", lambda: page.evaluate("document.querySelector('details.opts').open=true;document.getElementById('mode').value='flat';document.getElementById('mode').dispatchEvent(new Event('change'))"), 2000)
            step("france", lambda: page.evaluate("map.setView([46.6,2.6],6)"), 3000)
            shot("6_aplat")
            ctx.close()
        b.close()
finally:
    open("%s/console.txt" % OUT, "w").write("\n".join(log) or "aucune erreur ni avertissement")
    print("\n".join(log) or "aucune erreur ni avertissement")
