# Améliorer la précision des scores — pistes vérifiées (oct. 2026)

Chaque piste ci-dessous a été testée en direct contre l'API concernée.
Classées par rapport gain/effort.

## 1. Humidité réelle du sol (Open-Meteo) — GRATUIT, ZÉRO DÉPENDANCE
Open-Meteo expose déjà, sur le même endpoint que celui de `build_data.py` :
`soil_moisture_0_to_10cm_mean` (m³/m³), `et0_fao_evapotranspiration` (mm),
`temperature_2m_min` (gelées), `shortwave_radiation_sum`.
Vérifié : une seule requête renvoie tout.
- La pluie cumulée 14 j est un proxy ; l'humidité du sol 0-10 cm EST la
  variable que sentent les mycéliums. ET0 permet de modéliser le dessèchement
  (pluie - évapotranspiration = bilan hydrique réel).
- T° min < 2 °C coupe la pousse (gel) : aujourd'hui invisible dans le modèle.
- Coût : +3 champs dans `daily=` de build_data.py, +2 facteurs dans score().

## 2. Phénologie réelle par espèce (GBIF) — CALIBRATION DU MODÈLE
api.gbif.org : observations naturalistes réelles, France, par espèce.
Vérifié : Boletus edulis 2 821 obs FR, Cantharellus cibarius 2 221,
Craterellus cornucopioides 1 500, Lactarius deliciosus 813, Morchella 567.
Le facet `month` donne la vraie saisonnalité : cèpe FR = pic sept (715) /
oct (984) / nov (267) — cohérent avec s:[8,11] mais avec des épaules réelles.
- Usage A (simple) : recalibrer à la main les fenêtres s:[..] et courbes t:[..]
  de chaque espèce avec l'histogramme mensuel GBIF.
- Usage B (avancé) : télécharger les occurrences géolocalisées, croiser avec
  altitude/climat de chaque point pour ajuster al:[..] par espèce.
- Usage C (bonus carte) : densité d'observations GBIF par maille = indice
  "spot confirmé par des cueilleurs" affichable en surcouche.

## 3. pH réel du sol par maille (SoilGrids/ISRIC) — REMPLACE L'HÉRITAGE DES 37 MASSIFS
rest.isric.org/soilgrids/v2.0 : pH H2O mondial à 250 m, gratuit.
Vérifié : Millevaches -> pH 5,4 (acide, correct) ; renvoie null sur certains
points urbains (prévoir fallback massif le plus proche).
- Aujourd'hui le sol (a/c/n) est copié du massif de référence le plus proche,
  parfois à 80 km. Avec SoilGrids : pH < 5,5 = acide, 5,5-6,8 = neutre,
  > 6,8 = calcaire, PAR MAILLE.
- 2 419 requêtes une seule fois (le pH ne change pas) -> cache dans un
  fichier `sols.json` commité, build_data.py n'y touche plus.

## 4. Vraie couverture forestière par maille
Deux options vérifiées accessibles :
- IGN Géoplateforme (data.geopf.fr, WMS/WFS BD Forêt v2) : répond 200.
  Type de peuplement (feuillus/résineux/mixte) précis France entière.
- Alternative plus simple : Copernicus/ESA WorldCover 10 m (classe arbre),
  ou OSM landuse=forest via Overpass.
- Usage : % forêt + type par maille, une fois, cache `forets.json`.
  Une maille en plein champ ou en ville tombe à ~0 au lieu d'hériter
  "forêt mixte" du massif voisin.
- C'est le plus gros gain visuel : la carte cesse de colorier les villes.

## 5. Raffinements du modèle sans nouvelle donnée (gratuits immédiatement)
- Fenêtre de pousse décalée : un cèpe sort 5-12 jours APRÈS la pluie
  déclencheuse. Scorer la pluie J-21..J-7 plutôt que J-14..J0 (constante
  par espèce : morille ~5 j, cèpe ~10 j).
- Choc thermique : la morille et le cèpe aiment une amplitude jour/nuit
  marquée après pluie ; calculable avec temperature_2m_min/max.
- Gel : score x0 si t_min < 0 °C sur les 3 derniers jours (sauf espèces
  tardives type chanterelle en tube).
- Exposition : avec la grille fine, pente/orientation dérivables des
  altitudes des mailles voisines (nord = frais/humide, bonus été).

## Ordre recommandé
1 (météo sol, 30 min) -> 5 (modèle, 1 h) -> 3 (pH, script one-shot)
-> 4 (forêt, one-shot) -> 2B/2C (GBIF avancé).

## Garde-fous
- Open-Meteo gratuit : ~10 000 requêtes/jour. La grille 2 419 mailles par
  lots de 40 = 61 requêtes/jour, très loin du plafond, même avec 3 champs
  de plus.
- SoilGrids et GBIF : à ne lancer qu'une fois (caches commités), pas dans
  le workflow quotidien.
- Les scores restent un modèle d'habitat : ils disent où chercher,
  pas où trouver.
