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

## Objectifs & seuils

Les objectifs annuels et seuils (marge brute, CA, ratio achats/CA…) sont **tes réglages personnels**, réglables via la roue crantée et mémorisés sur ton poste. Ils ne proviennent pas du fichier Louty.
