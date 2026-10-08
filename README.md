# Dashboard Louty

Outil autonome (un seul fichier HTML) qui génère un tableau de bord d'activité à partir des exports Excel de l'outil de compta **Louty** de CABESTAN.

## 🔗 Accès direct

**→ [Ouvrir le dashboard](https://juletna.github.io/dashboard-louty/)**

## Utilisation

Ouvre le dashboard via le lien ci-dessus (ou le fichier [`index.html`](index.html) en local), puis dépose tes deux exports Louty :

- **`RES_U_Résultat d'Activité`** (`.xlsx`, obligatoire) — marge brute, chiffre d'affaires, achats, charges, comparaisons N-1…
- **`BAL_A_Balance Analytique`** (`.xlsx`, facultatif) — trésorerie, dettes, position nette (carte « Santé financière »).
- **`Pièces`** (`.xlsx`, facultatif) — devis, factures, prévisionnel et répartition du CA par client. Inclure les devis facturés **et non facturés**, les factures, situations, acomptes et avoirs, sans filtre d’accord client ni de règlement. Les brouillons sont exclus automatiquement.

Les deux fichiers se téléchargent dans Louty, rubrique **Rapports de gestion**. Au téléchargement du Résultat d'Activité, coche **toutes les années** dans la fenêtre « Exercices » pour activer les comparaisons et cumuls.

## Confidentialité

**Tout se passe dans le navigateur.** Aucune donnée n'est envoyée sur internet : les bibliothèques (Chart.js, Apache ECharts, SheetJS) et la police sont embarquées dans le fichier, et une CSP bloque toute requête réseau sortante. Tes données sont mémorisées localement (localStorage) sur ton ordinateur uniquement.

## Cap annuel & leviers

En tête du tableau de bord, définis ton **revenu annuel à financer** et le **surplus annuel** que tu souhaites dégager après rémunérations et charges. Le dashboard en déduit la marge brute à produire et reporte cette trajectoire sur les graphiques.

Le premier bloc réunit les projections annuelles et les avancements à date. Le **salaire net dégageable** représente la capacité moyenne de rémunération créée à date : marge brute moins charges de fonctionnement et contribution coopérative, sans déduire les salaires déjà versés, convertie en net avec le coefficient personnel existant. Le mois de l’export est compté au prorata des jours écoulés, jour de l’export inclus ; les mois couverts antérieurs sont complets. Un déficit donne une capacité nulle et reste signalé dans « Comprendre la projection ». Les données ou dates manquantes donnent une valeur indisponible. Le résultat annuel projeté utilise, lui, les rémunérations et charges annuelles prévues dans les objectifs.

Le simulateur de trajectoire (taux de marge et charges) est initialisé à partir des données réelles des deux derniers exercices complets, puis mémorisé sur ton poste. Le CA nécessaire est calculé automatiquement à partir du cap et du taux de marge choisi. Tu peux à tout moment revenir à cette référence historique. Les seuils de lecture des graphiques restent accessibles via la roue crantée.

## Chiffre d’affaires prévisionnel

La carte, sous « Mon cap annuel », présente le **CA HT à facturer (estimation)** issu des devis acceptés et vérifiés. La jauge distingue le besoin couvert en bleu, le reste à trouver en orange et le dépassement estimé en vert. Un repère « Objectif » traverse la barre seulement en cas de dépassement. Le montant estimé et l’écart au besoin sont affichés au-dessus ; les calculs et la répartition annuelle restent inchangés.

Une carte **En attente client** occupe la même hauteur que les deux cartes compactes **En attente de validation** et **À examiner** à sa droite. Les attentes restent hors estimation. « À examiner » réunit les propositions non retenues et les sélections suspendues après réimport, sans doublons. Son montant indicatif utilise la saisie ou le reste candidat si disponible, sinon le montant total du devis comme repère ; les valeurs inconnues sont signalées. Il ne constitue pas un reste à facturer validé et reste hors totaux prévisionnels.

Les liens des cartes déplient un tableau unique avec quatre onglets, une recherche par client/numéro/titre et l’accès aux fiches. Les onglets se parcourent également au clavier. Dans « En attente client », « Passer à facturer » transfère un devis actif vers l’estimation en un clic, en conservant son montant et ses rattachements. Cette décision manuelle est mémorisée et reste prioritaire lors des réimports. Le lien « Tous les devis / gérer les sélections » conserve l’accès au gestionnaire, aux exclusions et aux ajouts manuels. « Comprendre le calcul » précise le périmètre.

Le préfiltre rapproche les montants par activité et ID client prioritaire, puis par nom complet identique sans distinguer casse/espaces si l’ID manque. Les homonymes associés à plusieurs ID restent à vérifier. Les motifs affichent la cause précise : devis de même montant, factures concurrentes, avoir, acomptes à rattacher ou document incomplet.

Une **Date accord** valide ajoute automatiquement un devis en travaux confirmés lorsque le reste à facturer est positif et non ambigu. Une date manquante ne vaut pas refus. Aucune planification par devis n’est demandée : le confirmé alimente un scénario réparti uniformément sur les mois restant après la période RES, jusqu’à décembre. Cette répartition ne représente pas des échéances de facturation. Les décisions manuelles, y compris les exclusions et retraits, restent prioritaires lors des réimports. Les devis acceptés mais ambigus restent à examiner et ne gonflent pas les totaux.

Le classement distingue « Confirmé · À facturer », « Confirmé · Partiellement facturé », « Entièrement facturé », « En attente client », « En attente de validation » et « À vérifier ». Les motifs, pièces utilisées, IDs, montants et différences restent dans la fiche. Un reste ambigu est « À déterminer », jamais zéro par défaut. « Entièrement facturé » ne signifie pas payé.

Un acompte seul, confirmé et entièrement encaissé, ne diminue pas le CA HT restant à facturer : le devis accepté entre au montant intégral si son rattachement est non ambigu. Les situations confirmées sont déduites du HT et du TTC, même impayées ; les acomptes présents restent séparés. Une facture ordinaire inférieure au devis peut correspondre à une réduction définitive du périmètre : son reste candidat est proposé à vérifier, hors totaux jusqu’à une décision manuelle.

Une couverture HT égale ou supérieure au devis donne un reste nul, avec conservation du supplément éventuel. Une couverture TTC exacte donne aussi un reste nul malgré une différence HT. La couverture par les factures seules est examinée avant d’ajouter des acomptes, pour éviter de les compter deux fois. Une différence TTC absolue de 1 € maximum sur une couverture HT complète reste informative, sans effacer un reste HT positif. Les écarts plus importants restent signalés dans la fiche.

Les devis de montant identique peuvent être écartés collectivement si autant de factures distinctes les couvrent, avec des dates compatibles. Pour plusieurs devis d’un client, une recherche de combinaisons en HT et TTC peut attribuer un ensemble exact unique, puis traiter les pièces restantes. Elle examine au maximum 18 pièces et 100 000 visites ; une recherche incomplète, plusieurs solutions ou des revendications communes ne permettent aucune attribution automatique. Les acomptes ajoutés à une facture finale doivent être confirmés, entièrement encaissés et antérieurs à cette facture.

Une chaîne unique facture initiale → avoir intégral → facture de remplacement peut établir une couverture : annulation exacte en HT/TTC, chronologie, activité, identité et unicité des pièces sont contrôlées. Le remplacement peut porter un autre ID si le nom normalisé est identique ; les IDs et la chaîne restent visibles, sans fusion globale des clients. Ces rapprochements sont des heuristiques, jamais des liens natifs fournis par Louty.

Une facture confirmée au même nom et au même TTC, mais avec un ID client différent, est proposée à vérifier. La fiche permet de confirmer que le chantier est entièrement facturé : cette décision conserve les clés des factures et les preuves du rapprochement, exclut le devis durablement du prévisionnel et affiche « Entièrement facturé ». Une même facture ne peut pas justifier deux confirmations manuelles ; une concurrence ou un changement des preuves impose une vérification.

Chaque fiche expose un historique des pièces de la même activité, par ID client ou nom complet identique. Les IDs différents sont signalés. Les lignes affichent type, numéro, date, titre, état, accord, HT, TTC et règlements ; elles ne sont pas totalisées comme un reste à facturer.

La modale propose des filtres par situation avec compteurs et badges distincts du rapprochement. La situation manuelle prévaut, sinon une date d’accord valide confirme le chantier ; l’état administratif distingue les deux attentes. L’accord ne prouve pas le démarrage effectif des travaux.

« Tous les devis » permet un ajout manuel malgré le préfiltre. Chaque sélection conserve une situation modifiable (confirmé, attente client ou attente de validation) et un montant restant. La saisie de mois, le calendrier et les filtres de planification sont supprimés. Les anciens mois restent conservés dans les caches version 1 mais sont ignorés, sans modifier les montants, exclusions ou rattachements. Les sélections à vérifier restent visibles mais hors totaux. Les doublons d’une même identité sont regroupés et signalés comme ambigus. Un devis sans numéro est identifié par son activité, son client, sa date, son titre et son montant : si ces éléments changent, l’ancienne sélection reste visible comme absente de l’export.

L’éditeur permet de rattacher manuellement les acomptes encaissés au chantier. Un acompte ne peut être rattaché à deux sélections. Le montant du chantier HT, les acomptes TTC rattachés et le solde TTC à encaisser sont distincts : les acomptes ne diminuent pas silencieusement le CA HT prévisionnel. Le solde TTC est calculé seulement si le TTC du devis est connu et qu’aucune facture/avoir susceptible de reprendre ces acomptes ne rend la déduction ambiguë ; sinon il reste « à vérifier ». Un rattachement devenu invalide peut être décoché.

Réimporter les Pièces permet aux anciens caches de récupérer les dates d’accord, TTC et règlements. Les choix et montants manuels sont conservés, mais de nouvelles preuves ou une règle de couverture différente peuvent imposer une vérification avant de réactiver une sélection.

Le format de cache reste compatible avec la version 1. Les choix antérieurs restent conservés ; la nouvelle empreinte des règles et des preuves demande une vérification avant de réactiver leurs montants. Les exclusions et retraits restent prioritaires.

Les choix sont mémorisés indépendamment du RES (`cabestan_forecast_v1`). Un nouvel import RES réinitialise toujours les Pièces actives, mais conserve les choix. Réimporter les Pièces les réactive. Les sélections absentes ou dont les pièces du client ont changé sont suspendues des totaux jusqu’à vérification, sans modifier la saisie. Un échec de sauvegarde est signalé et conserve la session et l’ancien cache.

Le cap annuel affiche **CA réalisé RES + confirmé prévu** et l’écart à l’objectif. Tous les montants confirmés et vérifiés sont répartis uniformément après le dernier mois couvert par le RES, jusqu’à décembre. L’arrondi cumulatif conserve exactement le total au centime. Le dernier mois RES est traité comme entièrement réalisé, même si l’export est en cours de mois. Sans période RES exploitable, ou lorsque décembre est déjà couvert, aucun scénario supplémentaire n’est ajouté à cet exercice ; le confirmé reste visible dans sa jauge. Les factures/avoirs datés après la période RES sont listés séparément, sans addition automatique. La vue ne constitue donc pas une réconciliation comptable exhaustive. Le graphique mensuel décompose le CA confirmé à facturer en marge estimée et achats/coûts estimés, dans une pile distincte du réalisé et avec des teintes plus légères. La somme des deux segments est le CA confirmé ; les dépenses déjà engagées sont déduites de l’enveloppe avant répartition des coûts futurs. Sans modèle de marge exploitable, seul le CA confirmé est affiché. Les montants réalisés, le résultat, le salaire et la trésorerie restent inchangés.

Les graphiques de pilotage CA et marge brute ajoutent un scénario **réalisé + confirmé** : repère en pointillés sur le comparatif annuel et prolongement de la courbe cumulée jusqu’à décembre. La marge est estimée avec le taux pondéré des exercices de référence (total des marges / total des CA). L’enveloppe annuelle de coûts vaut le CA réalisé + confirmé, multiplié par le complément de ce taux. Les coûts déjà comptabilisés (CA réalisé − marge réalisée) sont déduits pour estimer les coûts futurs, avec un minimum de zéro. Ces coûts futurs sont répartis au prorata du CA confirmé mensuel. Cela tient compte des achats déjà engagés, sans inventer un stock ni rembourser les dépenses dépassant l’enveloppe. Une marge future négative reste possible. Sans marge réalisée ou référence historique exploitable, seul le scénario CA est disponible. Le détail du calcul est accessible sous le comparatif ; ce scénario ne s’ajoute pas à la projection statistique du cap annuel.

Avec un export complet, la répartition par tranche s’intitule « Devis exportés » : elle conserve son périmètre historique des devis validés et imprimés, facturés ou non. La concentration clients reste calculée sur les factures/situations et avoirs confirmés, sans les acomptes.

## Créances et acomptes clients

Les pièces sont normalisées une fois avec identité client, HT, TTC, paiements, échéance et accord. Le prévisionnel et les détails de paiements partagent la résolution des clients (`domain/clients.js`). Les règles restent distinctes : créances = soldes « En attente » TTC des factures/situations confirmées ; acomptes détectés = « Déjà réglé » TTC des factures d’acompte confirmées ; dette d’acomptes = solde comptable des comptes 4191/4712 de la Balance.

La santé financière affiche toujours les acomptes détectés et le solde Balance, y compris zéro. L’absence de comptes, de Balance ou d’indication dans un ancien cache est signalée comme indisponible, avec invitation à réimporter. Les acomptes historiques peuvent être déjà soldés : ils ne deviennent pas automatiquement une dette actuelle. Les recherches de combinaisons par montant se font à la maille document, dans un module pur testé et avec limites de calcul explicites. Elles restent indicatives, notamment parce que base comptable et TTC peuvent différer.

## Bibliothèques graphiques

Les jauges « Ratio achats / CA » et « Taux de marge brute » utilisent les composants natifs Apache ECharts 6.1.0, avec rendu SVG et animations respectant la préférence de réduction des mouvements. Les blocs « Où j’en suis » et « Comparatif d’avancement annuel » utilisent également ECharts, avec des barres horizontales et le même cycle d’animation. Les autres graphiques utilisent encore Chart.js, en attendant leur migration.

Le fichier HTML embarque uniquement les modules ECharts nécessaires (GaugeChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent et SVGRenderer), avec leurs licences.

## Développement

Avant de contribuer, lire les [règles de développement communes](docs/development-rules.md).
Elles s'appliquent aux humains et aux agents, indépendamment de l'outil.
[`AGENTS.md`](AGENTS.md) et [`CLAUDE.md`](CLAUDE.md) sont des passerelles vers cette
source unique ; ne pas y recopier les règles.

`index.html` à la racine est l'artefact publié par GitHub Pages depuis `main/`. Le build assemble le template, le CSS, les bibliothèques hors ligne et le bundle applicatif. Son autonomie hors ligne est contrôlée statiquement et ne dépend pas d'un CDN ; la validation visuelle s'exécute en HTTP local, pas avec `file://`.

Le code source est réparti par responsabilité :

- `src/template/` contient la structure HTML et les points d'injection ; `src/styles/` contient les styles et tokens visuels.
- `src/app/domain/` normalise les données et calcule les métriques, sans DOM ni stockage ; `src/app/parser.js` lit les exports RES, BAL et Pièces.
- `src/app/state/` gère l'import transactionnel et le cache local versionné ; `src/app/charts/cartesian.js` contient les rendus Chart.js extraits et `src/app/chart-lifecycle.js` possède les instances Chart.js et ECharts.
- `src/app/entry.js` compose l'application, tandis que `src/app/legacy.js` conserve le rendu et les interactions pendant leur extraction progressive.
- `scripts/` produit et vérifie l'artefact ; `test/` contient les tests unitaires et le scénario navigateur sur des exports synthétiques.

```sh
npm ci
npm run build
npm test
npm run verify
npx playwright install chromium
npm run test:browser
```

Le test navigateur lance un serveur HTTP local éphémère et crée ses fichiers XLSX fictifs dans un répertoire temporaire. Il ne remplace pas Chromium par un autre navigateur : s'il n'est pas installé, Playwright indique la commande d'installation et le test échoue. En CI, Chromium et ses dépendances système sont installés explicitement.

Le dashboard cible les versions modernes de Chrome/Chromium, Firefox et Safari qui prennent en charge les modules JavaScript, les fichiers locaux, `localStorage`, Canvas/SVG et les requêtes média. Le contrôle automatisé s'exécute avec Chromium.

Les données restent en cache dans `localStorage`, sous réserve de l'espace accordé par le navigateur. En navigation privée ou si le quota est atteint, le dashboard conserve la session affichée et prévient que la nouvelle donnée ne sera pas restaurée après rechargement ; l'ancien cache n'est pas effacé. Réimporte les exports si la persistance locale n'est pas disponible.

La version affichée dans `src/app/legacy.js` (`APP_VERSION`) produit `version.txt` pendant le build. Incrémente-la lors d'une publication qui change l'application, puis committe ensemble les sources, `index.html` et `version.txt`. `npm run verify` échoue si l'artefact est obsolète ou si une ressource externe active est ajoutée.

Le bundle ECharts existant est conservé tel quel par le build ordinaire. Pour le reconstruire avec les versions épinglées d'ECharts et d'esbuild, utilise `npm run build:echarts`; cette commande met à jour `src/vendor/echarts.js` puis régénère `index.html`.

La présente refactorisation conserve les graphiques en place : elle n'inclut pas de migration générale de Chart.js vers ECharts. Les exports Louty et les contrats de cache existants restent la référence fonctionnelle.

Les tests et captures ne doivent contenir que des données synthétiques ou anonymisées. N'ajoute jamais d'export Louty réel, de capture de données client ou de résultat identifiable au dépôt.
