# Dashboard Louty

Outil autonome (un seul fichier HTML) qui génère un tableau de bord d'activité à partir des exports Excel de l'outil de compta **Louty** de CABESTAN.

## 🔗 Accès direct

**→ [Ouvrir le dashboard](https://juletna.github.io/dashboard-louty/)**

## Utilisation

Ouvre le dashboard via le lien ci-dessus (ou le fichier [`index.html`](index.html) en local), puis dépose tes deux exports Louty :

- **`RES_U_Résultat d'Activité`** (`.xlsx`, obligatoire) — marge brute, chiffre d'affaires, achats, charges, comparaisons N-1…
- **`BAL_A_Balance Analytique`** (`.xlsx`, facultatif) — trésorerie, dettes, position nette (carte « Santé financière »).

Les deux fichiers se téléchargent dans Louty, rubrique **Rapports de gestion**. Au téléchargement du Résultat d'Activité, coche **toutes les années** dans la fenêtre « Exercices » pour activer les comparaisons et cumuls.

## Confidentialité

**Tout se passe dans le navigateur.** Aucune donnée n'est envoyée sur internet : les bibliothèques (Chart.js, Apache ECharts, SheetJS) et la police sont embarquées dans le fichier, et une CSP bloque toute requête réseau sortante. Tes données sont mémorisées localement (localStorage) sur ton ordinateur uniquement.

## Cap annuel & leviers

En tête du tableau de bord, définis ton **revenu annuel à financer** et le **surplus annuel** que tu souhaites dégager après rémunérations et charges. Le dashboard en déduit la marge brute à produire et reporte cette trajectoire sur les graphiques.

Le simulateur de trajectoire (taux de marge et charges) est initialisé à partir des données réelles des deux derniers exercices complets, puis mémorisé sur ton poste. Le CA nécessaire est calculé automatiquement à partir du cap et du taux de marge choisi. Tu peux à tout moment revenir à cette référence historique. Les seuils de lecture des graphiques restent accessibles via la roue crantée.

## Bibliothèques graphiques

Les jauges « Ratio achats / CA » et « Taux de marge brute » utilisent les composants natifs Apache ECharts 6.1.0, avec rendu SVG et animations respectant la préférence de réduction des mouvements. Les blocs « Où j’en suis » et « Comparatif d’avancement annuel » utilisent également ECharts, avec des barres horizontales et le même cycle d’animation. Les autres graphiques utilisent encore Chart.js, en attendant leur migration.

Le fichier HTML embarque uniquement les modules ECharts nécessaires (GaugeChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent et SVGRenderer), avec leurs licences.

## Développement

`index.html` à la racine est l'artefact publié par GitHub Pages depuis `main/`. Le build assemble le template, le CSS, les bibliothèques hors ligne et le bundle applicatif. Son autonomie hors ligne est contrôlée statiquement et ne dépend pas d'un CDN ; la validation visuelle s'exécute en HTTP local, pas avec `file://`.

Le code source est réparti par responsabilité :

- `src/template/` contient la structure HTML et les points d'injection ; `src/styles/` contient les styles et tokens visuels.
- `src/app/domain/` normalise les données et calcule les métriques, sans DOM ni stockage ; `src/app/parser.js` lit les exports RES, BAL et Pièces.
- `src/app/state/` gère l'import transactionnel et le cache local versionné ; `src/app/chart-lifecycle.js` possède les instances Chart.js et ECharts.
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
