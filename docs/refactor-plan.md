# Plan de refactorisation — Dashboard Louty

## But et contraintes

Refactoriser l'application autonome publiée par GitHub Pages depuis `main/`
sans modifier son comportement métier ni remplacer les graphiques actuels. Le
résultat reste **`/index.html` à la racine** : un unique fichier autonome,
ouvrable hors ligne, sans requête vers des CDN et sans données Louty dans le
dépôt. La migration des graphiques Chart.js vers ECharts est explicitement hors
périmètre : ECharts déjà présent et Chart.js restent chacun utilisés là où ils
le sont aujourd'hui.

La cible est un code source modulaire, des tests exécutables en local, puis un
build déterministe qui régénère `index.html` et `version.txt`. Aucun framework
n'est requis : des modules JavaScript natifs regroupés par esbuild et du CSS
simple suffisent. Le code final est encapsulé dans l'artefact pour conserver la
compatibilité `file://` et GitHub Pages.

## Architecture cible

```text
src/
  app/
    domain/             # données normalisées, calculs, références historiques
    parsing/            # RES, BAL, Pièces et classification des classeurs
    state/              # état, persistance versionnée, import transactionnel
    ui/                 # rendu DOM, événements, thèmes, accessibilité
    charts/             # adaptateurs Chart.js et ECharts, registre/lifecycle
    styles/             # tokens, composants, responsive
    entry.js            # composition des dépendances et démarrage
  template/index.html   # structure HTML, CSP et points d'injection
  vendor/               # copies versionnées des bundles hors ligne et licences
scripts/
  build.mjs             # produit index.html et version.txt depuis src/
  verify-build.mjs      # contrôle autonomie, CSP, versions et taille
test/
  unit/                 # domaine, parser, état/persistance
  fixtures/             # matrices XLSX synthétiques et données anonymisées
  browser/              # scénarios de fumée et captures visuelles
```

Les frontières sont intentionnelles : `domain` ne dépend ni du DOM ni de
`localStorage`; `parsing` ne connaît pas le rendu; `state` n'appelle le DOM que
via un port injecté; `charts` est le seul propriétaire des instances Chart.js
et ECharts. Les modules UI ne calculent plus les agrégats directement : ils
reçoivent un snapshot immuable et des view-models. Cela permet à plusieurs
agents de travailler sans conflits de fichiers après l'extraction initiale.

Le template injecte, dans cet ordre, les bibliothèques hors ligne existantes
(ECharts, Chart.js, SheetJS), le bundle applicatif, puis les styles compilés.
Le build vérifie les marqueurs d'injection et refuse un `</script` non sûr dans
un bundle. Les versions, licences et sous-ensembles ECharts restent épinglés.
Le script ECharts actuel devient un sous-outil du build, et non une mutation
manuelle de `index.html`.

## Lots proposés

### Lot 1 — Extraction mécanique, build reproductible et contrat de non-régression

**Objectif.** Déplacer mécaniquement les blocs existants derrière des frontières
de fichiers, sans transformation de logique ni de rendu, puis régénérer le même
artefact fonctionnel à la racine.

**Travaux.**

- Ajouter `package.json` et un lockfile avec versions épinglées de l'outillage
  uniquement (`esbuild`, runner de tests et navigateur de contrôle si retenu).
- Scinder `index.html` en template, CSS source, vendors hors ligne inchangés et
  bundle applicatif initial encore monolithique; le build réécrit
  **`/index.html`**, jamais un dossier de distribution ni une autre page.
- Garder les bundles inline actuels tels quels pendant ce lot (ECharts,
  Chart.js, SheetJS et licences). Conserver le script ECharts existant; le
  build se contente d'assembler les segments repérés et contrôle leurs versions
  et licences. Leur reconstruction reste une évolution séparée et explicitée.
- Ajouter une vérification de l'absence de requête CDN dans les chargements
  actifs (`src`, `href`, `url()`, `@import`, appels réseau et CSP), en ignorant
  les commentaires, notices de licence et textes d'interface qui peuvent citer
  une URL sans la charger.
- Établir un scénario navigateur de référence : accueil, import synthétique,
  thème, onglets, cap annuel, dépôt BAL/Pièces, rafraîchissement local et
  retour à l'accueil. Capturer les vues clair/sombre, desktop/mobile avec jeux
  de données anonymes.
- Documenter les commandes `npm ci`, `npm run build`, `npm test`,
  `npm run verify` et la règle : ne jamais ajouter d'export client réel aux
  fixtures, aux captures ou au commit. Les captures versionnées utilisent
  exclusivement des données synthétiques.

**Critères d'acceptation.** `npm run build` est reproductible sur une copie
propre, écrit `index.html` à la racine et laisse l'application ouvrable hors
ligne. Les parcours navigateur de référence passent, les captures synthétiques
ne révèlent pas de dérive visible, et le contrôle statique confirme CSP,
bundles et licences. Aucun changement métier volontaire.

**Frontières parallélisables après ce lot.** Un agent peut prendre le build et
la vérification, un autre les fixtures/tests navigateur; les deux ne modifient
pas les futurs modules `domain`, `state`, `ui` ou `charts`.

### Lot 2 — Domaine et parsing purs, avec corrections de fiabilité

**Objectif.** Extraire les données et les calculs de `index.html` en fonctions
testables, puis corriger les défauts métier identifiés sans changer les écrans
attendus.

**Travaux.**

- Définir le schéma interne et ses invariants sans rendre les caches existants
  incompatibles. Distinguer la validité structurelle (années, tableaux mensuels
  et métadonnées lisibles), la disponibilité d'une métrique pour un calcul, et
  la complétude d'un exercice. Une valeur mensuelle `null`, un poste absent
  signalé dans `labels_missing`, ou douze colonnes avec une cellule vide restent
  des données valides; ils désactivent seulement les calculs qui l'exigent et
  conservent l'avertissement actuel. Ajouter `validateDashboardData` aux
  frontières parser/persistance.
- Extraire `parseRES`, `parseBAL`, `parsePieces`, `classifyBooks` et les aides
  dans `src/app/parsing/`. Conserver SheetJS comme adaptateur injecté afin que
  les tests n'aient pas besoin d'un vrai fichier personnel.
- Extraire `computeSnapshot`, les comparaisons de période, les références de
  cap annuel et les formatages métier dans `src/app/domain/`. Les rendus ne
  doivent plus sommer les tableaux mensuels eux-mêmes.
- Corriger `dateOf`: `null`, chaîne vide, valeur absente et date invalide
  retournent `null` (jamais le 1er janvier 1970); conserver les dates XLSX
  valides. Employer `Object.create(null)` ou `Map` pour les index clients et
  années, afin que `__proto__`, `constructor` et noms semblables soient des
  clients ordinaires.
- Définir précisément les années *complètes*. `historicalPlanReference` ne
  retient que des exercices ayant les 12 mois nécessaires à ses indicateurs;
  il ne traite plus automatiquement l'avant-dernière clé comme un exercice
  complet. `computeSnapshot` ne projette ni ne compare sur une année ou des
  séries invalides; il expose une indisponibilité explicite aux vues.
- Ajouter des tests unitaires sur matrices RES/BAL/Pièces minimales : trous
  mensuels, zéro réel, dates nulles, deux années partielles, historique complet
  et incomplet, noms de clients spéciaux, erreurs de feuille et calculs de
  référence, plus un cache `_v1` partiel et un exercice de douze colonnes dont
  une cellule requise est vide.

**Critères d'acceptation.** Les tests couvrent les quatre défauts connus
(`historicalPlanReference`, `computeSnapshot`, `dateOf(null)`, clés prototype)
et leurs résultats sont déterministes. Les jeux anonymes existants gardent les
valeurs affichées lorsqu'ils représentent le même historique valide. Un import
invalide renvoie une erreur typée et ne produit pas de données partielles.

**Frontières parallélisables.** Un agent peut extraire/tester `domain`; un
second `parsing`; un troisième prépare les fixtures synthétiques. Ils se
coordonnent seulement sur le schéma exporté depuis `domain/schema.js`.

### Lot 3 — État, persistance et import atomique

**Objectif.** Rendre les transitions d'import et de restauration sûres : soit
une nouvelle donnée complète devient visible, soit l'état affiché précédent est
conservé.

**Travaux.**

- Créer un store réduit avec état explicite (`welcome`, `loading`, `ready`,
  `error`) et une API `getState`, `subscribe`, `replaceData`, `enrichData`.
  `LAST_DATA`, `DATA`, les variables de sélection et leurs mutations directes
  sont encapsulés.
- Introduire un adaptateur `Storage` versionné. Valider le JSON lu avant rendu;
  migrer les versions connues; ne supprimer une entrée corrompue qu'après
  confirmation de corruption de la donnée, jamais parce qu'un rendu a levé une
  exception. Ainsi l'échec transitoire d'un graphique ou du DOM ne détruit plus
  le cache au démarrage.
- Transformer `ingest` en transaction applicative, sans prétendre obtenir une
  atomicité magique entre DOM et `localStorage` : lecture et classification,
  parsing de toutes les pièces, validation de l'état candidat, rendu du
  candidat avec l'état/DOM précédents encore disponibles, puis publication du
  store et tentative de persistance. Pour un enrichissement BAL/Pièces, cloner
  les données courantes et ne publier le clone qu'après succès de tous les
  parsers. Le défaut actuel qui modifie `LAST_DATA` avant l'échec de Pièces
  disparaît.
- Documenter et tester la séquence exacte de la transition réussie :
  **mettre à jour le candidat** (noms d'exports et remise à zéro des imports
  dépendants), **dériver** snapshot et plan, **rendre**, puis **sauvegarder**.
  La dérivation du plan réutilise l'objectif mémorisé et son `netCoefficient`
  avant toute application des réglages aux graphiques; elle conserve donc la
  règle actuelle selon laquelle un objectif saisi en net reste stable lorsque
  le coefficient évolue. L'état visible et `LAST_DATA` ne sont publiés qu'une
  fois ce pipeline terminé. Un échec de rendu restaure l'écran et l'état
  précédents; si une écriture de cache échoue, l'état rendu reste utilisable en
  session, un avertissement explique que les données ne survivront pas au
  rechargement et l'ancienne entrée sauvegardée n'est pas supprimée. Le store,
  le renderer et le Storage sont injectables afin de tester ces chemins.
- Préserver la règle de cohérence : un nouveau RES réinitialise les importations
  facultatives précédentes. Afficher des erreurs contextualisées sans effacer
  le tableau de bord utilisable ni sa persistance.
- Tester les transitions : BAL valide + Pièces invalide, Pièces valide + BAL
  invalide, RES seul, données sauvegardées incompatibles, rendu qui échoue,
  stockage saturé et annulation du changement de fichier. Couvrir précisément
  les deux pannes d'ordre : rendu refusé avant écriture, puis `setItem` refusé
  après rendu, avec faux renderer et faux Storage.

**Critères d'acceptation.** Les tests prouvent qu'un échec avant publication ne
modifie ni les données visibles ni le cache; une erreur de rendu de démarrage ne
déclenche pas `removeItem`; le refresh restaure une donnée validée. En cas de
quota, le dashboard reste utilisable pour la session et annonce l'absence de
persistance. Les imports facultatifs affichent soit les deux résultats demandés,
soit l'état antérieur intact avec un message précis.

**Frontières parallélisables.** Le store/persistance et le contrôleur d'import
peuvent être réalisés séparément sur leur contrat; le rendu reçoit uniquement
des transitions déjà validées.

### Lot 4 — Rendu, lifecycle graphique et validation de livraison

**Objectif.** Extraire le rendu sans dérive visuelle et rendre le cycle de vie
des graphiques fiable, homogène et testable.

**Travaux.**

- Répartir les rendus par zone (`overview`, `achats`, `sante`, `cap`,
  `comparatifs`) et les interactions (`theme`, upload, modales, infobulles).
  Conserver la structure HTML/CSS observable, les libellés, les identifiants et
  les rôles ARIA sauf amélioration justifiée.
- Centraliser les tokens couleur, typo, grilles, tooltips, durées et easing.
  Le thème clair/sombre alimente les deux adaptateurs de graphiques. Les
  animations respectent `prefers-reduced-motion`; Chart.js et les ECharts déjà
  migrés utilisent les mêmes constantes visuelles. Ce lot ne convertit aucun
  graphique Chart.js vers ECharts.
- Introduire un `ChartRegistry`: `mount`, `replace`, `resize`, `disposeAll`.
  Chaque canvas/host a une seule instance active; les ECharts sont redimensionnés
  via un unique `ResizeObserver`; changements de thème, d'onglet ou de données
  détruisent/remplacent proprement les instances. Les graphiques vides libèrent
  aussi leur instance.
- Retirer les dépendances implicites entre `render` et les globals. Le render
  complet devient une réponse à l'état du store; des mises à jour ciblées sont
  autorisées seulement derrière les mêmes adaptateurs.
- Retirer le code mort identifié par les tests et la recherche d'appels, sans
  chercher à réécrire tous les rendus en fonctions pures dans ce lot.
- Exécuter les tests navigateur sur les parcours du lot 1, vérifier l'absence
  d'erreurs console et de doublons d'instances, puis comparer les captures avec
  une tolérance documentée. Vérifier aussi le fichier local et la prévisualisation
  GitHub Pages avant publication. Ajouter une fenêtre de QA manuelle avec trois
  exports réels distincts, consultés seulement localement : aucun fichier,
  contenu, nom, capture ni résultat identifiable issu de ces exports n'est
  ajouté au dépôt public.

**Critères d'acceptation.** Même information, ordre, palette et comportement
sur les écrans de référence; pas de fuite d'instance après changements répétés
de thème/données/onglets; les animations sont homogènes et réduites si demandé.
`npm run verify` et les tests navigateur passent sur l'artefact généré.

## Stratégie de commits, revues et mise en production

Chaque lot est préparé comme un commit cohérent, sans fichier de travail ni
export Louty. Le parent de tâche est seul à créer les commits et à pousser;
aucun agent ne commit ni ne pousse sans instruction explicite. Exemples de
jalons : `build: generate standalone dashboard`, `refactor: isolate domain and
parsers`, `fix: make imports atomic`, `refactor: centralize chart lifecycle`.
Un commit de mise à jour de l'artefact est toujours accompagné des sources et
de `version.txt` produits par le build.

Après le lot 1, le travail peut se dérouler avec 2 ou 3 agents : séparation par
frontière de dossier, contrat d'exports court écrit avant modification, puis
intégration séquentielle. Limiter les revues à deux passes de niveau medium ou
plus : une revue du lot par un agent qui n'a pas écrit la zone et une dernière
revue d'intégration orientée régressions, sécurité des données et artefact.
Corriger les constats bloquants avant de passer au lot suivant; une troisième
passe n'est utilisée qu'après une modification substantielle issue de revue.

La publication de production est le dernier acte : build propre, tests unitaires
et navigateur verts, contrôle de diff de l'artefact et QA locale sur les trois
exports réels, puis commit/push sur `main`. La page GitHub Pages et son
`version.txt` sont vérifiés seulement après le push, contre le commit livré.
Elle est autorisée par la demande, mais ne doit intervenir qu'après les critères
du lot 4 et une dernière capture synthétique de l'artefact réellement publié.
