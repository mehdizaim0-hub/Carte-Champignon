#!/usr/bin/env python3
"""Morille : le trapèze de température [6, 10, 16, 21] vient de températures du SOL (0-7 cm) dans les notes de recherche, mais l'appli
l'applique à la température de l'AIR (temperature_2m_mean). Ce script teste l'hypothèse sur les observations GBIF déjà collectées :
le trapèze, appliqué à la température du sol (archive ERA5, moyenne journalière calculée depuis l'horaire), discrimine-t-il mieux les
observations de morille d'un groupe témoin (autres champignons du même mois) que lorsqu'il est appliqué à l'air ?

Réutilise tools/gbif_meteo.py (échantillon figé research/meteo-obs.json.gz, cache météo de l'air research/meteo-cache.json.gz).
Sorties : research/soiltemp-morille.json, cache research/soiltemp-cache.json.gz. Budget et reprise comme le calibrage météo.
"""
import os, sys, time, json, random, urllib.parse, urllib.error, urllib.request
from datetime import date, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import gbif_meteo as gm

NAME, TRAP, TW = "Morille", [6, 10, 16, 21], 7
LOOK = TW + 1
CACHE = os.path.join(gm.ROOT, "research", "soiltemp-cache.json.gz")
OUT = os.path.join(gm.ROOT, "research", "soiltemp-morille.json")
WORKERS = int(os.environ.get("METEO_WORKERS") or 6)
MAXMIN = float(os.environ.get("SOIL_MAXMIN") or 70)
BG_N = int(os.environ.get("SOIL_BG") or 800)                 # taille du groupe témoin (limite le nombre de plages à récupérer)
BUDGET = float(os.environ.get("SOIL_BUDGET") or 1500)
CANDS = ["soil_temperature_0_to_7cm", "soil_temperature_0cm", "soil_temperature_6cm"]
T0 = time.time()
log = lambda m: print("[%5.0f s] %s" % (time.time() - T0, m), flush=True)
trap = lambda x, a, b, c, d: np.where((x <= a) | (x >= d), 0.0, np.where(x < b, (x - a) / (b - a), np.where(x <= c, 1.0, (d - x) / (d - c))))


def sample():
    """Même échantillon que tools/gbif_meteo.py (même graine, même ordre de tirage)."""
    rnd = random.Random(gm.SEED); cell_of = gm.grid(); saved = gm.load_gz(gm.OBSF, None)
    if saved is None:
        raise SystemExit("échantillon research/meteo-obs.json.gz introuvable")
    sp = {n: gm.to_cells(saved["especes"][n], cell_of, rnd, gm.MAXN_SP) for n, _, _ in gm.SPECIES}
    bm = defaultdict(list)
    for o in gm.to_cells(saved["temoin"], cell_of, rnd):
        bm[o[2]].append(o)
    bg = [o for m in sorted(bm) for o in (rnd.sample(bm[m], gm.BG_PER_MONTH) if len(bm[m]) > gm.BG_PER_MONTH else bm[m])]
    months = {o[2] for o in sp[NAME]}
    return sp[NAME], [o for o in bg if o[2] in months]


def plan(obs):
    per = defaultdict(list)
    for ck, y, m, d in obs:
        D = date(y, m, d); per[ck].append((D - timedelta(LOOK), D))
    rng = []
    for ck, v in per.items():
        v.sort(); s, e = v[0]
        for a, b in v[1:]:
            if a <= e + timedelta(14): e = max(e, b)
            else: rng.append((ck, s, e)); s, e = a, b
        rng.append((ck, s, e))
    return rng


def http_soft(url):
    """Comme gm.http, mais un refus « trop de requêtes simultanées » (429) provoque une courte attente puis une nouvelle tentative :
    seuls les vrais quotas (horaire, journalier) arrêtent le passage."""
    for a in range(40):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=gm.HDR), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            try: body = e.read().decode("utf-8", "replace")[:200]
            except Exception: body = ""
            if e.code == 429:
                if "aily" in body or "ourly" in body: raise gm.Stop("quota Open-Meteo atteint : " + body)
                time.sleep(30 if "inutely" in body else 3 + random.random() * 6); continue
            if e.code >= 500: time.sleep(3 * (a % 5 + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(3)
    raise RuntimeError("trop d'échecs successifs")


def fetch_range(ck, s, e, var):
    la, lo = ck.split(",")
    url = gm.OM + "?" + urllib.parse.urlencode(dict(latitude=la, longitude=lo, start_date=s.isoformat(), end_date=e.isoformat(), hourly=var, timezone="UTC"))
    h = http_soft(url)["hourly"]
    by = defaultdict(list)
    for t, v in zip(h["time"], h[var]):
        if v is not None: by[t[:10]].append(v)
    n = (e - s).days + 1
    means = []
    for i in range(n):
        v = by.get((s + timedelta(i)).isoformat())
        means.append(round(sum(v) / len(v), 2) if v else None)
    time.sleep(1.2)
    return [s.isoformat(), means]


def pick_variable(first):
    ck, s, e = first
    for var in CANDS:
        try:
            r = fetch_range(ck, e - timedelta(3), e, var)
            if any(x is not None for x in r[1]):
                log("variable retenue : %s (valeurs %s)" % (var, r[1])); return var
            log("variable %s : réponse sans valeurs" % var)
        except Exception as ex:
            log("variable %s refusée : %s %s" % (var, type(ex).__name__, str(ex)[:120]))
    return None


def daymap(cache):
    dm = {}
    for ck, rs in cache.items():
        mp = {}
        for s, vals in rs:
            d0 = date.fromisoformat(s)
            for i, v in enumerate(vals):
                if v is not None: mp[d0 + timedelta(i)] = v
        dm[ck] = mp
    return dm


def collect(ranges, cache, var):
    dm = daymap(cache)
    todo = [r for r in ranges if not all(r[1] + timedelta(i) in dm.get(r[0], {}) for i in range((r[2] - r[1]).days + 1))]
    random.Random(1).shuffle(todo)
    batch, used = [], 0.0
    for r in todo:
        w = ((r[2] - r[1]).days + 1) / 14 * 0.1
        if used + w > BUDGET: break
        batch.append(r); used += w
    log("sol : %d plages manquantes, %d dans le budget (poids %.0f)" % (len(todo), len(batch), used))
    stop = {"v": False}

    def work(r):
        if stop["v"] or (time.time() - T0) / 60 > MAXMIN: return r, None
        try: return r, fetch_range(r[0], r[1], r[2], var)
        except gm.Stop as ex: stop["v"] = True; print("ARRÊT :", ex, flush=True); return r, None
        except Exception as ex: print("plage ignorée", r[0], r[1], type(ex).__name__, flush=True); return r, None

    n = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for r, res in ex.map(work, batch):
            if res is None: continue
            cache.setdefault(r[0], []).append(res); n += 1
            if n % 100 == 0: gm.save_gz(CACHE, cache); log("sol : %d plages récupérées sur %d" % (n, len(batch)))
    gm.save_gz(CACHE, cache)
    return len(ranges), len(todo), n


def vectors(obs, dm_soil, dm_air):
    """Pour chaque observation : moyenne sur TW jours de la température du sol et de l'air (observations complètes seulement)."""
    out = []
    for ck, y, m, d in obs:
        ms, ma = dm_soil.get(ck), dm_air.get(ck)
        if not ms or not ma: continue
        D = date(y, m, d); ds = [ms.get(D - timedelta(k)) for k in range(TW)]; da = [ma.get(D - timedelta(k)) for k in range(TW)]
        if any(x is None for x in ds) or any(x is None or x[1] is None for x in da): continue
        out.append((ck, y, m, float(np.mean(ds)), float(np.mean([x[1] for x in da]))))
    return out


def wauc_for(xs, xb, mos, mob):
    wb = gm.wweights(mos, mob)
    return float("nan") if wb.sum() <= 0 else gm.wauc(xs, xb, wb)


def analyse(S, Bg, rnd):
    ys = np.array([o[1] for o in S]); mos = np.array([o[2] for o in S]); cks = [o[0] for o in S]
    yb = np.array([o[1] for o in Bg]); mob = np.array([o[2] for o in Bg]); ckb = [o[0] for o in Bg]
    soil_s, air_s = np.array([o[3] for o in S]), np.array([o[4] for o in S]); soil_b, air_b = np.array([o[3] for o in Bg]), np.array([o[4] for o in Bg])
    res = {"n_obs": len(S), "n_temoin": len(Bg), "trapeze": TRAP, "fenetre_jours": TW}

    def auc(xs, xb, ms=None, mb=None, d=0.0):
        a, b, c, e = [v + d for v in TRAP]
        ms = slice(None) if ms is None else ms; mb = slice(None) if mb is None else mb
        return wauc_for(trap(xs[ms], a, b, c, e), trap(xb[mb], a, b, c, e), mos[ms], mob[mb])

    def ci(xs, xb, B=200):
        ids_s, ids_b = defaultdict(list), defaultdict(list)
        for i, c in enumerate(cks): ids_s[c].append(i)
        for i, c in enumerate(ckb): ids_b[c].append(i)
        cells = sorted(set(ids_s) | set(ids_b)); v = []
        for _ in range(B):
            pick = [rnd.choice(cells) for _ in cells]
            si = np.array([i for c in pick for i in ids_s.get(c, ())], dtype=int); bi = np.array([i for c in pick for i in ids_b.get(c, ())], dtype=int)
            if len(si) < 20 or len(bi) < 20: continue
            a, b, c, e = TRAP
            x = wauc_for(trap(xs[si], a, b, c, e), trap(xb[bi], a, b, c, e), mos[si], mob[bi])
            if x == x: v.append(x)
        return [round(float(np.percentile(v, 2.5)), 3), round(float(np.percentile(v, 97.5)), 3)] if len(v) >= 30 else None

    for lab, xs, xb in (("sol", soil_s, soil_b), ("air", air_s, air_b)):
        wb = gm.wweights(mos, mob)
        out_s = float(np.mean((xs <= TRAP[0]) | (xs >= TRAP[3]))); out_b = float(np.average(((xb <= TRAP[0]) | (xb >= TRAP[3])).astype(float), weights=wb))
        te_s, te_b = ys >= 2024, yb >= 2024
        res[lab] = {"auc": round(auc(xs, xb), 3), "ic95": ci(xs, xb),
                    "auc_2018_2023": round(auc(xs, xb, ys < 2024, yb < 2024), 3),
                    "auc_2024_2025": round(auc(xs, xb, te_s, te_b), 3) if te_s.sum() >= 15 and te_b.sum() >= 50 else None,
                    "hors_trapeze_obs_pct": round(100 * out_s, 1), "hors_trapeze_temoin_pct": round(100 * out_b, 1),
                    "percentiles_obs_5_25_50_75_95": [round(float(np.percentile(xs, q)), 1) for q in (5, 25, 50, 75, 95)],
                    "decalage_trapeze_auc": {"%+d" % d: round(auc(xs, xb, d=d), 3) for d in (-3, -2, -1, 0, 1, 2, 3)}}
    res["ecart_sol_moins_air_mediane_obs"] = round(float(np.median(soil_s - air_s)), 2)
    s, a = res["sol"], res["air"]
    if s["ic95"] and s["ic95"][0] > 0.5 and s["auc"] - a["auc"] >= 0.03:
        res["verdict"] = "HYPOTHÈSE SOUTENUE : le trapèze sur la température du sol discrimine nettement mieux que sur l'air et dépasse le hasard."
    elif s["ic95"] and s["ic95"][0] > 0.5:
        res["verdict"] = "PARTIEL : le sol dépasse le hasard mais pas nettement mieux que l'air."
    else:
        res["verdict"] = "NON SOUTENUE : le trapèze appliqué au sol ne dépasse pas clairement le hasard."
    return res


def main():
    sp, bg = sample()
    log("échantillon : %s %d observations, témoin %d (mois de la morille)" % (NAME, len(sp), len(bg)))
    if len(bg) > BG_N: bg = random.Random(2).sample(bg, BG_N)
    rng = plan(sp + bg)
    cache = gm.load_gz(CACHE, {})
    var = pick_variable(rng[0])                           # une à trois requêtes : on ne parie pas sur un seul nom de variable
    if var is None:
        json.dump({"erreur": "aucune variable de température du sol acceptée", "candidates": CANDS}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
        print("ÉCHEC : aucune variable de température du sol acceptée par l'API"); sys.exit(2)
    nr, nt, nf = collect(rng, cache, var)
    log("plages : %d au total, %d manquantes avant ce passage, %d récupérées" % (nr, nt, nf))
    dm_soil = daymap(cache)
    dm_air = gm.daymap(gm.load_gz(gm.CACHE, {}))          # cache de l'air : {maille: {date: (pluie, T moy, T min)}}
    S, Bg = vectors(sp, dm_soil, dm_air), vectors(bg, dm_soil, dm_air)
    log("observations complètes : %s %d/%d, témoin %d/%d" % (NAME, len(S), len(sp), len(Bg), len(bg)))
    out = {"variable_sol": var, "couverture": {"obs": [len(S), len(sp)], "temoin": [len(Bg), len(bg)]}}
    if len(S) < 60 or len(Bg) < 200:
        out["verdict"] = "COUVERTURE INSUFFISANTE : relancer un passage"; print(out["verdict"])
    else:
        out.update(analyse(S, Bg, random.Random(3)))
        for lab in ("sol", "air"):
            r = out[lab]
            print("%-4s : AUC %.3f IC95 %s | 2018-23 %s | 2024-25 %s | hors trapèze obs %.1f %% / témoin %.1f %% | T° obs p5/25/50/75/95 %s" % (
                lab, r["auc"], r["ic95"], r["auc_2018_2023"], r["auc_2024_2025"], r["hors_trapeze_obs_pct"], r["hors_trapeze_temoin_pct"], r["percentiles_obs_5_25_50_75_95"]))
            print("       décalage du trapèze -> AUC :", r["decalage_trapeze_auc"])
        print("écart médian sol - air (observations) : %+.2f °C" % out["ecart_sol_moins_air_mediane_obs"])
        print("VERDICT :", out["verdict"])
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log("terminé")


if __name__ == "__main__":
    main()
