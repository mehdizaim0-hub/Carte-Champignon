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

## Forêt à fine échelle (IGN BD Forêt v2) — mesures du 14/10/2026
- Couche WMS `LANDCOVER.FORESTINVENTORY.V2` (data.geopf.fr). Sa légende donne les classes : forêts fermées par essence
  (verts = feuillus, bleus/violets/cyan = conifères, orange/rouge = mélanges), forêts ouvertes (gris et pastels),
  peupleraie, lande, formation herbacée (jaunes/beiges). `build_forets.py` en déduit feuillus / résineux / mélange et
  ignore les jaunes, beiges, gris et pastels.
- **La résolution demandée change le résultat** : le serveur gonfle le boisement des paysages morcelés quand
  l'image est petite. Part boisée mesurée sur une même maille (96 / 192 / 288 / 480 / 720 px) :
  Gers 51 / 38 / 34 / 29 / 26 % ; Landes 68 / 57 / 51 / 46 / 43 % ; Beauce 8 / 5 / 4,5 / 3,7 / 3,4 % ;
  Vosges 80 / 80 / 79 / 77 / 76 %. Le script utilise donc 480 px (environ 36 m par pixel) ; au-delà de 720 px
  le serveur refuse la requête.
- Un bloc compte comme forêt s'il est boisé à 25 % au moins (« bois épars », poids 0,4 dans le score) ou à 60 %
  au moins (« massif », poids 1).
- Limite : l'essence est déduite de la couleur de la légende, la présence de forêt est la donnée fiable.

## Sol : ce qui est modélisé et sur quelles sources (oct. 2026)
Données : SoilGrids 2.0 (ISRIC, CC BY 4.0), cartes de 250 m moyennées par blocs de 2,8 km (`build_sol.py`) : pH de l'eau
0-5 cm, sable et argile 5-15 cm, carbone organique 0-5 cm. Le drainage n'est pas une donnée : il est déduit de la
texture seule (argile > 35 % : engorgement ; sable > 80 % : sol séchant) ; la pente et la nappe ne sont pas prises en compte.

| Espèce | pH optimal | Texture / drainage | Humus | Niveau de preuve |
|---|---|---|---|---|
| Cèpe | 4,2 à 6,0 | argile pénalisée ; sable peu | non | pH étayé ; texture partielle |
| Girolle | 4,0 à 5,6 | argile pénalisée | non | pH étayé ; texture partielle |
| Morille | 6,5 à 8,0 | argile et sable pénalisés | favorable | partiel |
| Lactaire délicieux | 4,6 à 6,8 | sable > 80 % nettement pénalisé | non | étayé |
| Autres espèces | estimé | estimé | coulemelle : favorable (estimé) | estimé |

Sources :
- Cèpe, pinèdes de pin sylvestre (Soria, Espagne) : pH fortement acide (4 à 5), texture sablo-limoneuse à sableuse, sols pauvres en
  éléments nutritifs ; étude sur les cistes : sols acides, texture limoneuse. Liste de Bohus (1973, Hongrie) : cèpe sur sols de pH 4,5 à 5.
  https://www.researchgate.net/publication/51052914 ; https://library.hungaricana.hu/en/view/ORSZ_TTUD_Annales_1973_065/?pg=75
- Lactaire, Pinus pinaster (Espagne centrale) : acidité du sol favorable, sols sableux et peuplements âgés défavorables.
  https://www.researchgate.net/publication/304246554
- Girolle : sols pauvres, acides et sableux (Naturalis) ; préfère les sols acides pauvres en azote, exceptionnellement neutres riches
  en azote (écologie en taïga, échelles d'Ellenberg) ; chanterelle dorée du Pacifique (autre espèce) : sols bien drainés, limono-sableux à sablo-limoneux.
  https://mushrooms.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/taxon.php?id=100580 ; https://journals.rcsi.science/2309-4370/article/view/41943
- Morille : sites naturels de l'Himalaya, sols sablo-limoneux humifères très aérés, pH 6,5 à 7,0 ; croissance du mycélium entre pH 6,5 et 8
  selon l'espèce. https://krishi.icar.gov.in/jspui/handle/123456789/21515 ; https://microbiologyjournal.org/download/79424

Limites : ces études sont ponctuelles, souvent hors de France, et ne donnent pas de courbes de réponse. Les pondérations (plancher de
pH de 0,1 à 0,5 ; pénalité d'argile jusqu'à 30 % ; pénalité de sable jusqu'à 35 %) sont des choix de modélisation, pas des résultats publiés.

## Relief et microclimat : ce qui est modélisé (oct. 2026)
Données : tuiles d'altitude AWS « Terrain Tiles » (niveau 10, environ 106 m par pixel à 46° N), agrégées par blocs de 2,8 km par
`build_relief.py` : altitude moyenne, pente moyenne, exposition nord (moyenne de cos(azimut du versant) x min(pente, 30°) / 30) et position
topographique (altitude du pixel moins la moyenne dans environ 500 m : négatif en fond de vallon, positif sur les crêtes).

Trois effets, tous modestes et bornés :
1. **Température corrigée de l'altitude du bloc** : -6,5 °C par km par rapport au point de la série météo de la maille (gradient standard de
   l'atmosphère). Appliquée aux mailles dont l'amplitude d'altitude dépasse 100 m (45 % des mailles). Le gel (température minimale) est décalé de la même valeur.
2. **Exposition et dépressions** : indice d'humidité 0,7 x exposition nord + 0,3 x dépression ; bonus ou malus de 25 % au plus, **proportionnel
   au déficit d'humidité du moment** (nul quand le sol est déjà humide).
3. **Pente** : pénalité linéaire de 0 % à 15° jusqu'à 30 % à 40° (sol mince, ruissellement).

Sources :
- Espagne (pinèdes de Catalogne) : la production augmente avec l'altitude et l'exposition nord, diminue avec la pente ; sur versants sud, la
  pente réduit nettement le rendement ; le lactaire est plus abondant dans les dépressions (De Miguel et al. 2014, Bonet et al.).
  https://cris.ctfc.cat/docs/upload/27_431_De-Miguel%20et%20al-%202014.pdf ;
  https://www.researchgate.net/figure/Mushroom-production-as-a-function-of-a-slope-b-elevation-and-c-aspect-and_fig3_233652856
- Turquie (forêts mixtes de la mer Noire, climat humide) : effet inverse ou nul de l'exposition nord sur la productivité du cèpe.
  https://dergipark.org.tr/en/pub/artvinofd/article/449736
  -> raison pour laquelle l'effet d'exposition ne joue que lorsque l'humidité est limitante.

Limites : niveau de preuve « partiel » (études ponctuelles, en climat méditerranéen) ; les pondérations (25 % et 30 %, indice 0,7/0,3, seuil de pente 15°)
sont des choix de modélisation. Un bloc de 2,8 km moyenne des versants opposés (l'exposition se compense dans les vallées étroites). Le microclimat
des lisières, clairières et fonds de combe de quelques dizaines de mètres n'est pas visible à cette échelle. Pour un point précis, la pente et l'exposition
sont recalculées sur place à partir de quatre altitudes à environ 100 m.

## Coulemelle et milieux ouverts ; meilleurs spots à 1 km (oct. 2026)
- **Coulemelle** (*Macrolepiota procera*) : saprophyte, sans arbre hôte ; elle pousse en lisière, clairière, prairie et bord de chemin. Le modèle ne la
  pénalise donc plus en l'absence de forêt : clairière ou lisière 0,90 ; prairie ou milieu ouvert semi-naturel 0,70 ; autre terrain non bâti (cultures
  intensives, vignes) 0,15 ; forêt dense 0,6 (feuillus) à 0,3 (résineux) ; bois épars ou lisière 0,95. Ces valeurs sont **estimées d'après l'écologie
  générale de l'espèce**, sans étude de rendement : niveau de preuve « partiel ».
- **Milieux ouverts** : `build_urbain.py` (CORINE Land Cover 2018, via l'IGN) marque en plus des agglomérations les blocs de 1,4 km occupés à 35 % au moins
  par des prairies (231), mosaïques agricoles (242), agriculture avec végétation naturelle (243), agroforesterie (244) ou pelouses (321). Les cultures
  (211-213), vignes, vergers, landes et broussailles sont exclues.
- **Meilleurs spots** : autour du point choisi, la page lit l'image de la couche forêt IGN à environ 10 m (200 x 200 px sur 2 km) et l'altitude sur une
  grille de 11 x 11 points (200 m) ; chaque case de 50 m dans un rayon de 1 km reçoit le score du modèle avec sa forêt (fenêtre de 50 m), son altitude
  corrigée de la température, sa pente, son exposition et sa position. Les cases d'agglomération (CORINE) ou à moins de 90 m d'un grand axe sont exclues.
  Les cinq meilleurs spots, espacés d'au moins 250 m, sont affichés. La météo et le sol sont ceux du point : ils ne varient pas dans le rayon.
