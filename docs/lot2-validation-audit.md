# Audit lot 2 — contrat de validation métier et compatibilité legacy

Ce document prépare l'extraction `domain`/`parsing`; il ne modifie pas le
comportement actuel. Le principe est de ne pas confondre « chargeable »,
« calculable » et « exercice complet ». Les caches `cabestan_dashboard_data_v1`
et les exports RES partiels déjà acceptés restent chargeables lorsqu'ils sont
structurellement lisibles.

## Constats de départ

- `parseRES` crée douze cases par métrique, mais peut avoir des mois absents
  (`months_present`), des cellules `null`, ou des postes absents signalés dans
  `labels_missing`. Ces trois cas existent sans erreur de parser.
- `computeSnapshot` additionne aujourd'hui `null` comme zéro et choisit le
  dernier mois non-null de `marge_brute`. Il compare et projette ensuite sur
  toute année antérieure, même si elle est incomplète.
- `historicalPlanReference` déduit les deux années avant la dernière clé sans
  vérifier qu'elles contiennent réellement douze mois ou les six métriques de
  référence.
- La balance est facultative; les comptes BAL absents ont actuellement le sens
  de zéro. Pièces est facultatif mais son parser doit échouer si ses colonnes
  minimales sont absentes.

## Contrat en trois niveaux

### 1. Donnée chargeable (validation structurelle)

Une donnée est chargeable si elle a un objet `years` non vide, au moins une clé
d'année numérique, et pour chaque année un objet `monthly`. Les séries connues
sont des tableaux de douze nombres finis ou `null`; le lecteur de cache peut
normaliser sans perte une série plus courte en la complétant par `null` jusqu'à
douze cases. Une série non-tableau, une valeur non numérique non nulle, ou une
année sans `monthly` rend cette année invalide; si aucune année ne survit, le
cache est corrompu.

`labels_missing`, `charges_detail`, `sante`, distributions, noms de fichiers,
dates d'export et `months_present` sont facultatifs. Leur absence dans une
entrée `_v1` ne doit pas empêcher l'ouverture : le lecteur fournit les valeurs
par défaut sûres. `months_present` est normalisé en entiers uniques de 1 à 12;
à défaut, il est dérivé des cellules de l'en-tête seulement si cette information
est disponible, sinon conservé comme indisponible. La validation ne transforme
jamais un `null` en zéro.

Un poste RES absent reste chargeable : le parser conserve son tableau de
douze `null` et son entrée `labels_missing`. L'interface affiche son avertissement
actuel. Une balance sans certains comptes reste chargeable et produit ses
totaux selon les règles actuelles (compte absent = zéro).

### 2. Donnée calculable (disponibilité par indicateur)

Les fonctions du domaine retournent une valeur ou `null`/un statut
`unavailable`; elles ne convertissent pas silencieusement une série absente en
zéro. Zéro numérique est toujours une observation valide.

| Calcul | Préconditions minimales | Sinon |
| --- | --- | --- |
| Total YTD d'une métrique | Série présente et au moins une valeur numérique dans la période demandée | Indicateur indisponible |
| Taux de marge | CA et marge brute YTD disponibles, CA non nul | `null` |
| Comparaison même période | L'année de référence couvre les mois 1..N dans `months_present` et chaque métrique demandée a au moins une valeur numérique sur cette période | Comparaison indisponible |
| Projection saisonnière d'une métrique | YTD de la métrique, plus au moins une année de référence ayant une valeur numérique sur les mois restants | Projection indisponible pour cette métrique |
| Référence du cap annuel | Exercice complet au sens ci-dessous et six métriques de référence calculables | Exclure l'exercice, puis appliquer le repli documenté |

Pour préserver les affichages actuels, les sommations de présentation peuvent
encore ignorer un trou isolé après que le domaine a déclaré l'indicateur
disponible. Ce choix doit être centralisé dans une seule aide de période, jamais
répliqué dans les renderers. Une décision produit ultérieure pourrait faire des
trous des données inconnues partout; ce n'est pas une conséquence implicite du
refactor.

Pour le snapshot courant, `N` est le dernier mois observé de `marge_brute`.
S'il n'y en a aucun, le snapshot est chargeable mais ses KPI et projections
liés à la marge sont indisponibles. Un trou au milieu ne décale pas les mois;
il ne permet pas non plus de présenter comme fiable une comparaison dont
`months_present` ne couvre pas la période.

### 3. Exercice complet (référence historique)

Un exercice est complet pour le cap annuel seulement si :

1. `months_present` contient exactement les mois 1 à 12;
2. chacune des métriques `ca`, `marge_brute`, `achats_matieres`,
   `remunerations`, `charges_fonct` et `contribution_coop` conserve sa série
   normalisée de douze cases et contient au moins une valeur numérique; et
3. les totaux nécessaires sont calculables.

Une cellule vide isolée dans une année couverte garde donc la convention
d'agrégation existante (`null` contribue zéro aux totaux) sans rendre
l'exercice incomplet. Une métrique entièrement absente reste indisponible. Une
année de neuf mois est chargeable pour les graphes YTD, mais exclue du cap et
des projections annuelles historiques.

L'année la plus récente reste l'exercice courant pour l'écran. La référence du
cap sélectionne les deux exercices complets les plus récents **antérieurs** à
cette année. S'il n'en existe aucun, elle peut employer la dernière année comme
référence seulement si celle-ci satisfait la définition d'exercice complet;
sinon elle emploie les constantes de configuration et expose le libellé
« historique indisponible ». Cette règle évite de prendre une année partielle
pour un historique tout en gardant un dashboard exploitable avec un seul export
annuel complet.

La santé financière compare son résultat à l'exercice immédiatement précédent
quand il existe. Ce comparatif N-1 ne dépend pas des années retenues pour les
projections et le cap annuels.

## Contrat parser et jeux de test

Les fixtures restent des matrices et objets synthétiques, sans export ni nom
client réel. Le lot 2 doit couvrir au minimum :

- un cache `_v1` sans options facultatives, avec `null` mensuels et
  `labels_missing`;
- un RES à douze colonnes où une cellule `ca` ou `marge_brute` est `null`;
- un historique `2023` complet, `2024` partiel, `2025` courant : seul 2023 est
  retenu comme référence;
- deux exercices complets antérieurs : moyenne de ces deux exercices;
- aucune année complète : repli de configuration sans NaN ni division par zéro;
- `dateOf(null)`, chaîne vide, date XLSX valide, date texte invalide;
- des clients `__proto__`, `constructor` et `toString`, qui restent des clés de
  client ordinaires;
- BAL sans comptes facultatifs, et Pièces sans en-têtes obligatoires.

Le parser RES conserve la règle actuelle de libellé strict après `trim`, la
valeur absolue des charges définies dans `POSITIVE_AS_ABS`, et la dernière ligne
trouvée en cas de doublon. Modifier l'une de ces règles est un changement métier
hors lot 2 et requiert une décision explicite.

## API recommandée pour l'extraction

Garder les fonctions pures et petites : `normalizeDashboardData`,
`getMetricAvailability`, `isCompleteHistoricalYear`, `sumPeriod`,
`computeSnapshot`, `historicalPlanReference`. Elles retournent des objets
simples avec `value`, `available` et, si utile, `reason`, afin que l'UI choisisse
entre tiret, avertissement ou graphique vide sans recalculer. Les adaptateurs
SheetJS, `localStorage` et DOM restent en dehors de ces modules.
