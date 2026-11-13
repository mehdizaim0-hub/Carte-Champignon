#!/usr/bin/env python3
"""Calibrage météo sur observations réelles (GBIF, France) : délai pluie -> pousse, fenêtres de pluie, températures, gel.

Principe : pour chaque espèce, on compare la météo des jours qui précèdent ses observations à celle des jours qui précèdent
des observations d'autres champignons (groupe témoin, même mois). Cela retire l'essentiel du biais « on sort quand il fait
beau ». Indicateur : AUC pondérée (0,5 = aucun signal ; > 0,5 = l'espèce est observée après plus de pluie que le témoin).
Météo : archive Open-Meteo (réanalyse ERA5), par maille de data.json. Le quota gratuit impose un budget par exécution
(METEO_BUDGET) : l'échantillon d'observations et le cache météo sont enregistrés dans le dépôt, on relance jusqu'à couverture.

Biais connus : une date d'observation n'est pas une date de sortie ; les observateurs se concentrent près des villes et des
routes ; la réanalyse n'est pas exactement la météo des prévisions utilisée par l'appli ; pas de vraies absences.
Sorties : research/calibration-meteo.json (et résumé lisible sur la sortie standard).
"""
import gzip, json, os, random, sys, time, urllib.parse, urllib.request, urllib.error
from collections import Counter, defaultdict
from datetime import date, timedelta
import numpy as np

ROOT = os.getcwd()
Y0, Y1, TEST_FROM = 2018, 2025, 2024          # années utilisées ; années de test (validation hors échantillon)
LOOKBACK = 45                                  # jours de météo avant chaque observation
WINS = (7, 14, 21)                             # longueurs de fenêtre de pluie testées (jours)
DMAX = 25                                      # délai maximal testé (jours)
BUDGET = float(os.environ.get("METEO_BUDGET") or 3000)   # poids d'appels Open-Meteo pour ce passage
SEED = 42
MAXN_SP, BG_PER_MONTH, BG_PAGES, BG_LIMIT = 1200, 250, 3, 100
# (nom affiché, nom scientifique GBIF, lag actuel de species.js)
SPECIES = [("Cèpe de Bordeaux", "Boletus edulis", 8), ("Girolle", "Cantharellus cibarius", 6), ("Morille", "Morchella", 5)]
CACHE = os.path.join(ROOT, "research", "meteo-cache.json.gz")
OBSF = os.path.join(ROOT, "research", "meteo-obs.json.gz")
OUT = os.path.join(ROOT, "research", "calibration-meteo.json")
GB = "https://api.gbif.org/v1"
OM = "https://archive-api.open-meteo.com/v1/archive"
HDR = {"User-Agent": "carte-champignon-calibrage/1.0 (GitHub Actions)"}
BASE = dict(country="FR", basisOfRecord="HUMAN_OBSERVATION", hasCoordinate="true", hasGeospatialIssue="false")


class Stop(Exception):
    pass


def http(url, tries=5):
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", "replace")[:300]
            except Exception:
                body = ""
            if e.code == 429:
                if "aily" in body:
                    raise Stop("quota quotidien atteint : " + body)
                if t >= 2:
                    raise Stop("limite de débit (429) : " + body)
                time.sleep(65)
                continue
            if e.code >= 500 and t < tries - 1:
                time.sleep(3 * (t + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if t == tries - 1:
                raise
            time.sleep(3 * (t + 1))


def gbif(**p):
    return http(GB + "/occurrence/search?" + urllib.parse.urlencode(p))


def parse(r):
    y, m, d = r.get("year"), r.get("month"), r.get("day")
    la, lo = r.get("decimalLatitude"), r.get("decimalLongitude")
    if None in (y, m, d, la, lo) or "/" in (r.get("eventDate") or ""):
        return None
    u = r.get("coordinateUncertaintyInMeters")
    if u is not None and u > 1000:
        return None
    try:
        date(y, m, d)
    except ValueError:
        return None
    return [y, m, d, la, lo]


def fetch_species(name):
    key = http(GB + "/species/match?" + urllib.parse.urlencode({"name": name}))["usageKey"]
    out, off = [], 0
    while off <= 99700:
        d = gbif(taxonKey=key, limit=300, offset=off, year="%d,%d" % (Y0, Y1), **BASE)
        out += [o for o in map(parse, d.get("results", [])) if o]
        off += 300
        if d.get("endOfRecords") or not d.get("results"):
            break
        time.sleep(.15)
    return out


def fetch_bg(months, rnd):
    """Champignons (règne Fungi, taxonKey 5) : quelques petites pages à décalages aléatoires par année et mois."""
    out = []
    for y in range(Y0, Y1 + 1):
        for m in months:
            c = gbif(taxonKey=5, limit=0, year=str(y), month=m, **BASE)["count"]
            if c == 0:
                continue
            hi = max(1, min(c, 100000) - BG_LIMIT)
            for off in rnd.sample(range(0, hi), min(BG_PAGES, hi)):
                d = gbif(taxonKey=5, limit=BG_LIMIT, offset=off, year=str(y), month=m, **BASE)
                out += [o for o in map(parse, d.get("results", [])) if o]
                time.sleep(.15)
    return out


def load_gz(p, default):
    if os.path.exists(p):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_gz(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with gzip.open(p, "wt", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))


# ---------- grille de mailles (celle de data.json) ----------
def grid():
    cells = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf-8"))["cells"]
    la = sorted({c[0] for c in cells}); lo = sorted({c[1] for c in cells})
    dla = min(b - a for a, b in zip(la, la[1:])); dlo = min(b - a for a, b in zip(lo, lo[1:]))
    la0, lo0 = la[0], lo[0]
    cm = {(round((c[0] - la0) / dla), round((c[1] - lo0) / dlo)): "%.4f,%.4f" % (c[0], c[1]) for c in cells}
    return lambda lat, lon: cm.get((round((lat - la0) / dla), round((lon - lo0) / dlo)))


def to_cells(obs, cell_of, rnd, cap=None):
    """[(maille, a, m, j)] dédoublonné par (maille, date), éventuellement sous-échantillonné."""
    seen, out = set(), []
    for y, m, d, la, lo in obs:
        ck = cell_of(la, lo)
        if ck and (ck, y, m, d) not in seen:
            seen.add((ck, y, m, d)); out.append((ck, y, m, d))
    if cap and len(out) > cap:
        out = rnd.sample(out, cap)
    return out


# ---------- météo ----------
def plan(all_obs):
    per = defaultdict(list)
    for ck, y, m, d in all_obs:
        D = date(y, m, d)
        per[ck].append((D - timedelta(LOOKBACK), D))
    rng = []
    for ck, v in per.items():
        v.sort(); s, e = v[0]
        for a, b in v[1:]:
            if a <= e + timedelta(14):
                e = max(e, b)
            else:
                rng.append((ck, s, e)); s, e = a, b
        rng.append((ck, s, e))
    return rng


def daymap(cache):
    dm = {}
    for ck, rs in cache.items():
        mp = {}
        for s, P, T, N in rs:
            d0 = date.fromisoformat(s)
            for i, v in enumerate(zip(P, T, N)):
                mp[d0 + timedelta(i)] = v
        dm[ck] = mp
    return dm


def collect(ranges, cache, rnd):
    dm = daymap(cache)
    todo = [r for r in ranges if not all(r[1] + timedelta(i) in dm.get(r[0], {}) for i in range((r[2] - r[1]).days + 1))]
    rnd.shuffle(todo)
    used, n = 0.0, 0
    for ck, s, e in todo:
        w = ((e - s).days + 1) / 14 * 0.3            # poids Open-Meteo : lieux x (jours/14) x (variables/10)
        if used + w > BUDGET:
            break
        la, lo = ck.split(",")
        url = OM + "?" + urllib.parse.urlencode(dict(latitude=la, longitude=lo, start_date=s.isoformat(), end_date=e.isoformat(),
                                                     daily="precipitation_sum,temperature_2m_mean,temperature_2m_min", timezone="UTC"))
        try:
            d = http(url)
        except Stop as ex:
            print("ARRÊT :", ex); break
        except urllib.error.HTTPError as ex:
            print("plage ignorée", ck, s, e, ex.code); continue
        dd = d["daily"]
        cache.setdefault(ck, []).append([dd["time"][0], dd["precipitation_sum"], dd["temperature_2m_mean"], dd["temperature_2m_min"]])
        used += w; n += 1
        if n % 100 == 0:
            save_gz(CACHE, cache)
        time.sleep(max(.4, w / 7))                   # reste sous 600 poids/minute
    save_gz(CACHE, cache)
    return len(ranges), len(todo), n, used


def arrays(obs, dm):
    rows, meta = [], []
    for ck, y, m, d in obs:
        mp = dm.get(ck)
        if not mp:
            continue
        D = date(y, m, d)
        v = [mp.get(D - timedelta(k)) for k in range(LOOKBACK + 1)]
        if any(x is None or None in x for x in v):
            continue
        rows.append(v); meta.append((ck, y, m))
    if not rows:
        return None
    A = np.array(rows, dtype=float)
    return A[:, :, 0], A[:, :, 1], A[:, :, 2], meta


# ---------- statistiques ----------
def cum(P):
    return np.concatenate([np.zeros((len(P), 1)), np.cumsum(P, axis=1)], axis=1)


def wauc(xs, xb, wb):
    o = np.argsort(xb); xo = xb[o]; cw = np.concatenate([[0.0], np.cumsum(wb[o])]); tot = cw[-1]
    lo = np.searchsorted(xo, xs, side="left"); hi = np.searchsorted(xo, xs, side="right")
    return float(np.mean((cw[lo] + 0.5 * (cw[hi] - cw[lo])) / tot))


def wweights(mos, mob):
    cs, cb = Counter(mos.tolist()), Counter(mob.tolist())
    return np.array([(cs.get(m, 0) / len(mos)) / (cb[m] / len(mob)) for m in mob.tolist()])


def auc_cfg(Cs, Cb, mos, mob, d, w):
    wb = wweights(mos, mob)
    if wb.sum() <= 0:
        return float("nan")
    return wauc(Cs[:, d + w] - Cs[:, d], Cb[:, d + w] - Cb[:, d], wb)


def boot_ci(Cs, Cb, cks, ckb, mos, mob, d, w, rnd, B=200):
    """Intervalle à 95 % par rééchantillonnage des mailles (les observations d'une même maille ne sont pas indépendantes)."""
    ids_s, ids_b = defaultdict(list), defaultdict(list)
    for i, c in enumerate(cks): ids_s[c].append(i)
    for i, c in enumerate(ckb): ids_b[c].append(i)
    cells = sorted(set(ids_s) | set(ids_b)); res = []
    for _ in range(B):
        pick = [rnd.choice(cells) for _ in cells]
        si = np.array([i for c in pick for i in ids_s.get(c, ())], dtype=int)
        bi = np.array([i for c in pick for i in ids_b.get(c, ())], dtype=int)
        if len(si) < 20 or len(bi) < 20:
            continue
        a = auc_cfg(Cs[si], Cb[bi], mos[si], mob[bi], d, w)
        if a == a:
            res.append(a)
    return [round(float(np.percentile(res, 2.5)), 3), round(float(np.percentile(res, 97.5)), 3)] if len(res) >= 30 else None


def profile(Cs, Cb, mos, mob, w=3):
    return [auc_cfg(Cs, Cb, mos, mob, d, w) for d in range(DMAX + 1)]


def peak(prof):
    """Position du pic du profil, lissé sur 3 jours (le profil jour par jour est bruité)."""
    v = np.array(prof, dtype=float); sm = []
    for i in range(len(v)):
        nb = [x for x in v[max(0, i - 1):i + 2] if x == x]
        sm.append(np.mean(nb) if nb else -1)
    return int(np.argmax(sm)), sm


def boot_peak(Cs, Cb, cks, ckb, mos, mob, rnd, B=150):
    ids_s, ids_b = defaultdict(list), defaultdict(list)
    for i, c in enumerate(cks): ids_s[c].append(i)
    for i, c in enumerate(ckb): ids_b[c].append(i)
    cells = sorted(set(ids_s) | set(ids_b)); pk = []
    for _ in range(B):
        pick = [rnd.choice(cells) for _ in cells]
        si = np.array([i for c in pick for i in ids_s.get(c, ())], dtype=int)
        bi = np.array([i for c in pick for i in ids_b.get(c, ())], dtype=int)
        if len(si) < 20 or len(bi) < 20:
            continue
        pk.append(peak(profile(Cs[si], Cb[bi], mos[si], mob[bi]))[0])
    return [int(np.percentile(pk, 2.5)), int(np.percentile(pk, 50)), int(np.percentile(pk, 97.5))] if len(pk) >= 30 else None


def wperc(x, w, qs):
    o = np.argsort(x); x, w = x[o], w[o]; c = np.cumsum(w) / w.sum()
    return [round(float(x[min(int(np.searchsorted(c, q / 100)), len(x) - 1)]), 1) for q in qs]


def analyse(sp, bg, lag, rnd):
    Ps, Ts, Ns, ms = sp; Pb, Tb, Nb, mb = bg
    cks, ckb = [x[0] for x in ms], [x[0] for x in mb]
    ys, yb = np.array([x[1] for x in ms]), np.array([x[1] for x in mb])
    mos, mob = np.array([x[2] for x in ms]), np.array([x[2] for x in mb])
    Cs, Cb = cum(Ps), cum(Pb)
    wb = wweights(mos, mob)
    tr_s, tr_b = ys < TEST_FROM, yb < TEST_FROM
    grid_all, grid_tr = {}, {}
    for w in WINS:
        for d in range(DMAX + 1):
            if d + w > LOOKBACK + 1:
                continue
            grid_all[(d, w)] = auc_cfg(Cs, Cb, mos, mob, d, w)
            if tr_s.sum() >= 30 and tr_b.sum() >= 100:
                grid_tr[(d, w)] = auc_cfg(Cs[tr_s], Cb[tr_b], mos[tr_s], mob[tr_b], d, w)
    res = {"n_obs": len(ms), "n_temoin": len(mb), "lag_actuel": lag,
           "courbe_w14": [[d, round(grid_all[(d, 14)], 3)] for d in range(DMAX + 1) if (d, 14) in grid_all]}

    def cfg(d, w):
        a = grid_all.get((d, w))
        return {"delai": d, "fenetre": w, "auc": round(a, 3), "ic95": boot_ci(Cs, Cb, cks, ckb, mos, mob, d, w, rnd)} if a == a else None

    res["config_appli_actuelle"] = cfg(max(0, lag - 4), 14)      # fenêtre 14 j qui se termine à i - lag + 4
    res["config_documentee"] = cfg(min(lag, DMAX), 14)           # fenêtre 14 j qui se termine à i - lag
    best = max((k for k, v in grid_all.items() if v == v), key=lambda k: grid_all[k])
    res["meilleur_global"] = cfg(*best)
    if grid_tr:
        bt = max((k for k, v in grid_tr.items() if v == v), key=lambda k: grid_tr[k])
        te_s, te_b = ~tr_s, ~tr_b
        ta = auc_cfg(Cs[te_s], Cb[te_b], mos[te_s], mob[te_b], *bt) if te_s.sum() >= 30 and te_b.sum() >= 100 else float("nan")
        res["meilleur_train_puis_test"] = {"delai": bt[0], "fenetre": bt[1], "auc_train": round(grid_tr[bt], 3),
                                           "n_test": int(te_s.sum()), "auc_test": None if ta != ta else round(ta, 3)}
    prof = profile(Cs, Cb, mos, mob)
    pk, sm = peak(prof)
    res["profil_3j"] = [[d, round(a, 3)] for d, a in enumerate(prof) if a == a]
    res["delai_estime"] = {"pic": pk, "auc_au_pic": round(float(sm[pk]), 3), "pic_ic95_med": boot_peak(Cs, Cb, cks, ckb, mos, mob, rnd),
                           "centre_mesure": pk + 1.0, "centre_fenetre_appli": lag + 2.5, "centre_fenetre_documentee": lag + 6.5}
    qs = (5, 25, 50, 75, 95)
    T7s, T7b = Ts[:, :7].mean(axis=1), Tb[:, :7].mean(axis=1)
    res["temp_moy_7j"] = {"percentiles": list(qs), "obs": [round(float(np.percentile(T7s, q)), 1) for q in qs], "temoin": wperc(T7b, wb, qs)}
    def share(N, k, thr, w=None):
        f = (N[:, :k].min(axis=1) < thr).astype(float)
        return round(float(np.average(f, weights=w)), 3)
    res["gel_3j"] = {"tmin_sous_0": {"obs": share(Ns, 3, 0), "temoin": share(Nb, 3, 0, wb)},
                     "tmin_sous_-3": {"obs": share(Ns, 3, -3), "temoin": share(Nb, 3, -3, wb)}}
    return res


def show(name, r):
    print("\n=== %s : %d observations, %d témoins ===" % (name, r["n_obs"], r["n_temoin"]))
    for k, lab in (("config_appli_actuelle", "appli actuelle (lag-4)"), ("config_documentee", "définition documentée (lag)"), ("meilleur_global", "meilleur mesuré")):
        c = r.get(k)
        if c: print("  %-30s délai %2d j, fenêtre %2d j : AUC %.3f  IC95 %s" % (lab, c["delai"], c["fenetre"], c["auc"], c["ic95"]))
    e = r.get("delai_estime")
    if e: print("  DÉLAI MESURÉ (fenêtres 3 j) : pic à %d j avant l'observation, IC95 du pic [bas, médian, haut] = %s, AUC au pic %.3f" % (e["pic"], e["pic_ic95_med"], e["auc_au_pic"]))
    if e: print("  centre de la pluie prise en compte : mesuré %.1f j | appli actuelle %.1f j | définition documentée %.1f j" % (e["centre_mesure"], e["centre_fenetre_appli"], e["centre_fenetre_documentee"]))
    t = r.get("meilleur_train_puis_test")
    if t: print("  choisi sur 2018-2023 -> test 2024-25 : délai %d fenêtre %d : AUC train %.3f, test %s (n=%d)" % (t["delai"], t["fenetre"], t["auc_train"], t["auc_test"], t["n_test"]))
    print("  T° moy 7 j (p5/25/50/75/95)  obs %s  témoin %s" % (r["temp_moy_7j"]["obs"], r["temp_moy_7j"]["temoin"]))
    print("  gel 3 j  <0 °C : obs %.1f %% / témoin %.1f %%   < -3 °C : obs %.1f %% / témoin %.1f %%" % (
        100 * r["gel_3j"]["tmin_sous_0"]["obs"], 100 * r["gel_3j"]["tmin_sous_0"]["temoin"],
        100 * r["gel_3j"]["tmin_sous_-3"]["obs"], 100 * r["gel_3j"]["tmin_sous_-3"]["temoin"]))


def main():
    rnd = random.Random(SEED)
    cell_of = grid()
    saved = load_gz(OBSF, None)
    if saved is None:                                  # échantillon figé une fois pour toutes : le cache météo reste valable
        print("Collecte GBIF…")
        sp_raw = {n: fetch_species(s) for n, s, _ in SPECIES}
        months = sorted({m for v in sp_raw.values() for m in {o[1] for o in v} if sum(1 for o in v if o[1] == m) >= 5})
        print("mois retenus pour le témoin :", months)
        bg_raw = fetch_bg(months, rnd)
        saved = {"especes": sp_raw, "temoin": bg_raw, "mois": months}
        save_gz(OBSF, saved)
    sp = {n: to_cells(saved["especes"][n], cell_of, rnd, MAXN_SP) for n, _, _ in SPECIES}
    bm = defaultdict(list)
    for o in to_cells(saved["temoin"], cell_of, rnd):
        bm[o[2]].append(o)
    bg = [o for m in sorted(bm) for o in (rnd.sample(bm[m], BG_PER_MONTH) if len(bm[m]) > BG_PER_MONTH else bm[m])]
    print("observations : " + ", ".join("%s %d" % (n, len(v)) for n, v in sp.items()) + " ; témoin %d" % len(bg))
    cache = load_gz(CACHE, {})
    allo = [o for v in sp.values() for o in v] + bg
    nr, nt, nf, used = collect(plan(allo), cache, rnd)
    print("plages météo : %d au total, %d manquantes avant ce passage, %d récupérées (poids %.0f, budget %.0f)" % (nr, nt, nf, used, BUDGET))
    dm = daymap(cache)
    B = arrays(bg, dm)
    out = {"meta": {"annees": [Y0, Y1], "test_depuis": TEST_FROM, "budget": BUDGET, "plages_total": nr, "plages_manquantes": max(0, nt - nf),
                    "avertissement": "AUC 0,5 = aucun signal. Indice de conditions associées aux observations, pas une probabilité de trouver."},
           "especes": {}}
    for name, _, lag in SPECIES:
        S = arrays(sp[name], dm)
        if S is None or B is None or len(S[3]) < 60 or len(B[3]) < 200:
            print("\n%s : couverture météo insuffisante pour l'instant (%s observations complètes) — relancer." % (name, len(S[3]) if S else 0))
            continue
        print("\n%s : %d/%d observations avec météo complète ; témoin %d/%d" % (name, len(S[3]), len(sp[name]), len(B[3]), len(bg)))
        r = analyse(S, B, lag, rnd); out["especes"][name] = r; show(name, r)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nOK :", OUT)


if __name__ == "__main__":
    main()
