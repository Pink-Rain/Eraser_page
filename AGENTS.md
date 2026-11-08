# Instructions pour les IA travaillant sur Eraser Page

Eraser Page est l'atelier des pages d'Eraser (dépôt principal : `Pink-Rain/Eraser`), publié comme
extension : l'Index des pages, l'atelier d'une page et l'éditeur du menu. Eraser l'affiche dans sa
coque à l'adresse `/extension/page/…` (admins seulement). Le contrat des extensions est décrit dans
la section « Extensions » de l'`ARCHITECTURE.md` d'Eraser.

## Ce qui vit où

- Ici : l'interface de l'atelier (`src/`). `src/main.tsx` exporte `Page`, qui choisit l'écran
  d'après `eraser.path` : `[]` Index des pages, `["atelier", id]`, `["menu"]`,
  `["apparences", index]` (`src/appearances.tsx` : survols, cartes, formulaires et présentations
  d'un index).
- **L'éditeur des apparences est ici** (`src/appearances-editor.tsx`, aussi pour « Modifier
  l'affichage » de l'Index des pages), avec l'éditeur des présentations
  (`src/presentations-editor.tsx`, `src/presentation-starters.ts`), la grille des sections
  (`src/page-section-grid.tsx`) et l'explorateur de l'Index des pages (`src/page-explorer.ts`).
  N'emprunter à Eraser que ce qu'il utilise lui-même (le moteur garde l'éditeur de mise en page
  pour le formulaire principal, celui des cartes pour la carte officielle) : ce qui ne sert qu'à
  l'atelier vit ici, jamais dans Eraser.
- Droits **par module**, jamais par extension : les pages et le menu, les administrateurs ; les
  apparences des index, les MJ et les administrateurs (`eraser.account.role`). Les API d'Eraser
  vérifient toujours.
- Le « Modifier » d'un index (dans Eraser, `scope="moteur"`) ne garde que colonnes, formulaire
  principal, carte officielle, stats et affichage des items : l'apparence se crée ici.
- Dans Eraser : l'affichage des pages (tous les joueurs les lisent), le modèle des pages
  (`lib/custom-pages.ts`), les API d'enregistrement (qui vérifient les droits), et les données
  de chaque écran (`GET /api/pages/atelier?ecran=index|page|menu`, `lib/page-atelier-data.ts`).
- Tout import `@/…`, React et `next/*` sont **prêtés par Eraser** à l'exécution
  (`components/eraser/extension-modules.ts` d'Eraser) : ne jamais les recopier ici. Un module
  qu'Eraser ne prête pas encore s'ajoute là-bas (jamais un module qui tire du code serveur ; on
  n'importe d'un tel module que des types).
- Un nouveau type de bloc touche les deux dépôts : l'affichage dans Eraser, l'édition ici.
- Ce qui charge encore porte `aria-busy="true"` (écran `Screen`, apparences) : le relevé de
  fluidité d'Eraser compte l'ouverture de l'extension, et le changement de page, jusqu'à ce qu'il
  n'y en ait plus. Un nouvel écran qui lit ses données fait de même.

## Construire et vérifier

- Une copie d'Eraser (avec ses dépendances) est nécessaire : `ERASER_DIR=/chemin/vers/Eraser`, ou
  `./eraser`. Dans une session cloud, Eraser est souvent cloné dans `/home/user/Eraser`.
- `npm run build` : esbuild (React Compiler compris) et Tailwind avec le thème d'Eraser. Il échoue
  si `src/` importe un module qu'Eraser ne prête pas (`components/eraser/extension-modules.ts`). Les
  classes qu'Eraser produit déjà sont exclues (sinon, chargées après sa feuille, elles passent
  devant ses variantes) : construire contre la version d'Eraser qui fera tourner l'extension.
- `npm run check` : types de `src/` avec ceux d'Eraser.
- `npm test` : `tests/*.test.mjs`, qui chargent `src/` et les modules d'Eraser comme à l'exécution
  (`tests/eraser.mjs`, Vite de la copie d'Eraser).
- `npm run pack` : `release/eraser-extension.json` et `release/eraser-extension.pack.gz`.

## Publier

- Incrémenter `version` dans `package.json` et réécrire `RELEASE.md`, puis pousser sur `main` :
  le workflow construit contre `windows-app-migration` d'Eraser et publie la Release
  `v<version>`. Sans incrément, rien n'est publié. Publier sans demander, comme les alpha d'Eraser.
- Si l'extension a besoin d'Eraser plus récent (nouveau module prêté, nouvelle API), publier Eraser
  d'abord, puis l'extension ; `eraserExtension.api` suit `EXTENSION_API_VERSION` d'Eraser.
