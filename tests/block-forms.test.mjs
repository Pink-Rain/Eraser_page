import assert from "node:assert/strict";
import test, { after } from "node:test";

import { loadOwn, vite } from "./eraser.mjs";

// La forme que montre un bloc « Vue d'index » (src/block-forms.ts), d'où part son éditeur d'apparence :
// la sienne, une version de l'onglet, un preset, sinon celle de l'onglet ; une seule rangée de formes.
after(async () => { await vite.close(); });
const forms = await loadOwn("src/block-forms.ts");

test("Apparence d'un bloc : une seule rangée de formes, le tableau et les cartes compris", () => {
  const kinds = forms.blockForms.map((entry) => entry.value);
  assert.deepEqual(kinds.slice(0, 3), ["table", "cards", "list"]);
  for (const kind of ["kanban", "gallery", "timeline", "calendar", "tree", "codex", "dashboard", "master-detail"]) assert.ok(kinds.includes(kind), kind);
});

test("Apparence d'un bloc : la forme montrée, d'où que vienne son réglage", () => {
  const sources = {
    presentations: { Peuples: { named: [{ id: "v1", name: "Liste courte", layout: { kind: "list", compact: true } }] } },
    viewPresets: [{ id: "mien", name: "Le mien", layout: { kind: "kanban", laneWidth: "wide" } }],
    tabForm: { kind: "list", groupBy: "Type" },
  };
  // La sienne d'abord.
  assert.deepEqual(forms.blockForm({ kind: "list", tab: "Peuples", layout: { kind: "list", numbered: true } }, sources), { kind: "list", numbered: true });
  // Une version de l'onglet (le nom de l'onglet sans tenir compte des accents ni de la casse).
  assert.equal(forms.blockForm({ kind: "list", tab: "peuples", presetId: "vue:v1" }, sources).compact, true);
  // Un preset (les tiens, ceux d'Eraser) ; sa forme prend le genre du bloc.
  assert.deepEqual(forms.blockForm({ kind: "kanban", tab: "Peuples", presetId: "mien" }, sources), { kind: "kanban", laneWidth: "wide" });
  assert.equal(forms.blockForm({ kind: "list", tab: "Peuples", presetId: "eraser:classes-par-famille" }, sources).itemCard, "eraser-classe-carte");
  // Sinon celle de l'onglet, et d'office la forme vide.
  assert.equal(forms.blockForm({ kind: "list", tab: "Peuples" }, sources).groupBy, "Type");
  assert.deepEqual(forms.blockForm({ kind: "gallery", tab: "Peuples" }, { ...sources, tabForm: undefined }), { kind: "gallery" });
});
