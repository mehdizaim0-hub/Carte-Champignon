# Carte des champignons de France

Site : https://mehdizaim0-hub.github.io/Carte-Champignon/

Guide technique et pièges connus : [CLAUDE.md](CLAUDE.md) · Sources scientifiques : [research/](research/) · Tests : `npm install && npm test`

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

Le dégradé va de l'incolore (peu favorable) à l'orange vif puis rouille (très favorable). Un contour violet
cerne les meilleures zones de la vue et du jour choisis, et change avec la date. Une espèce hors saison reste
incolore partout.

La couleur est superposée en mode « multiply » sur un fond de carte grisé (case à décocher sous la légende) :
routes, noms de lieux et relief restent lisibles à travers. Les contours sont calculés sur un champ lissé
(interpolation entre mailles), pas sur les carrés de la grille.

## Sources et calibrage

Voir `research/sources-recoupees-oct2026.md` (études, niveau de preuve par espèce). Pour croiser avec des
observations réelles : `python calibrate_gbif.py` écrit `calibration.json` (saisons et altitudes par espèce).

## Rendu, point GPS, forêt fine (oct. 2026)

- **Nuage de points** (rendu par défaut) : la densité et la taille des points suivent le score ; case « Aplat de
  couleur » pour l'ancien rendu. Le contour violet cerne toujours le haut du panier de la vue affichée.
- **Point GPS précis** : toucher la carte, ou saisir « 43.6612, 1.1305 ». La page interroge directement, depuis le
  navigateur, Open-Meteo (météo et altitude exactes), l'IGN (forêt au point) et SoilGrids (pH du sol). Ces trois
  services acceptent les appels depuis une page web (CORS vérifié le 13/10/2026). L'adresse du point est
  partageable (`#p=lat,lon`). Si un service ne répond pas, on garde la valeur de la maille et la page le dit.
- **40 jours de météo passée** (`PAST_DAYS = 40` dans build_data.py) : le cèpe (26 j) et le lactaire (35 j)
  tiennent compte de la pluie cumulée sur une fenêtre longue.
- **Îlots forestiers** : `build_forets.py` demande à l'IGN une image de la forêt par maille et la résume en blocs
  d'environ 1,4 km (`forets.json`). Les petits massifs au milieu de zones bâties ou cultivées apparaissent donc
  quand les conditions sont réunies. À lancer une fois (20 à 40 min, reprend où il s'est arrêté) :
  `python build_forets.py`, ou depuis GitHub : Actions > « Forêt à fine échelle » > Run workflow.
  L'essence (feuillus/résineux) est déduite de la couleur de la légende IGN : approximative ; la présence de forêt
  est fiable. Sans `forets.json`, la carte fonctionne comme avant (mailles de 17 km).

## Fiche espèce, avis sur un point, agglomérations et routes (oct. 2026)

- **Fiche espèce** : photo (Wikipédia / Wikimedia Commons, auteur et licence affichés), arbres hôtes, sol, saison,
  altitude, déclencheurs et critères de reconnaissance. Les photos sont lues en direct depuis Wikipédia.
- **Avis sur un point** : niveau (très peu propice à très propice), comparaison avec le reste de la France, lieu
  (sol, forêt, altitude) distinct des conditions du moment (météo, saison), principal frein, tendance sur 8 jours.
- **Agglomérations et axes routiers** : aucun point n'y est affiché et un point choisi y est déclaré « non propice ».
  `build_urbain.py` (CORINE Land Cover 2018, surfaces artificialisées par blocs de 1,4 km, hors petits villages
  de moins de 25 ha) écrit `urbain.json` ; `build_routes.py` (BD TOPO, importance 1 : autoroutes et grands axes)
  écrit `routes.json`, avec une zone tampon d'environ 140 m visible à partir du zoom 10.
  Lancement : Actions > « Masques agglomérations et routes » > Run workflow (15 à 30 min).
- **Rayon de recherche** : 100 km maximum.

## Sol fin (oct. 2026)

`build_sol.py` lit les cartes SoilGrids (pH, sable, argile, carbone organique) par blocs de 2,8 km et écrit `sol.json`
(prérequis : `pip install rasterio numpy` ; environ 1 à 2 minutes depuis GitHub Actions). Le modèle remplace les trois
catégories (acide, neutre, calcaire) par un pH continu, ajoute une pénalité d'engorgement (argile) et de sol séchant (sable)
et, pour la morille et la coulemelle, un bonus d'humus. Détail et niveaux de preuve : `research/sources-recoupees-oct2026.md`.
Lancement : Actions > « Sol SoilGrids » > Run workflow. Sans `sol.json`, la carte garde les trois catégories.

## Relief et microclimat (oct. 2026)

`build_relief.py` assemble des tuiles d'altitude (AWS Terrain Tiles) et calcule, par blocs de 2,8 km, l'altitude, la pente, l'exposition et la
position topographique, dans `relief.json` (prérequis : `pip install numpy pillow` ; 1 à 3 minutes depuis GitHub Actions).
Le modèle corrige la température selon l'altitude du bloc, favorise versants nord et dépressions quand l'humidité manque, et pénalise les fortes pentes.
Détail et niveaux de preuve : `research/sources-recoupees-oct2026.md`. Lancement : Actions > « Relief » > Run workflow.
Sans `relief.json`, la carte garde l'altitude de la maille. Pour un point précis, la page recalcule pente et exposition sur place.

## Coulemelle en milieu ouvert et meilleurs spots (oct. 2026)

- La coulemelle (saprophyte) n'est plus pénalisée sans forêt : lisières, clairières et prairies sont favorables (valeurs estimées, voir
  `research/sources-recoupees-oct2026.md`). `build_urbain.py` marque pour cela les prairies et milieux ouverts semi-naturels (CORINE) en plus des
  agglomérations ; `urbain.json` est en version 2 (caractères `#` agglomération, `p` milieu ouvert, `.` autre).
  Relance : Actions > « Zones artificialisées et milieux ouverts » > Run workflow.
- Après le choix d'un point, la page propose ses **cinq meilleurs spots à moins de 1 km** (champignons marron), calculés sur des cases de 50 m à partir de
  la forêt IGN à environ 10 m et de l'altitude à 200 m. Il faut un accès réseau à l'IGN et à Open-Meteo ; sinon la page le signale et estime à partir du point.

## Limites connues

- Sans `terrain.json`, sol et forêt sont hérités du massif de référence le
  plus proche (37 zones).
- Les scores sont un modèle écologique, pas des observations de cueillette.
- Sources : Open-Meteo (météo), SoilGrids/ISRIC (sols), IGN BD Forêt v2
  (forêts), GBIF (calendriers d'observations), OpenStreetMap/OpenTopoMap
  (fonds de carte). Merci à eux.
