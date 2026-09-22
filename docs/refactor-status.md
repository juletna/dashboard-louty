# État de la refactorisation

Le livrable reste un unique `index.html` à la racine du dépôt. Il est construit
depuis les sources et publié par GitHub Pages depuis `main/`. Le workflow de
vérification ajouté par cette refactorisation ne déploie pas.

## Lots réalisés

### Lot 1 — Sources et build reproductible

Le HTML, les styles, les bibliothèques hors ligne et l'application ont été
sortis de l'artefact monolithique. `npm run build` régénère `index.html` et
`version.txt` à la racine. `npm run verify` vérifie notamment que l'artefact
reste autonome et que ses ressources actives ne chargent pas de contenu réseau.

La revue indépendante a relevé que le contrôleur hors ligne ne détectait pas
toutes les ressources protocol-relative actives. Son périmètre a été corrigé,
puis validé lors d'une seconde passe.

### Lot 2 — Domaine et parser

Le schéma des données, les métriques et les parseurs sont maintenant testables
hors du rendu. Les exercices partiels et les cellules réellement indisponibles
restent admis par le schéma ; une structure d'année ou de série invalide rejette
le candidat complet pour éviter une sauvegarde amputée. Les références
historiques n'utilisent que des exercices complets, les zéros réels restent des
zéros, les dates invalides ne deviennent pas 1970 et les noms de clients tels
que `__proto__` restent des données ordinaires.

La première revue a relevé trois défauts de calcul et de date. Ils ont été
corrigés et la seconde passe n'a relevé aucun point medium ou plus. Une troisième
passe ciblée a validé la validation structurelle des années et un objet
`monthly` nul.

### Lot 3 — État, persistance et import

L'import prépare et valide un candidat avant de le publier. Si le parsing ou le
rendu échoue, l'état affiché et le cache antérieur restent disponibles. Si le
quota de stockage empêche l'écriture, la session rendue demeure utilisable et
un avertissement indique qu'elle ne survivra pas à un rechargement.

La revue a relevé la restauration incomplète de deux sélections d'interface
après un rollback. La correction et son test ont été validés lors de la seconde
passe, sans autre point medium ou plus.

### Lot 4 — Finition graphique et vérification navigateur

Le cycle de vie des graphiques est isolé afin de créer, redimensionner et
détruire les instances de façon cohérente. Le smoke test Playwright utilise
uniquement des classeurs XLSX synthétiques et contrôle l'import, le cache local,
le rollback, les thèmes, la réduction des mouvements et une vue mobile.

## Vérification avant publication

Exécuter, sur une copie propre :

```sh
npm ci
npm run build
npm test
npm run verify
npx playwright install chromium
npm run test:browser
```

Le workflow GitHub répète ces contrôles sous Chromium. Avant une publication,
vérifier aussi manuellement trois exports locaux représentatifs. Ces fichiers
restent hors dépôt, de même que les captures qui révéleraient des données
identifiables. Après le push, ouvrir la page GitHub Pages et vérifier la version
servie ainsi que le parcours d'import.

## Limites connues et périmètre conservé

- Les graphiques Chart.js existants ne sont pas convertis en ECharts par cette
  refactorisation.
- La persistance dépend du quota et des règles de `localStorage` du navigateur ;
  elle est volontairement une optimisation locale et non une sauvegarde
  garantie.
- Les imports restent compatibles avec les formats d'exports Louty pris en
  charge par les parseurs. Un libellé comptable absent est signalé sans inventer
  de valeur.
- L'autonomie de l'artefact est vérifiée statiquement. Le scénario de
  navigation utilise délibérément HTTP local pour reproduire le contexte de
  Pages et du stockage local ; aucune validation visuelle avec `file://` n'a
  été effectuée.
