# Eraser Page

Extension d'[Eraser](https://github.com/Pink-Rain/Eraser), l'application de JDR : l'atelier des
pages (l'Index des pages, l'atelier d'une page et l'éditeur du menu latéral).

## Comment elle arrive dans Eraser

- Elle est liée à Eraser sous l'identifiant `page` (`lib/extensions.ts` du dépôt Eraser).
- Chaque version publiée (une Release GitHub de ce dépôt, faite par le workflow) joint
  `eraser-extension.json` et `eraser-extension.pack.gz`.
- Toutes les installations d'Eraser la téléchargent, la vérifient et la mettent à jour seules (au
  lancement, toutes les six heures, et avec « Chercher les mises à jour »). Seuls les
  administrateurs l'ouvrent, à l'adresse `/extension/page`, ou par « Pages » dans le menu et
  « Modifier la page » dans l'en-tête.

Pour travailler dessus : voir `AGENTS.md`.
