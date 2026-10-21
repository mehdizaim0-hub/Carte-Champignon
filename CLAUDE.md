# Guide du projet (pour qui reprend le travail)

Carte des zones favorables aux champignons en France : météo réelle des 40 derniers jours + prévisions à J+7, sol, forêt, relief.
Site statique servi par GitHub Pages : https://mehdizaim0-hub.github.io/Carte-Champignon/ (branche `main`, racine du dépôt).
Pas de serveur : la page lit des fichiers JSON du dépôt et interroge quelques services depuis le navigateur.

## Carte des fichiers

| Fichier | Rôle | Produit par | Fréquence |
|---|---|---|---|
| `index.html` | toute l'application (HTML, CSS, JS, ~1 300 lignes) | à la main | — |
| `data.json` | météo par maille de 17 km (2 419 mailles, 48 jours) | `build_data.py` (Open-Meteo) | **chaque jour 5 h UTC** (`daily.yml`) |
| `forets.json` | forêt par blocs de 1,4 km (IGN BD Forêt, image 480 px) | `build_forets.py` | rare (`forets.yml`) |
| `urbain.json` | blocs artificialisés et milieux ouverts (CORINE) | `build_urbain.py` | rare (`urbain.yml`) |
| `routes.json` | autoroutes et grands axes (BD TOPO) | `build_routes.py` | rare (`masques.yml`) |
| `sol.json` | pH, sable, argile, carbone organique, blocs de 2,8 km (SoilGrids) | `build_sol.py` | rare (`sol.yml`) |
| `relief.json` | altitude, pente, exposition, position topographique, blocs de 2,8 km | `build_relief.py` | rare (`relief.yml`) |
| `terrain.json` | pH et forêt par maille (ancien, sert de repli) | `build_terrain.py` | rare |
| `research/` | sources scientifiques et justification des paramètres | à la main | — |
| `tests/` | `validate_data.py` (intégrité des données), `page.test.js` (page entière), `screens.py` (captures) | — | à chaque push (`ci.yml`) |

Les scripts `build_*.py` n'ont **aucune dépendance** sauf `build_sol.py` et `build_relief.py` (numpy, rasterio, pillow : installés par leur workflow).
Les collectes lourdes se lancent depuis GitHub (Actions > workflow > Run workflow), car la sandbox de travail ne joint ni l'IGN, ni SoilGrids, ni Open-Meteo.

## Architecture de `index.html`

Un seul script, sections dans l'ordre :
1. **Données et paramètres** : `SP` (9 espèces : saison `gb`, température `t`, pluie `ro`, sol `ph/pf/wc/ws`, altitude `al`, forêt `fo`, fiche), `REF` (massifs de référence, repli).
2. **Modèle** : `weather()` (fenêtres de pluie et de température, gel, humidité du sol, correction d'altitude), `score()` = `100 × sol × altitude × forêt^0,7 × M` où `M` = météo × saison × gel × amplitude × relief ; `viewScore()` (vues jour, durable, meilleur jour, habitat), `soilFactor()`, `terrainFactors()`.
3. **Champ de score** : `buildField()` (grossier, mailles) ou `buildFineField()` (blocs de forêt de 1,4 km, sol et relief par blocs), `fieldAt()`, `outlineSegs()` (contours par marching squares), `drawDots()` (nuage de points), `paintHeat()` (aplat).
4. **Interface** : `build()` (câblage), `render()` (tout redessiner), `renderDetail()` (carte du point), `renderSpecies()` (fiche + photo Wikipédia), `setPoint()`/`makeZone()`/`refinePoint()` (point GPS, avec appels directs Open-Meteo, IGN, SoilGrids), préférences (`loadPrefs`/`savePrefs`, `localStorage` + hash `#e=espèce&v=vue&p=lat,lon`).
5. **Chargement** : `loadLive()` charge `data.json` puis `forets/urbain/routes/sol/relief` en parallèle.

Conventions : français partout (texte, commentaires) ; les identifiants HTML sont stables (`chips`, `views`, `days`, `detail`, `near`, `gps`, `mode`…), les tests s'appuient dessus.

## Travailler sur le projet

```
npm install            # une fois (jsdom, leaflet)
npm test               # validation des données + test de la page entière (25 vérifications)
```
Cycle recommandé : modifier → `npm test` → pousser → lancer **Actions > Captures d'écran** (branche `screenshots`, images bureau et mobile de la vraie page) → regarder les images.
Les patchs se font par remplacement de texte exact : toujours contrôler `node --check` du script (`<script>` final) avant de pousser.

## Pièges connus (déjà rencontrés)

- **Clés de maille** : un flottant entier s'écrit `48.0` en Python et `48` en JavaScript. La page utilise `ckey()` ; `tests/validate_data.py` vérifie que toutes les mailles retrouvent forêt, masque et terrain. Ce défaut avait créé des bandes de forêt à 42°, 45°, 48° et 51° de latitude.
- **Précision des images IGN** : à 96 px le serveur gonfle le boisement ; garder 480 px (`research/sources-recoupees-oct2026.md`).
- **Réseau** : la sandbox ne joint que GitHub, PyPI, npm. Tout le reste passe par un workflow Actions (qui écrit son résultat dans le dépôt, car les journaux ne sont pas téléchargeables).
- **Pousser depuis un workflow** : toujours `for i in 1 2 3; do git pull --rebase && git push && break || sleep 5; done` (le workflow quotidien pousse aussi).
- **Données et pas de temps** : `data.json` contient 40 jours passés + 8 de prévision ; la page déduit « aujourd'hui » de la date de début (`st.off`).
- **Jeton GitHub** : jamais dans un fichier ni dans l'URL d'un `git remote` enregistré ; à révoquer après chaque session de travail.

## Rigueur scientifique

Les paramètres par espèce sont documentés dans `research/` avec un niveau de preuve (étayé / partiel / estimé), affiché dans la fiche de l'espèce. Les scores sont un **indice de conditions réunies**, pas une probabilité de trouver : aucune validation sur des cueillettes réelles n'a été faite (`calibrate_gbif.py` prépare une comparaison saisons/altitudes avec GBIF). Ne jamais présenter un paramètre estimé comme étayé.
