# Carte des champignons de France

Site : https://mehdizaim0-hub.github.io/Carte-Champignon/

Carte des zones favorables (cèpes, girolles, morilles…) sur une grille de
~2 400 mailles, croisant météo réelle, humidité du sol, gel, sol, forêt,
altitude et calendriers d'observations réelles.

## Comment ça marche (en bref)

1. Chaque jour, un script interroge **Open-Meteo** (service météo public et
   gratuit) : pluie, température, gel, humidité du sol des 14 derniers jours
   et 8 jours de prévision, pour chaque maille de la grille.
2. Le terrain de chaque maille est connu : altitude (Open-Meteo), sol acide
   ou calcaire (**SoilGrids**), type de forêt (**IGN BD Forêt**).
3. Les calendriers de pousse de chaque espèce viennent de milliers
   d'observations réelles en France (**GBIF**).
4. La page croise tout ça et colore la carte : vert = conditions réunies,
   rouge = conditions défavorables. Elle dit où chercher, pas où trouver.

## Pré-requis (une seule fois)

- **Python** : python.org > Download (cocher « Add Python to PATH » à l'installation).
- **Git** : git-scm.com (options par défaut), avec un compte GitHub ayant accès au dépôt.
- Récupérer le projet :
  `git clone https://github.com/mehdizaim0-hub/Carte-Champignon.git`

## Mettre à jour les données et publier (une ligne)

Depuis le dossier du projet :

**Windows (PowerShell)**
```powershell
git pull --rebase; python build_data.py; git add data.json; git commit -m "maj données"; git push
```

**Linux / macOS (bash)**
```bash
git pull --rebase && python3 build_data.py && git add data.json && git commit -m "maj données" && git push
```

Compter 2 à 10 minutes (les messages « nouvel essai » sont normaux : le
service météo demande parfois de ralentir). Au premier `git push`, une
fenêtre GitHub s'ouvre pour se connecter ; ensuite c'est mémorisé.
Sous Windows, `update.bat` (double-clic) fait exactement la même chose.

## Mise à jour automatique

Rien à faire : GitHub Actions relance `build_data.py` chaque matin à 5 h UTC
et publie le résultat (`.github/workflows/daily.yml`). La mise à jour
manuelle ci-dessus ne sert qu'à rafraîchir en cours de journée.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | l'application (la page du site) |
| `data.json` | météo + altitude par maille, régénéré chaque jour |
| `build_data.py` | fabrique `data.json` (Python, aucune dépendance) |
| `terrain.json` | pH du sol + forêt par maille (optionnel, voir ci-dessous) |
| `build_terrain.py` | fabrique `terrain.json` (à lancer une seule fois) |
| `update.bat` | Windows : double-clic pour tout mettre à jour |
| `.github/workflows/daily.yml` | mise à jour automatique quotidienne |

## Affiner le terrain (optionnel, une seule fois)

`python build_terrain.py` interroge SoilGrids (pH du sol) et l'IGN (forêt)
pour chaque maille (~20-40 min, reprend où il s'était arrêté si interrompu).
Commiter le `terrain.json` produit : la page l'utilise automatiquement et
les scores gagnent en précision (une maille en ville cesse d'être « forêt »).
Sans ce fichier, la page fonctionne avec le massif de référence le plus proche.

## Vérifier en local (facultatif)

```
python build_data.py
python -m http.server 8000
```
Puis ouvrir http://localhost:8000 (badge « Météo réelle » attendu).
Ne pas ouvrir `index.html` par double-clic : le navigateur bloquerait la
lecture de `data.json`.

## Les quatre vues de la carte

- **Jour choisi** : score d'une date (météo réelle ou prévue).
- **Zones durables** : moyenne pondérée des 8 prochains jours, pour faire ressortir ce qui reste bon.
- **Meilleur jour** : le pic de la semaine pour chaque zone.
- **Habitat** : sol + forêt + altitude, sans météo. Les massifs propices ressortent en permanence, villes et
  grandes cultures restent incolores.

Le dégradé va de l'incolore (peu favorable) au vert foncé (très favorable). Les meilleures zones du moment
sont renforcées et marquées d'un point. Une espèce hors saison reste incolore partout.

## Sources et calibrage

Voir `research/sources-recoupees-oct2026.md` (études, niveau de preuve par espèce). Pour croiser avec des
observations réelles : `python calibrate_gbif.py` écrit `calibration.json` (saisons et altitudes par espèce).

## Limites connues

- Sans `terrain.json`, sol et forêt sont hérités du massif de référence le
  plus proche (37 zones).
- Les scores sont un modèle écologique, pas des observations de cueillette.
- Sources : Open-Meteo (météo), SoilGrids/ISRIC (sols), IGN BD Forêt v2
  (forêts), GBIF (calendriers d'observations), OpenStreetMap/OpenTopoMap
  (fonds de carte). Merci à eux.
