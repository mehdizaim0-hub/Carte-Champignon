# Synthèse : paramètres du modèle issus de la recherche (oct. 2026)

Sources : 3 rapports détaillés dans ce dossier (conditions-*.md), compilés
depuis MycoDB, guides de cueillette français, littérature (INRA, PubMed),
avec citations. Les valeurs "estimé/INCONNU" des rapports sont interpolées
prudemment ici et marquées (~).

## Paramètres retenus par espèce

| Espèce | T°moy 7j (trap) | Pluie seuil ro | Délai lag (j) | Sol (pH) | Gel | Humidité sol (m³/m³) |
|---|---|---|---|---|---|---|
| Cèpe de Bordeaux | 5-12-19-23 | 35 mm | 8 (5-15) | acide 4.5-6.5 | tue | .12-.28 |
| Girolle | 8-14-20-26 | 30 mm | 6 (3-10) | acide | tue | .12-.28 |
| Morille | 6-10-16-21 | 20 mm | 5 (4-5) | CALCAIRE 7.2-8.1 strict | tue primordia | .14-.30 |
| Trompette de la mort | 2-7-14-19 | 30 mm | 9 (5-13) | ACIDE 4.5-6.0 | léger = stimule ! | .16-.32 (3-4 sem humide) |
| Pied-de-mouton | 3-9-17-21 | 30 mm | 11 (8-14) | acide pH 5.5 | tolère (arrêt < -5) | .13-.29 |
| Lactaire délicieux | 4-10-16-20 | 20 mm | 12* (réel 21-40 !) | ACIDE 5.0-6.5 strict | tolère | .13-.30 |
| Bolet bai | 4-11-18-23 | 30 mm | 9 (~6-12) | acide | tue | .12-.28 |
| Chanterelle en tube | 0-4-11-16 | 30 mm | 11 (~7-15) | acide | léger = stimule | .16-.32 |
| Coulemelle | 7-12-19-25 | 15 mm | 6 (5-8) | peu exigeant pH~6 | tue (<0) | .10-.24 (saprophyte) |

*lactaire : délai réel 21-40 j après pluie, mais la série ne couvre que 14 j
passés ; lag plafonné à 12 avec la pluie la plus ancienne disponible.

## Corrections majeures vs ancien modèle
1. Lactaire délicieux était noté sol calcaire (c:1) -> la recherche dit
   acidité stricte pH 5.0-6.5. Corrigé en a:1, c:.3.
2. Pied-de-mouton idem (pH 5.5) : c:1 -> a:1, c:.5.
3. Trompette : était so calcaire-favorable -> pH 4.5-6.0 acide. Corrigé.
4. Morille : calcaire rendu quasi obligatoire (a:.1) ; pH 7.2-8.1 sourcé.
5. Gel : trompette et chanterelle en tube sont STIMULÉES par les gels légers
   (-1 à -3 °C) -> nouveau mécanisme frost négatif (bonus léger).
6. Choc thermique : amplitude jour/nuit 6-12 °C favorable pour toutes les
   espèces (déclencheur documenté cèpe/morille/pied-de-mouton) -> facteur
   d'amplitude 0.9-1.1 calculé sur 2x(Tmoy-Tmin) des 3 derniers jours.
7. Humidité du sol : exigence par espèce (coulemelle modeste .10-.24,
   chanterelle/trompette très exigeantes .16-.32) au lieu d'une plage unique.
8. Températures : trapèzes recalés sur les plages sol/air sourcées
   (ex. chanterelle en tube espèce froide 0-4-11-16, arrêt > 18 °C).
9. Délais pluie->pousse par espèce affinés (morille 5 j, girolle 6,
   cèpe 8, pied-de-mouton/chanterelle 11, lactaire 12+).

## Mécanisme (page index.html, fonction score)
score = 100 x habitat^0.7 x (température x humidité)^0.9 x saison(GBIF) x gel x amplitude
- habitat = sol(pH) x forêt(IGN ou massif) x altitude
- température : trapèze sur T°moy 7 j
- humidité : humidité du sol réelle 7 j mappée sur la plage de l'espèce,
  pénalité si bilan pluie-ET0 14 j < -40 mm ; repli pluie décalée de lag jours
- saison : poids mensuels GBIF interpolés au jour
- gel : coupe (sensibles), neutre (tolérants), bonus si gel léger (stimulées)
- amplitude : bonus jusqu'à +10 % si choc thermique 6-13 °C
