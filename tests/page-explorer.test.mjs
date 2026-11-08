import assert from "node:assert/strict";
import test, { after } from "node:test";

import { loadEraser, loadOwn, vite } from "./eraser.mjs";

// L'explorateur de l'Index des pages (src/page-explorer.ts), venu d'Eraser à l'alpha 279 avec ses
// tests : pages d'Eraser et pages créées, rangement par section, recherche.
after(async () => { await vite.close(); });
const folders = await loadEraser("/lib/page-folders.ts");
const explorer = await loadOwn("src/page-explorer.ts");

const summary = (overrides) => ({ id: "p-1", title: "Page", icon: "", emoji: "", description: "", href: "/pages/page", slug: "page", place: "hors-menu", campaignId: "", vis: "tous", status: "publiee", unpublished: false, blocks: 1, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", updatedBy: "Admin", trashedAt: "", editable: true, ...overrides });
const eraserEntry = (path, label, group, page) => ({ path, label, group, icon: "swords", description: "", vis: "tous", redrawn: false, ...(page ? { page } : {}) });

test("Explorateur : pages d'Eraser et pages créées sous la même forme, une seule ligne par page", () => {
  const rows = explorer.explorerPages([
    summary({ id: "p-guide", title: "Guide du joueur", href: "/regles/guide", place: "regles" }),
    // La reprise de « Combat », jamais publiée ni modifiée : les lecteurs voient la page d'Eraser.
    summary({ id: "p-combat", title: "Combat", href: "/pages/regles-combat", status: "brouillon", unpublished: true, replaces: "/regles/combat", replaceMode: "replace" }),
    // La reprise de « Journal », modifiée depuis : publiée, « modifiée ».
    summary({ id: "p-journal", title: "Journal", status: "brouillon", unpublished: true, replaces: "/campagne/[id]/journal", replaceMode: "replace", updatedAt: "2026-10-02T00:00:00.000Z" }),
  ], [
    eraserEntry("/regles/combat", "Combat", "Règles", { id: "p-combat", title: "Combat", status: "brouillon", mode: "replace", unpublished: true }),
    eraserEntry("/campagne/[id]/journal", "Journal d’une campagne", "Campagnes", { id: "p-journal", title: "Journal", status: "brouillon", mode: "replace", unpublished: true }),
    eraserEntry("/bac-a-sable/magasin", "Magasin", "Bac à sable"),
  ]);
  assert.deepEqual(rows.map((row) => row.key).sort(), ["eraser:/bac-a-sable/magasin", "eraser:/campagne/[id]/journal", "eraser:/regles/combat", "p-guide"]);
  const combat = rows.find((row) => row.key === "eraser:/regles/combat");
  assert.equal(combat.href, "/regles/combat");
  assert.equal(combat.status, "publiee");
  assert.equal(combat.unpublished, false);
  assert.equal(combat.where, "Règles");
  const journal = rows.find((row) => row.key === "eraser:/campagne/[id]/journal");
  assert.equal(journal.status, "publiee");
  assert.equal(journal.unpublished, true);
  assert.equal(journal.visitable, false);
  const shop = rows.find((row) => row.key === "eraser:/bac-a-sable/magasin");
  assert.equal(shop.id, "");
  assert.equal(shop.editable, true);
  assert.equal(shop.status, "publiee");
});

test("Explorateur : une reprise mise à la corbeille rend la page d'Eraser, rangée au même endroit", () => {
  const rows = explorer.explorerPages([
    summary({ id: "p-combat", title: "Combat maison", replaces: "/regles/combat", replaceMode: "replace", trashedAt: "2026-10-03T00:00:00.000Z" }),
  ], [eraserEntry("/regles/combat", "Combat", "Règles")]);
  const live = rows.filter((row) => !row.trashedAt);
  const trashed = rows.filter((row) => row.trashedAt);
  assert.deepEqual(live.map((row) => [row.key, row.title, row.id]), [["eraser:/regles/combat", "Combat", ""]]);
  assert.deepEqual(trashed.map((row) => [row.key, row.id]), [["eraser:/regles/combat", "p-combat"]]);
});

test("Ranger par section : un dossier par groupe, ceux de la racine réutilisés, les pages rangées ne bougent pas", () => {
  const rows = explorer.explorerPages([summary({ id: "p-guide", title: "Guide", place: "regles" }), summary({ id: "p-note", title: "Note", place: "hors-menu" })], [eraserEntry("/regles/combat", "Combat", "Règles"), eraserEntry("/bac-a-sable/magasin", "Magasin", "Bac à sable")]);
  const state = folders.applyFolderOps(folders.emptyFolders(), [{ op: "create", id: "d-regles", name: "Règles", parent: "" }, { op: "create", id: "d-perso", name: "Perso", parent: "" }, { op: "place", keys: ["p-note"], folder: "d-perso" }]);
  let next = 0;
  const plan = explorer.sectionFolderPlan(rows, state, () => `d-neuf${next += 1}`);
  assert.deepEqual(plan.create, [{ id: "d-neuf1", name: "Bac à sable" }]);
  assert.deepEqual(plan.place.map((entry) => [entry.folder, entry.keys.sort()]), [["d-regles", ["eraser:/regles/combat", "p-guide"]], ["d-neuf1", ["eraser:/bac-a-sable/magasin"]]]);
});

test("Recherche de l'explorateur : titre, adresse et chemin du dossier, sans accents", () => {
  const state = folders.applyFolderOps(folders.emptyFolders(), [{ op: "create", id: "d-lore", name: "Légendes", parent: "" }, { op: "place", keys: ["p-1"], folder: "d-lore" }]);
  const [row] = explorer.explorerPages([summary({ id: "p-1", title: "Les dieux du Sud" })], []);
  assert.ok(explorer.matchesExplorerQuery(row, "legendes dieux", state));
  assert.ok(!explorer.matchesExplorerQuery(row, "nord", state));
});

