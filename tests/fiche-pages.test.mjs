import assert from "node:assert/strict";
import test, { after } from "node:test";

import { loadEraser, loadOwn, vite } from "./eraser.mjs";

// Les fiches-pages (src/fiche-pages.ts) : la page de départ qu'Eraser accepte telle quelle, et la
// ligne d'exemple de l'atelier remplie comme sur la vraie page (/fiche/<index>/<ID>).
after(async () => { await vite.close(); });
const pages = await loadEraser("/lib/custom-pages.ts");
const rows = await loadEraser("/lib/custom-pages-rows.ts");
const fiche = await loadOwn("src/fiche-pages.ts");
const explorer = await loadOwn("src/page-explorer.ts");

const columns = [
  { header: "ID", spec: { kind: "id" } },
  { header: "Nom", spec: { kind: "name", rowLabel: true } },
  { header: "Blason", spec: { kind: "file", file: { accept: "image" } } },
  { header: "Description", spec: { kind: "rich" } },
];

test("Fiche-page : le nom et l'image de la ligne sont trouvés dans les colonnes de l'onglet", () => {
  assert.equal(fiche.ficheNameHeader(columns), "Nom");
  // Le nom réglé par l'index (une classe : « Nom de la classe ») passe avant les autres.
  assert.equal(fiche.ficheNameHeader([{ header: "ID" }, { header: "Type" }, { header: "Nom de la classe" }], "Nom de la classe"), "Nom de la classe");
  assert.equal(fiche.ficheNameHeader([{ header: "ID" }, { header: "Titre", spec: { kind: "rich", rowLabel: true } }]), "Titre");
  assert.equal(fiche.ficheImageHeader(columns), "Blason");
  assert.equal(fiche.ficheImageHeader([{ header: "Portrait" }]), "Portrait");
  assert.equal(fiche.ficheImageHeader([{ header: "Nom" }]), "");
});

test("Fiche-page : la page de départ passe telle quelle le nettoyage d'Eraser", () => {
  const content = fiche.ficheStarter({ title: "Fiche · Peuples", indexTitle: "Index des peuples", nameHeader: "Nom", imageHeader: "Blason" });
  const cleaned = pages.cleanCustomPage({ ...content, place: "hors-menu", vis: "tous", rowOf: { index: "peoples" } });
  assert.equal(cleaned.title, "Fiche · Peuples");
  assert.equal(cleaned.hideHeader, true);
  assert.deepEqual(cleaned.rowOf, { index: "peoples" });
  const blocks = cleaned.sections.flatMap((section) => section.cols.flat());
  assert.deepEqual(blocks.map((block) => block.type), ["image", "title", "rowfields", "backlinks"]);
  assert.equal(blocks[0].src, "{Blason}");
  assert.equal(blocks[1].text, "{Nom}");
  assert.equal(blocks[2].style, "form");
  assert.equal(cleaned.sections[0].layout, "side-l");
  // Sans colonne d'image : le nom et les valeurs sur toute la largeur.
  const plain = pages.cleanCustomPage({ ...fiche.ficheStarter({ title: "Lieux", indexTitle: "Index des lieux", nameHeader: "Nom", imageHeader: "" }), place: "hors-menu", vis: "tous" });
  assert.deepEqual(plain.sections.map((section) => section.layout), ["1", "1"]);
});

test("Fiche-page : la ligne d'exemple remplit « {Colonne} » comme la vraie page", () => {
  const headers = ["ID", "Nom", "Description"];
  const data = [{ values: ["elfes", "Elfes", "Peuple <ancien>"], html: ["", "", "Peuple <b>ancien</b><script>alert(1)</script>"] }, { values: ["", "Sans ID", ""], html: [] }];
  assert.deepEqual(fiche.ficheExamples(headers, data, "Nom"), [{ id: "elfes", name: "Elfes" }]);
  const sanitize = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "");
  const row = fiche.ficheRowContext({ index: "peoples", indexTitle: "Index des peuples", tab: "Peuples", headers, rows: data, id: "elfes", nameHeader: "Nom" }, sanitize);
  assert.equal(row.name, "Elfes");
  assert.equal(row.columns.find((column) => column.header === "Description").html, "Peuple <b>ancien</b>");
  assert.equal(fiche.ficheRowContext({ index: "peoples", indexTitle: "", tab: "Peuples", headers, rows: data, id: "nains", nameHeader: "Nom" }, sanitize), null);
  const view = { id: "p", title: "Fiche", icon: "", emoji: "", description: "", sections: [{ id: "s", layout: "1", framed: false, cols: [[{ id: "b", vis: "tous", type: "title", eyebrow: "Peuple", text: "{Nom}", level: "h2", align: "left" }]] }] };
  const filled = rows.fillRowPage(view, row);
  assert.equal(filled.sections[0].cols[0][0].text, "Elfes");
});

test("Index des pages : une fiche-page se lit par son index, à l'adresse de ses lignes", () => {
  const summary = { id: "p-fiche", title: "Fiche · Peuples", icon: "file-text", emoji: "", description: "", href: "/pages/fiche-peuples", slug: "fiche-peuples", place: "hors-menu", campaignId: "", vis: "tous", status: "brouillon", unpublished: true, blocks: 4, createdAt: "", updatedAt: "", updatedBy: "Admin", trashedAt: "", editable: true, rowOf: { index: "peoples" } };
  const [row] = explorer.explorerPages([summary], [], undefined, (key) => key === "peoples" ? "Index des peuples" : key);
  assert.equal(row.where, "Fiche-page · Index des peuples");
  assert.equal(row.group, "Fiches-pages");
  assert.equal(row.href, "/fiche/peoples/…");
  assert.equal(row.visitable, false);
});
