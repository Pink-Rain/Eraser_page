# Instructions pour les IA travaillant sur Eraser Page

Eraser Page est l'atelier des pages d'Eraser (dépôt principal : `Pink-Rain/Eraser`), publié comme
extension : l'Index des pages, l'atelier d'une page et l'éditeur du menu. Eraser l'affiche dans sa
coque à l'adresse `/extension/page/…` (admins seulement). Le contrat des extensions est décrit dans
la section « Extensions » de l'`ARCHITECTURE.md` d'Eraser.

## Ce qui vit où

- Ici : l'interface de l'atelier (`src/`). `src/main.tsx` exporte `Page`, qui choisit l'écran
  d'après `eraser.path` : `[]` Index des pages, `["atelier", id]`, `["menu"]`.
- Dans Eraser : l'affichage des pages (tous les joueurs les lisent), le modèle des pages
  (`lib/custom-pages.ts`), les API d'enregistrement (qui vérifient les droits), et les données
  de chaque écran (`GET /api/pages/atelier?ecran=index|page|menu`, `lib/page-atelier-data.ts`).
- Tout import `@/…`, React et `next/*` sont **prêtés par Eraser** à l'exécution
  (`components/eraser/extension-modules.ts` d'Eraser) : ne jamais les recopier ici. Un module
  qu'Eraser ne prête pas encore s'ajoute là-bas (jamais un module qui tire du code serveur ; on
  n'importe d'un tel module que des types).
- Un nouveau type de bloc touche les deux dépôts : l'affichage dans Eraser, l'édition ici.

## Construire et vérifier

- Une copie d'Eraser (avec ses dépendances) est nécessaire : `ERASER_DIR=/chemin/vers/Eraser`, ou
  `./eraser`. Dans une session cloud, Eraser est souvent cloné dans `/home/user/Eraser`.
- `npm run build` : esbuild (React Compiler compris) et Tailwind avec le thème d'Eraser. Les
  classes qu'Eraser produit déjà sont exclues (sinon, chargées après sa feuille, elles passent
  devant ses variantes) : construire contre la version d'Eraser qui fera tourner l'extension.
- `npm run check` : types de `src/` avec ceux d'Eraser.
- `npm run pack` : `release/eraser-extension.json` et `release/eraser-extension.pack.gz`.

## Publier

- Incrémenter `version` dans `package.json` et réécrire `RELEASE.md`, puis pousser sur `main` :
  le workflow construit contre `windows-app-migration` d'Eraser et publie la Release
  `v<version>`. Sans incrément, rien n'est publié. Publier sans demander, comme les alpha d'Eraser.
- Si l'extension a besoin d'Eraser plus récent (nouveau module prêté, nouvelle API), publier Eraser
  d'abord, puis l'extension ; `eraserExtension.api` suit `EXTENSION_API_VERSION` d'Eraser.
