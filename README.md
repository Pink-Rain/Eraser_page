# Eraser Page

Extension d'[Eraser](https://github.com/Pink-Rain/Eraser), l'application de JDR : l'atelier des
pages (l'Index des pages, l'atelier d'une page et l'éditeur du menu latéral) et les apparences des
index (survols, cartes, formulaires et présentations).

## Comment elle arrive dans Eraser

- Elle est liée à Eraser sous l'identifiant `page` (`lib/extensions.ts` du dépôt Eraser).
- Chaque version publiée (une Release GitHub de ce dépôt, faite par le workflow) joint
  `eraser-extension.json` et `eraser-extension.pack.gz`.
- Toutes les installations d'Eraser la téléchargent, la vérifient et la mettent à jour seules (au
  lancement, toutes les six heures, et avec « Chercher les mises à jour »). Les pages et le menu
  sont aux administrateurs (`/extension/page`, « Pages » dans le menu, « Modifier la page »), les
  apparences des index aux MJ et aux administrateurs (bouton « Apparences » d'un index).

Pour travailler dessus : voir `AGENTS.md`.
