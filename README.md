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

**Tout se passe dans le navigateur.** Aucune donnée n'est envoyée sur internet : les bibliothèques (Chart.js, SheetJS) et la police sont embarquées dans le fichier, et une CSP bloque toute requête réseau sortante. Tes données sont mémorisées localement (localStorage) sur ton ordinateur uniquement.

## Cap annuel & leviers

En tête du tableau de bord, définis ton **revenu annuel à financer** et le **surplus annuel** que tu souhaites dégager après rémunérations et charges. Le dashboard en déduit la marge brute à produire et reporte cette trajectoire sur les graphiques.

Le simulateur de trajectoire (taux de marge et charges) est initialisé à partir des données réelles des deux derniers exercices complets, puis mémorisé sur ton poste. Le CA nécessaire est calculé automatiquement à partir du cap et du taux de marge choisi. Tu peux à tout moment revenir à cette référence historique. Les seuils de lecture des graphiques restent accessibles via la roue crantée.
