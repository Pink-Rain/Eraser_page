import assert from "node:assert/strict";
import test, { after } from "node:test";

import { loadEraser, loadOwn, vite } from "./eraser.mjs";

// Les formes de départ des présentations (src/presentation-starters.ts), venues d'Eraser à
// l'alpha 279 avec leurs tests : chacune passe telle quelle le nettoyage d'Eraser.
after(async () => { await vite.close(); });
const views = await loadEraser("/lib/index-presentations.ts");
const starters = await loadOwn("src/presentation-starters.ts");

test("liste, kanban et maître-détail : formes de base bâties sur les colonnes, propres", () => {
  // Les formes de base de la liste, du kanban et du maître-détail, bâties sur les colonnes, passent telles quelles le nettoyage.
  const columns = [{ header: "Nom", spec: { kind: "name" } }, { header: "Portrait", spec: { kind: "file", file: { accept: "image" } } }, { header: "Type", spec: { kind: "choice", options: [{ value: "Arme" }] } }, { header: "Prix", spec: { kind: "number" } }, { header: "Vie", spec: { kind: "number" } }, { header: "Description", spec: { kind: "rich" } }, { header: "Lieu", spec: { kind: "linked-choice" } }];
  for (const kind of ["list", "kanban", "master-detail"]) {
    const forms = starters.presentationStartersFor(kind, columns);
    assert.ok(forms.length >= 6, kind);
    for (const form of forms) {
      const clean = views.cleanPresentation(form.layout);
      assert.ok(clean, form.key);
      assert.equal(clean.kind, kind, form.key);
      assert.deepEqual(views.cleanPresentation(clean), clean, form.key);
    }
  }
  const linked = starters.presentationStartersFor("kanban", columns).find((form) => form.key === "kanban-linked");
  assert.equal(linked.layout.kanbanColumn, "Lieu");
  assert.deepEqual(linked.layout.groupFormula, { op: "sum", column: "Prix" });
  const gauge = starters.presentationStartersFor("list", columns).find((form) => form.key === "list-gauge");
  assert.deepEqual(gauge.layout.gauge, { column: "Prix", style: "bar", maxColumn: "Vie" });
  assert.equal(starters.presentationStartersFor("list", columns).find((form) => form.key === "list-zigzag").layout.imageColumn, "Portrait");
});

test("calendrier et tableau de bord : dix-huit et huit formes de départ, toutes propres", () => {
  // Les formes de départ du lot C : dix-huit pour le calendrier, huit pour le tableau de bord, toutes propres.
  const columns = [{ header: "Nom" }, { header: "Date" }, { header: "Type", spec: { kind: "choice", options: [{ value: "A" }] } }, { header: "Or", spec: { kind: "number" } }, { header: "Personnage", spec: { kind: "linked" } }, { header: "Description" }];
  const calendars = starters.presentationStartersFor("calendar", columns);
  const dashboards = starters.presentationStartersFor("dashboard", columns);
  assert.equal(calendars.length, 18);
  assert.equal(dashboards.length, 8);
  for (const starter of [...calendars, ...dashboards]) {
    const clean = views.cleanPresentation(starter.layout);
    assert.ok(clean, starter.key);
    assert.deepEqual(views.cleanPresentation(clean), clean, starter.key);
  }
  assert.ok(calendars.every((starter) => starter.layout.dateColumn === "Date"));
  assert.ok(new Set(calendars.map((starter) => starter.layout.calendarScale ?? "month")).size === 6, "toutes les échelles sont proposées");
  assert.ok(dashboards.some((starter) => starter.layout.tiles.some((tile) => tile.kind === "linked" && tile.column === "Personnage")));
});

test("galerie, chronologie, arborescence et codex : formes de départ propres, jamais cassées", () => {
  const columns = [{ header: "Nom" }, { header: "Portrait", spec: { kind: "file", file: { accept: "image" } } }, { header: "Date" }, { header: "Date de fin" }, { header: "Type", spec: { kind: "choice", options: [{ value: "A" }] } }, { header: "Or", spec: { kind: "number" } }, { header: "Vie", spec: { kind: "number" } }, { header: "Personnage", spec: { kind: "linked" } }, { header: "Description" }];
  const counts = { gallery: 6, timeline: 11, tree: 9, codex: 10 };
  for (const [kind, expected] of Object.entries(counts)) {
    const list = starters.presentationStartersFor(kind, columns);
    assert.equal(list.length, expected, kind);
    for (const starter of list) {
      const clean = views.cleanPresentation(starter.layout);
      assert.ok(clean, starter.key);
      assert.deepEqual(views.cleanPresentation(clean), clean, starter.key);
      assert.equal(clean.kind, kind, starter.key);
    }
  }
  const timelines = starters.presentationStartersFor("timeline", columns);
  assert.ok(timelines.every((starter) => starter.layout.dateColumn === "Date"));
  assert.equal(timelines.find((starter) => starter.key === "chr-bars").layout.endColumn, "Date de fin");
  assert.equal(timelines.find((starter) => starter.key === "chr-lanes").layout.laneColumn, "Personnage");
  assert.ok(starters.presentationStartersFor("tree", columns).every((starter) => starter.layout.parentColumn === "Personnage"));
  assert.deepEqual(starters.presentationStartersFor("codex", columns).find((starter) => starter.key === "cdx-bestiary").layout.codexTiles, ["Or", "Vie"]);
  // Toutes les formes de départ des douze vues, sur un onglet réduit au nom : jamais une forme cassée.
  for (const kind of ["list", "kanban", "master-detail", "calendar", "dashboard", "gallery", "timeline", "tree", "codex"]) for (const starter of starters.presentationStartersFor(kind, [{ header: "Nom" }])) assert.ok(views.cleanPresentation(starter.layout), `${kind} ${starter.key}`);
});
