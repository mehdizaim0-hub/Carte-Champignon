# Carte des champignons de France

Fichiers : `index.html` (l'application), `build_data.py` (météo + altitude quotidiennes), `.github/workflows/daily.yml` (automatisation).

## Mise en ligne gratuite (GitHub Pages)
1. Créez un dépôt GitHub et déposez ces fichiers à la racine.
2. Settings > Pages > Source : branche `main`, dossier `/ (root)`.
3. Onglet Actions > « Mise à jour quotidienne » > Run workflow (génère le premier `data.json`).
4. Ensuite `data.json` est régénéré chaque matin à 5 h UTC.

En local : `python3 build_data.py` puis `python3 -m http.server` et ouvrez http://localhost:8000.

## Limites connues
- Sol, type de forêt et microclimat sont hérités du massif de référence le plus proche (37 zones). Une maille en ville peut donc apparaître « forestière ».
- Pour affiner : croiser chaque maille avec la BD Forêt (IGN) et la carte des sols (BRGM), puis remplacer `so`, `fo`, `mi` dans `loadLive()`.
- Les scores sont un modèle écologique, pas des observations de cueillette.
