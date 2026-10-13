# Sources recoupées pour le modèle (oct. 2026)

Recoupement fait par recherche web sur des publications. Aucune de ces sources ne couvre la France
entière : plusieurs études portent sur l'Allemagne, l'Espagne ou le Canada. Les paramètres sont donc des
approximations raisonnables, pas des vérités. Niveau de preuve affiché dans la page : `ev` (2 = études
directes, 1 = partielle, 0 = estimé par prudence).

## Cèpe de Bordeaux (ev 2)
- Brejon Lamartinière & Hoffman, préprint bioRxiv 2025 (non relu par des pairs), hêtraie près de Bielefeld,
  10 ans de suivi : pic de fructification pour une température moyenne d'environ 13 °C sur les 20 jours
  précédents ; la pluie cumulée sur 26 jours augmente la production sans plafond observé.
  https://www.biorxiv.org/content/10.64898/2025.12.12.693895.full.pdf
  -> modèle : fenêtre de température du cèpe portée à 14 j (`tw`), plateau resserré à 11-17 °C.
- Études espagnoles en pinède (Karavani 2018 ; Olano 2020 ; Martínez-Peña 2012) : la pluie et l'humidité
  du sol sont les facteurs dominants, la température compte peu ; la surface terrière du peuplement compte
  (optimum ~40 m²/ha pour le pin sylvestre). https://uvadoc.uva.es/handle/10324/73839
- Limite : la série fournie par Open-Meteo compte 14 jours passés, alors que l'effet de la pluie s'étend sur
  ~26 jours. Allonger `PAST_DAYS` demanderait plus d'appels et alourdirait data.json.

## Girolle (ev 2, hors France)
- Rochon, thèse (Canada) : production liée négativement au pH du sol, et à la température du sol.
  https://www.collectionscanada.gc.ca/obj/thesescanada/vol2/QQLA/TC-QQLA-28370.pdf
- Pin gris, Québec (Can. J. Botany 2011) : pluie de la semaine précédente et température des deux
  semaines précédentes corrélées à la production. https://cdnsciencepub.com/doi/10.1139/b11-058
- Saskatchewan : degrés-jours + 50 à 100 mm cumulés, 6 à 13 semaines avant l'apparition.
  https://www.sciencedirect.com/org/science/article/abs/pii/S0008422021000579

## Morille (ev 1)
- Buscot 1989, forêts rhénanes (Can. J. Botany) : l'apparition dépend du réchauffement du sol au printemps
  (degrés-jours). https://cdnsciencepub.com/doi/abs/10.1139/b89-080
  -> modèle : bonus (`warm`) si la semaine est plus chaude que la précédente. L'air est un proxy du sol.
- Schmidt 1983 (Mycologia) : germination des spores au-delà de ~10 °C de sol, inhibée au-delà de ~15 °C.
  https://www.tandfonline.com/doi/abs/10.1080/00275514.1983.12023762
- *M. dunalii* : sols calcaires, pins d'Alep et chêne vert (Méditerranée). Les autres morilles (cendres,
  vergers, sols brûlés) ne sont pas modélisées.

## Lactaire délicieux (ev 2, Espagne)
- Mengiste Taye et al. 2016 (Pinus pinaster, Espagne centrale) : pluies de fin d'été et d'automne
  positives ; sol acide favorable ; sols sableux et peuplements âgés défavorables.
  https://recercat.cat//handle/10459.1/58592
  -> confirme le sol acide (déjà corrigé dans la refonte).

## Sans source directe trouvée (ev 0)
Trompette de la mort, pied-de-mouton, bolet bai, chanterelle en tube, coulemelle : paramètres issus des
rapports de ce dossier et d'interpolations prudentes.

## Observations réelles (GBIF)
Les calendriers mensuels viennent déjà de GBIF (champ `gb`). `calibrate_gbif.py` ajoute l'altitude et un
profil mensuel par espèce, à lancer en local (l'API GBIF n'est pas joignable depuis tous les environnements).
