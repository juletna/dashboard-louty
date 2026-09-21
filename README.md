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

`index.html` à la racine est l'artefact publié par GitHub Pages. Le build assemble le template, le CSS, les bibliothèques hors ligne, le parser et le script applicatif sans transformer leur code. Le fichier produit reste ouvrable directement avec `file://`.

```sh
npm ci
npm run build
npm run verify
npm test
```

La version affichée dans `src/app/legacy.js` (`APP_VERSION`) produit `version.txt` pendant le build. Incrémente-la lors d'une publication qui change l'application, puis committe ensemble les sources, `index.html` et `version.txt`. `npm run verify` échoue si l'artefact est obsolète ou si une ressource externe active est ajoutée.

Le bundle ECharts existant est conservé tel quel par le build ordinaire. Pour le reconstruire avec les versions épinglées d'ECharts et d'esbuild, utilise `npm run build:echarts`; cette commande met à jour `src/vendor/echarts.js` puis régénère `index.html`.

Les tests et captures ne doivent contenir que des données synthétiques ou anonymisées. N'ajoute jamais d'export Louty réel, de capture de données client ou de résultat identifiable au dépôt.
